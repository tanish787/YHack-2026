import { K2_CONFIG, validateConfig } from "@/config/k2-config";
import type { CorrectionFocusId, PracticeContextId } from "@/constants/speech-coach";
import type {
  ImprovementGoalId,
  ProficiencyLevel,
} from "@/constants/user-profile";
import { IMPROVEMENT_GOALS } from "@/constants/user-profile";
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

/**
 * Safely extract and validate fields from a parsed JSON object
 */
function validateAndNormalizeAnalysis(obj: any): SpeechAnalysisResult {
  // Ensure all required fields exist with correct types
  return {
    fillers: Array.isArray(obj?.fillers) ? obj.fillers : [],
    vagueLanguage: Array.isArray(obj?.vagueLanguage) ? obj.vagueLanguage : [],
    suggestions: Array.isArray(obj?.suggestions) ? obj.suggestions : [],
    overall_score:
      typeof obj?.overall_score === "number"
        ? Math.min(100, Math.max(0, obj.overall_score))
        : 50,
    details:
      typeof obj?.details === "string" ? obj.details : "Analysis complete.",
  };
}

/**
 * Extract JSON from text using multiple strategies
 */
function extractValidJSON(text: string): any | null {
  console.log("🔍 Attempting JSON extraction...");

  // Strategy 1: Try parsing entire text as JSON
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "overall_score" in parsed) {
      console.log("✓ Strategy 1: Entire response is valid JSON");
      return parsed;
    }
  } catch (e) {
    // Continue to next strategy
  }

  // Strategy 2: Extract from code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === "object" && "overall_score" in parsed) {
        console.log("✓ Strategy 2: Found JSON in code block");
        return parsed;
      }
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find and extract the first valid JSON object
  const jsonObjects: any[] = [];
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let objectStart = -1;

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

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        if (braceCount === 0) {
          objectStart = i;
        }
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0 && objectStart !== -1) {
          const candidate = text.substring(objectStart, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object") {
              jsonObjects.push(parsed);
            }
          } catch (e) {
            // This object is malformed, try to repair it
            try {
              const repaired = candidate
                .replace(/,(\s*[}\]])/g, "$1") // trailing commas
                .replace(/([^"\\])'"([^"\\]|$)/g, '$1"$2') // single quotes
                .replace(/:\s*undefined/g, ": null") // undefined -> null
                .replace(/,\s*}/g, "}"); // trailing comma before }
              const parsed = JSON.parse(repaired);
              if (parsed && typeof parsed === "object") {
                jsonObjects.push(parsed);
              }
            } catch (e2) {
              // Skip this malformed object
            }
          }
        }
      }
    }
  }

  // Return first valid object that has the required field
  for (const obj of jsonObjects) {
    if ("overall_score" in obj) {
      console.log("✓ Strategy 3: Extracted valid JSON object");
      return obj;
    }
  }

  // If we found any objects, return the first one (might be missing fields but we'll validate)
  if (jsonObjects.length > 0) {
    console.log("✓ Strategy 3 (fallback): Using first extracted object");
    return jsonObjects[0];
  }

  console.log("❌ No valid JSON found in text");
  return null;
}

/**
 * Generate a customized prompt based on the correction focus and user profile
 */
