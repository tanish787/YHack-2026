import { K2_CONFIG, validateConfig } from '@/config/k2-config';

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
  speechText: string
): Promise<SpeechAnalysisResult> {
  if (!speechText || speechText.trim().length === 0) {
    throw new Error('Please provide some speech text to analyze');
  }

  try {
    const apiKey = getApiKey();
    const endpoint = getApiEndpoint();
    const model = getModelName();

    console.log('Starting speech analysis...');
    console.log('Endpoint:', endpoint);
    console.log('Model:', model);
    console.log('API Key length:', apiKey.length);

    const systemPrompt = `You are a JSON generator. Your only task is to output valid JSON objects. Never output text, explanations, or anything else.`;

    const userPrompt = `Analyze this speech text for filler words, vague language, and overall quality. Output ONLY this JSON format with no other text:

{
  "fillers": ["um (2)", "like (1)"],
  "vagueLanguage": ["kind of", "sort of"],
  "suggestions": ["Reduce filler words", "Be more specific"],
  "overall_score": 65,
  "details": "Speech has some fillers and vague language but is generally clear."
}

Speech to analyze: "${speechText}"`;

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: systemPrompt + '\n\n' + userPrompt,
        },
      ],
      stream: false,
    };

    console.log('Request body prepared, sending to API...');

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

    console.log('Response received:', response.status, response.statusText);

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
      console.log('API Response parsed successfully');
      console.log('Full API response:', JSON.stringify(data).substring(0, 500));
    } catch (e) {
      const responseText = await response.text();
      console.error('Failed to parse API response as JSON');
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error(`API Response is not valid JSON. Response: ${responseText.substring(0, 200)}`);
    }

    // Extract the analysis from the response
    let analysisContent = data.choices?.[0]?.message?.content || '';

    console.log('Analysis content length:', analysisContent.length);

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

    console.log('Cleaned analysis content (first 300 chars):', analysisContent.substring(0, 300));

    // Parse the JSON response - extract ONLY the first complete JSON object
    let jsonString: string | null = null;
    
    // Function to extract the first complete JSON object by tracking braces
    const extractFirstJsonObject = (text: string): string | null => {
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
              startIndex = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
              // Found a complete JSON object
              return text.substring(startIndex, i + 1);
            }
          }
        }
      }

      return null; // No complete JSON object found
    };

    jsonString = extractFirstJsonObject(analysisContent);

    if (!jsonString) {
      console.error('Could not extract JSON from response:', analysisContent.substring(0, 500));
      throw new Error(`Invalid API response format. Response: ${analysisContent.substring(0, 300)}`);
    }

    console.log('Extracted JSON string (first 300 chars):', jsonString.substring(0, 300));

    // Try to parse the JSON
    let analysis: SpeechAnalysisResult;
    try {
      analysis = JSON.parse(jsonString);
      console.log('Analysis parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse extracted JSON');
      console.error('JSON String:', jsonString.substring(0, 500));
      throw new Error(`Failed to parse speech analysis JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    return analysis;
  } catch (error) {
    console.error('Full error:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - the API server took too long to respond');
      }
      throw new Error(`Failed to analyze speech: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates the API configuration
 */
export function validateApiConfiguration(): { valid: boolean; error?: string } {
  return validateConfig();
}
