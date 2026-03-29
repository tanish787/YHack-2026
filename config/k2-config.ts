/**
 * K2 Think V2 API Configuration
 * This module provides direct access to API configuration values
 * that are properly loaded from environment variables
 */

// API Configuration - Update these directly until env vars work properly
export const K2_CONFIG = {
  API_KEY: 'IFM-trCsTI2qWWOwHhOP',
  API_ENDPOINT: 'https://api.k2think.ai/v1/chat/completions',
  MODEL: 'MBZUAI-IFM/K2-Think-v2',
} as const;

/**
 * Validate that all required config values are present
 */
export function validateConfig(): { valid: boolean; error?: string } {
  if (!K2_CONFIG.API_KEY) {
    return { valid: false, error: 'API key not configured' };
  }
  if (!K2_CONFIG.API_ENDPOINT) {
    return { valid: false, error: 'API endpoint not configured' };
  }
  if (!K2_CONFIG.MODEL) {
    return { valid: false, error: 'Model not configured' };
  }
  return { valid: true };
}

/**
 * Get a config value with validation
 */
export function getConfigValue<K extends keyof typeof K2_CONFIG>(
  key: K
): typeof K2_CONFIG[K] {
  const value = K2_CONFIG[key];
  if (!value) {
    throw new Error(`Configuration value for ${key} is not set`);
  }
  return value;
}
