import { K2_CONFIG, validateConfig } from "@/config/k2-config";
import { computeSessionSpeechMetrics } from "@/services/speech-metrics";

interface SpeechAnalysisResult {
  fillers: string[];
  vagueLanguage: string[];
  suggestions: string[];
  overall_score: number;
  details: string;
}

const REQUEST_TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeDeterministicQualityScore(text: string): number {
  const metrics = computeSessionSpeechMetrics(text);
  const wordCount = metrics.vocabulary.totalWords;

  // Fillers: strong negative signal, capped to avoid over-penalizing long sessions.
  const fillerPenalty = clamp(metrics.fillerRatePercent * 4, 0, 45);
  const fillerScore = 100 - fillerPenalty;

  // Vocabulary diversity: map practical range [0.2, 0.55] to [0, 100].
  const ttr = metrics.vocabulary.typeTokenRatio;
  const vocabScore = clamp(((ttr - 0.2) / 0.35) * 100, 0, 100);

  // Long clean streak rewards sustained fluent speech.
  const cleanStreakScore = clamp(
    (metrics.longestCleanStreak / 30) * 100,
    0,
    100,
  );

  const raw =
    fillerScore * 0.45 +
    metrics.paceConsistencyScore * 0.25 +
    vocabScore * 0.15 +
    cleanStreakScore * 0.15;

  // Short samples are noisy: blend toward neutral score.
  const confidence = clamp((wordCount - 20) / 80, 0, 1);
  const neutral = 60;
  return Math.round(raw * confidence + neutral * (1 - confidence));
}

function stabilizeOverallScore(llmScore: number, text: string): number {
  const deterministicScore = computeDeterministicQualityScore(text);

  // Anchor LLM score to deterministic metrics to reduce run-to-run variance.
  const blended = deterministicScore * 0.7 + llmScore * 0.3;
  return Math.round(clamp(blended, 0, 100));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFirstJsonObject(text: string): string | null {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let startIndex = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (braceCount === 0) startIndex = i;
      braceCount += 1;
    } else if (char === "}") {
      braceCount -= 1;
      if (braceCount === 0 && startIndex !== -1) {
        return text.substring(startIndex, i + 1);
      }
    }
  }

  return null;
}

function coerceAnalysisResult(raw: unknown): SpeechAnalysisResult {
  const data = raw as Partial<SpeechAnalysisResult> | null;
  if (!data || typeof data !== "object") {
    throw new Error("LLM response is not a JSON object");
  }

  const fillers = Array.isArray(data.fillers)
    ? data.fillers.filter((x): x is string => typeof x === "string")
    : [];
  const vagueLanguage = Array.isArray(data.vagueLanguage)
    ? data.vagueLanguage.filter((x): x is string => typeof x === "string")
    : [];
  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((x): x is string => typeof x === "string")
    : [];

  const scoreRaw = data.overall_score;
  const scoreNum =
    typeof scoreRaw === "number"
      ? scoreRaw
      : typeof scoreRaw === "string"
        ? Number(scoreRaw)
        : NaN;

  const details = typeof data.details === "string" ? data.details.trim() : "";

  if (!Number.isFinite(scoreNum)) {
    throw new Error("LLM response missing valid overall_score");
  }

  if (!details) {
    throw new Error("LLM response missing details");
  }

  return {
    fillers,
    vagueLanguage,
    suggestions,
    overall_score: Math.max(0, Math.min(100, Math.round(scoreNum))),
    details,
  };
}

const getApiKey = (): string => {
  return K2_CONFIG.API_KEY;
};

const getApiEndpoint = (): string => {
  return K2_CONFIG.API_ENDPOINT;
};

const getModelName = (): string => {
  return K2_CONFIG.MODEL;
};

/**
 * Analyzes speech/conversation text for bad habits using K2 Think V2 LLM
 * Identifies: filler words, vague language, and provides improvement suggestions
 */