function getCustomizedPrompt(
  speechText: string,
  focusId: CorrectionFocusId,
  proficiencyLevel?: ProficiencyLevel,
  improvementGoals?: ImprovementGoalId[],
  age?: number,
  practiceContext?: PracticeContextId,
): string {
  const baseFormat = `{"fillers":["um (2)","like (1)"],"vagueLanguage":["kind of","sort of"],"suggestions":["Reduce filler words","Be more specific"],"overall_score":65,"details":"Speech has some fillers and vague language but is generally clear."}`;

  // Build proficiency context
  const proficiencyContext = proficiencyLevel
    ? `User's English Proficiency Level: ${proficiencyLevel} (${getProficiencyDescription(proficiencyLevel)})\n`
    : "";

  // Build goals context
  const goalsContext =
    improvementGoals && improvementGoals.length > 0
      ? `User's Selected Improvement Goals:\n${improvementGoals
          .map((goalId) => {
            const goal = IMPROVEMENT_GOALS.find((g) => g.id === goalId);
            return `- ${goal?.title}: ${goal?.description}`;
          })
          .join("\n")}\n`
      : "";

  // Build age context
  const ageContext =
    typeof age === "number" ? `User's Age: ${Math.round(age)}\n` : "";

  const practiceContextText = practiceContext
    ? `Current Practice Scenario: ${getPracticeContextDescription(practiceContext)}\n`
    : "";

  // Context instruction
  const contextInstruction =
    proficiencyContext || goalsContext || ageContext || practiceContextText
      ? `\nCONTEXT:\n${proficiencyContext}${goalsContext}${ageContext}${practiceContextText}\nTailor your feedback considering their proficiency level, goals, age, and current practice scenario. Be encouraging and constructive.\n`
      : "";

  const focusPrompts: Record<CorrectionFocusId, string> = {
    fillers: `TASK: Analyze this speech for filler words ONLY.
REQUIRED: Output valid JSON with these exact fields: fillers, vagueLanguage, suggestions, overall_score, details
CRITICAL: Output ONLY the JSON object. No explanations, no preamble, no code blocks. Start with { and end with }

Example format:
${baseFormat}
${contextInstruction}
Text: "${speechText}"`,

    pacing: `TASK: Analyze this speech for pacing and wordiness ONLY.
REQUIRED: Output valid JSON with these exact fields: fillers, vagueLanguage, suggestions, overall_score, details
CRITICAL: Output ONLY the JSON object. No explanations, no preamble, no code blocks. Start with { and end with }

Example format:
${baseFormat}
${contextInstruction}
Text: "${speechText}"`,

    hedging: `TASK: Analyze this speech for hedging and vague language ONLY.
REQUIRED: Output valid JSON with these exact fields: fillers, vagueLanguage, suggestions, overall_score, details
CRITICAL: Output ONLY the JSON object. No explanations, no preamble, no code blocks. Start with { and end with }

Example format:
${baseFormat}
${contextInstruction}
Text: "${speechText}"`,

    repetition: `TASK: Analyze this speech for repetition and redundancy ONLY.
REQUIRED: Output valid JSON with these exact fields: fillers, vagueLanguage, suggestions, overall_score, details
CRITICAL: Output ONLY the JSON object. No explanations, no preamble, no code blocks. Start with { and end with }

Example format:
${baseFormat}
${contextInstruction}
Text: "${speechText}"`,
  };

  return focusPrompts[focusId];
}

/**
 * Get human-readable description of proficiency level
 */
function getProficiencyDescription(level: ProficiencyLevel): string {
  const descriptions: Record<ProficiencyLevel, string> = {
    beginner: "Learning fundamentals, building confidence",
    intermediate: "Conversational, with room for refinement",
    advanced: "Near-native proficiency with subtle details to refine",
    native: "Native speaker optimizing communication style",
  };
  return descriptions[level] || "Unknown proficiency level";
}

function getPracticeContextDescription(context: PracticeContextId): string {
  const descriptions: Record<PracticeContextId, string> = {
    presentation: "Presentation to a group or class",
    interview: "Mock interview practice",
    meeting: "Work meeting updates and Q&A",
    conversation: "Everyday conversation practice",
  };
  return descriptions[context];
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
 * Customizes analysis based on the selected correction focus and user profile
 */
export async function analyzeSpeechPatterns(
  speechText: string,
  focusId: CorrectionFocusId = "fillers",
  proficiencyLevel?: ProficiencyLevel,
  improvementGoals?: ImprovementGoalId[],
  age?: number,
  practiceContext?: PracticeContextId,
): Promise<SpeechAnalysisResult> {
  if (!speechText || speechText.trim().length === 0) {
    throw new Error("Please provide some speech text to analyze");
  }

  const apiKey = getApiKey();
  const endpoint = getApiEndpoint();
  const model = getModelName();

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║        SPEECH ANALYSIS - API CALL INITIATED          ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`📝 Text Length: ${speechText.length} characters`);
  console.log(`🎯 Focus Type: ${focusId}`);
  console.log(`👤 Proficiency Level: ${proficiencyLevel || "not specified"}`);
  console.log(
    `🎯 Improvement Goals: ${improvementGoals?.length || 0} selected`,
  );
  console.log(`🔗 API Endpoint: ${endpoint}`);
  console.log(`🤖 Model: ${model}`);
  console.log(`🔐 API Key present: ${apiKey.length > 0 ? "✓" : "✗"}`);

  const systemPrompt = `You MUST output ONLY valid JSON. No explanations, no preamble, no code blocks, no additional text. Start with { and end with }. If asked to use JSON, respond ONLY with the JSON object itself.`;

  const userPrompt = getCustomizedPrompt(
    speechText,
    focusId,
    proficiencyLevel,
    improvementGoals,
    age,
    practiceContext,
  );

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log(`\n💬 User Prompt:\n${userPrompt.substring(0, 200)}...`);
  }

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

    console.log("\n📤 Sending request to API...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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

    clearTimeout(timeoutId);

    console.log(
      `📥 Response Status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      let errorMessage = `API Error: ${response.status}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `API Error ${response.status}: ${errorData.error?.message || errorData.message || errorText}`;
      } catch (e) {
        errorMessage = `API Error ${response.status}: ${errorText}`;
      }

      throw new Error(errorMessage);
    }

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
