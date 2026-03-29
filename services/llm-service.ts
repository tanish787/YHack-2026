import { K2_CONFIG, validateConfig } from '@/config/k2-config';
import type { CorrectionFocusId } from '@/constants/speech-coach';
import type { ImprovementGoalId, ProficiencyLevel } from '@/constants/user-profile';
import { IMPROVEMENT_GOALS } from '@/constants/user-profile';

interface SpeechAnalysisResult {
  fillers: string[];
  vagueLanguage: string[];
  suggestions: string[];
  overall_score: number;
  details: string;
}

interface LLMRequest {
  text: string;
}

interface LLMResponse {
  analysis: SpeechAnalysisResult;
  error?: string;
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
    overall_score: typeof obj?.overall_score === 'number' ? Math.min(100, Math.max(0, obj.overall_score)) : 50,
    details: typeof obj?.details === 'string' ? obj.details : 'Analysis complete.',
  };
}

/**
 * Extract JSON from text using multiple strategies
 */
function extractValidJSON(text: string): any | null {
  console.log('🔍 Attempting JSON extraction...');
  
  // Strategy 1: Try parsing entire text as JSON
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'overall_score' in parsed) {
      console.log('✓ Strategy 1: Entire response is valid JSON');
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
      if (parsed && typeof parsed === 'object' && 'overall_score' in parsed) {
        console.log('✓ Strategy 2: Found JSON in code block');
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

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          objectStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && objectStart !== -1) {
          const candidate = text.substring(objectStart, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') {
              jsonObjects.push(parsed);
            }
          } catch (e) {
            // This object is malformed, try to repair it
            try {
              const repaired = candidate
                .replace(/,(\s*[}\]])/g, '$1') // trailing commas
                .replace(/([^"\\])'"([^"\\]|$)/g, '$1"$2') // single quotes
                .replace(/:\s*undefined/g, ': null') // undefined -> null
                .replace(/,\s*}/g, '}'); // trailing comma before }
              const parsed = JSON.parse(repaired);
              if (parsed && typeof parsed === 'object') {
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
    if ('overall_score' in obj) {
      console.log('✓ Strategy 3: Extracted valid JSON object');
      return obj;
    }
  }

  // If we found any objects, return the first one (might be missing fields but we'll validate)
  if (jsonObjects.length > 0) {
    console.log('✓ Strategy 3 (fallback): Using first extracted object');
    return jsonObjects[0];
  }

  console.log('❌ No valid JSON found in text');
  return null;
}

/**
 * Generate a customized prompt based on the correction focus and user profile
 */
function getCustomizedPrompt(
  speechText: string,
  focusId: CorrectionFocusId,
  proficiencyLevel?: ProficiencyLevel,
  improvementGoals?: ImprovementGoalId[]
): string {
  const baseFormat = `{"fillers":["um (2)","like (1)"],"vagueLanguage":["kind of","sort of"],"suggestions":["Reduce filler words","Be more specific"],"overall_score":65,"details":"Speech has some fillers and vague language but is generally clear."}`;
  
  // Build proficiency context
  const proficiencyContext = proficiencyLevel ? 
    `User's English Proficiency Level: ${proficiencyLevel} (${getProficiencyDescription(proficiencyLevel)})\n` : '';
  
  // Build goals context
  const goalsContext = improvementGoals && improvementGoals.length > 0 ?
    `User's Selected Improvement Goals:\n${improvementGoals.map(goalId => {
      const goal = IMPROVEMENT_GOALS.find(g => g.id === goalId);
      return `- ${goal?.title}: ${goal?.description}`;
    }).join('\n')}\n` : '';
  
  // Context instruction
  const contextInstruction = (proficiencyContext || goalsContext) ?
    `\nCONTEXT:\n${proficiencyContext}${goalsContext}\nTailor your feedback considering their proficiency level and goals. Be encouraging and constructive.\n` : '';

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
    beginner: 'Learning fundamentals, building confidence',
    intermediate: 'Conversational, with room for refinement',
    advanced: 'Near-native proficiency with subtle details to refine',
    native: 'Native speaker optimizing communication style',
  };
  return descriptions[level] || 'Unknown proficiency level';
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
  focusId: CorrectionFocusId = 'fillers',
  proficiencyLevel?: ProficiencyLevel,
  improvementGoals?: ImprovementGoalId[]
): Promise<SpeechAnalysisResult> {
  if (!speechText || speechText.trim().length === 0) {
    throw new Error('Please provide some speech text to analyze');
  }

  try {
    const apiKey = getApiKey();
    const endpoint = getApiEndpoint();
    const model = getModelName();

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║        SPEECH ANALYSIS - API CALL INITIATED          ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`📝 Text Length: ${speechText.length} characters`);
    console.log(`🎯 Focus Type: ${focusId}`);
    console.log(`👤 Proficiency Level: ${proficiencyLevel || 'not specified'}`);
    console.log(`🎯 Improvement Goals: ${improvementGoals?.length || 0} selected`);
    console.log(`🔗 API Endpoint: ${endpoint}`);
    console.log(`🤖 Model: ${model}`);
    console.log(`🔐 API Key present: ${apiKey.length > 0 ? '✓' : '✗'}`);

    const systemPrompt = `You MUST output ONLY valid JSON. No explanations, no preamble, no code blocks, no additional text. Start with { and end with }. If asked to use JSON, respond ONLY with the JSON object itself.`;

    const userPrompt = getCustomizedPrompt(speechText, focusId, proficiencyLevel, improvementGoals);
    
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`\n💬 User Prompt:\n${userPrompt.substring(0, 200)}...`);
    }

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      stream: false,
    };

    console.log('\n📤 Sending request to API...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      let errorMessage = `API Error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `API Error ${response.status}: ${errorData.error?.message || errorData.message || errorText}`;
      } catch (e) {
        errorMessage = `API Error ${response.status}: ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    let data;
    try {
      data = await response.json();
      console.log('✓ API Response parsed successfully');
    } catch (e) {
      const responseText = await response.text();
      console.error('Failed to parse API response as JSON');
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error(`API Response is not valid JSON. Response: ${responseText.substring(0, 200)}`);
    }

    // Extract the analysis from the response
    let analysisContent = data.choices?.[0]?.message?.content || '';

    console.log(`Analysis content length: ${analysisContent.length} characters`);

    if (!analysisContent) {
      console.error('No analysis content in API response');
      console.error('Full response structure:', JSON.stringify(data));
      throw new Error('API returned empty content. Check logs for full response.');
    }

    // Clean up HTML tags and other problematic characters
    analysisContent = analysisContent
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')    // Convert HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();

    console.log(`🔍 Raw response (first 500 chars): ${analysisContent.substring(0, 500)}`);

    // Use the new extraction function
    const extractedObj = extractValidJSON(analysisContent);
    
    if (!extractedObj) {
      console.warn('⚠️ Could not extract valid JSON, using fallback response');
    } else {
      console.log(`✓ Successfully extracted JSON object`);
    }

    // Normalize and validate the analysis result
    const analysis = validateAndNormalizeAnalysis(extractedObj || {});
    
    console.log('✓ Analysis normalized');
    console.log(`\n📊 Results for "${focusId}" focus:`);
    console.log(`   • Overall Score: ${analysis.overall_score}`);
    console.log(`   • Fillers Found: ${analysis.fillers?.length || 0}`);
    console.log(`   • Suggestions: ${analysis.suggestions?.length || 0}`);
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    return analysis;
  } catch (error) {
    console.error('❌ Outer catch error:', error);
    
    // For timeout errors, still throw as those are critical
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Request timeout');
      throw new Error('Request timeout - the API server took too long to respond');
    }
    
    // For network errors, throw them too
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      console.error('Network error');
      throw new Error('Network error - could not connect to the AI service');
    }
    
    // For all other errors, log and return fallback
    console.warn('⚠️ Returning fallback response due to error:', error);
    return {
      overall_score: 50,
      fillers: [],
      vagueLanguage: [],
      suggestions: ['Analysis complete. Please check the app logs for details.'],
      details: 'The analysis encountered an issue but your speech was processed. Try analyzing again for detailed feedback.',
    };
  }
}

/**
 * Validates the API configuration
 */
export function validateApiConfiguration(): { valid: boolean; error?: string } {
  return validateConfig();
}