export async function analyzeSpeechPatterns(
  speechText: string,
): Promise<SpeechAnalysisResult> {
  if (!speechText || speechText.trim().length === 0) {
    throw new Error("Please provide some speech text to analyze");
  }

  const apiKey = getApiKey();
  const endpoint = getApiEndpoint();
  const model = getModelName();

  console.log("Starting speech analysis...");
  console.log("Endpoint:", endpoint);
  console.log("Model:", model);
  console.log("API Key length:", apiKey.length);

  const systemPrompt =
    "You are a speech coach JSON API. Return one valid JSON object only. No markdown, no prose, no code fences.";

  const userPrompt = `Analyze this speech text for filler words, vague language, and overall quality. Output ONLY this JSON format with no other text:

{
  "fillers": ["um (2)", "like (1)"],
  "vagueLanguage": ["kind of", "sort of"],
  "suggestions": ["Reduce filler words", "Be more specific"],
  "overall_score": 65,
  "details": "Speech has some fillers and vague language but is generally clear."
}

Speech to analyze: "${speechText}"`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const isRetry = attempt > 0;
    if (isRetry) {
      console.log(
        `Retrying speech analysis (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
      );
      await delay(500 * attempt);
    }

    const requestBody = {
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content:
            userPrompt +
            (isRetry
              ? "\n\nIMPORTANT: previous response could not be parsed. Return a complete JSON object only."
              : ""),
        },
      ],
      stream: false,
      temperature: 0,
      max_tokens: 800,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      const responseText = await response.text();
      clearTimeout(timeoutId);

      console.log("Response received:", response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `API Error ${response.status}`;
        try {
          const errorData = JSON.parse(responseText) as {
            error?: { message?: string };
            message?: string;
          };
          errorMessage =
            errorData.error?.message || errorData.message
              ? `API Error ${response.status}: ${errorData.error?.message || errorData.message}`
              : `${errorMessage}: ${responseText}`;
        } catch {
          errorMessage = `${errorMessage}: ${responseText.substring(0, 250)}`;
        }

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(errorMessage);
          continue;
        }

        throw new Error(errorMessage);
      }

      let data: {
        choices?: Array<{
          finish_reason?: string;
          message?: {
            content?: string | Array<{ text?: string; type?: string }>;
          };
        }>;
      };

      try {
        data = JSON.parse(responseText) as typeof data;
      } catch {
        lastError = new Error(
          `API response is not valid JSON: ${responseText.substring(0, 200)}`,
        );
        continue;
      }

      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason ?? "";
      const rawContent = choice?.message?.content;
      const analysisContent =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent
                .map((part) =>
                  typeof part?.text === "string" ? part.text : "",
                )
                .join("")
            : "";

      if (!analysisContent.trim()) {
        lastError = new Error("API returned empty analysis content");
        continue;
      }

      if (finishReason === "length") {
        lastError = new Error("LLM response was truncated due to token limit");
        continue;
      }

      const cleaned = analysisContent
        .replace(/<[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();

      const jsonString = extractFirstJsonObject(cleaned);
      if (!jsonString) {
        lastError = new Error(
          `Could not extract complete JSON from model output: ${cleaned.substring(0, 200)}`,
        );
        continue;
      }

      try {
        const parsed = JSON.parse(jsonString);
        const analysis = coerceAnalysisResult(parsed);
        return {
          ...analysis,
          overall_score: stabilizeOverallScore(
            analysis.overall_score,
            speechText,
          ),
        };
      } catch (parseError) {
        lastError = new Error(
          `Failed to parse analysis JSON: ${
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error"
          }`,
        );
        continue;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(
          "Request timeout - the API server took too long to respond",
        );
      } else {
        lastError =
          error instanceof Error ? error : new Error("Unknown analysis error");
      }
    }
  }

  throw new Error(
    `Failed to analyze speech: ${lastError?.message || "Unknown error"}`,
  );
}

/**
 * Validates the API configuration
 */
export function validateApiConfiguration(): { valid: boolean; error?: string } {
  return validateConfig();
}
