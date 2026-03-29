import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing ASSEMBLYAI_API_KEY");
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonResponse(response, context) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    const preview = raw.slice(0, 140).trim();
    if (preview.startsWith("<")) {
      throw new Error(`${context}: received HTML instead of JSON`);
    }

    throw new Error(`${context}: received non-JSON response`);
  }
}

app.get("/assemblyai/token", async (_req, res) => {
  try {
    const expiresInSeconds = 300;

    const response = await fetch(
      `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${expiresInSeconds}`,
      {
        method: "GET",
        headers: {
          Authorization: API_KEY,
        },
      },
    );

    const data = await parseJsonResponse(response, "Token request");

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create AssemblyAI token" });
  }
});

app.post(
  "/assemblyai/transcribe",
  express.raw({ type: "*/*", limit: "30mb" }),
  async (req, res) => {
    try {
      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: "Missing audio payload" });
      }

      const uploadResponse = await fetch(
        "https://api.assemblyai.com/v2/upload",
        {
          method: "POST",
          headers: {
            Authorization: API_KEY,
            "Content-Type": "application/octet-stream",
          },
          body: req.body,
        },
      );

      const uploadData = await parseJsonResponse(
        uploadResponse,
        "Upload request",
      );
      if (!uploadResponse.ok || !uploadData.upload_url) {
        return res.status(uploadResponse.status || 500).json({
          error: uploadData.error || "Failed to upload audio",
        });
      }

      const createResponse = await fetch(
        "https://api.assemblyai.com/v2/transcript",
        {
          method: "POST",
          headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_url: uploadData.upload_url,
            speech_models: ["universal-2"],
          }),
        },
      );

      const createData = await parseJsonResponse(
        createResponse,
        "Create transcript request",
      );
      if (!createResponse.ok || !createData.id) {
        return res.status(createResponse.status || 500).json({
          error: createData.error || "Failed to create transcript job",
        });
      }

      const deadline = Date.now() + 90_000;
      let finalData = null;

      while (Date.now() < deadline) {
        const pollResponse = await fetch(
          `https://api.assemblyai.com/v2/transcript/${createData.id}`,
          {
            method: "GET",
            headers: {
              Authorization: API_KEY,
            },
          },
        );

        const pollData = await parseJsonResponse(
          pollResponse,
          "Poll transcript request",
        );
        if (!pollResponse.ok) {
          return res.status(pollResponse.status || 500).json({
            error: pollData.error || "Failed to poll transcript",
          });
        }

        if (pollData.status === "completed") {
          finalData = pollData;
          break;
        }

        if (pollData.status === "error") {
          return res.status(500).json({
            error: pollData.error || "Transcription failed",
          });
        }

        await wait(1500);
      }

      if (!finalData) {
        return res.status(504).json({ error: "Transcription timed out" });
      }

      return res.json({
        id: finalData.id,
        status: finalData.status,
        text: finalData.text || "",
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "Failed to transcribe background recording" });
    }
  },
);

app.listen(PORT, () => {
  console.log(`AssemblyAI server running on http://localhost:${PORT}`);
});
