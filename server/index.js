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

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create AssemblyAI token" });
  }
});

app.listen(PORT, () => {
  console.log(`Token server running on http://localhost:${PORT}`);
});
