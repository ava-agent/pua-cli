export type ProviderType = 'zhipu' | 'openai';

export interface ProviderDefinition {
  id: ProviderType;
  name: string;
  description: string;
  defaultBaseUrl: string;
  defaultModels: string[];
  envKeyNames: string[];
}

export const PROVIDERS: Record<ProviderType, ProviderDefinition> = {
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI',
    description: '国产大模型，稳定可靠，响应快速',
    defaultBaseUrl: '',
    defaultModels: ['glm-4.7', 'glm-4.7-flash'],
    envKeyNames: ['ZHIPUAI_API_KEY'],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: '国际通用，支持 GPT-4o、GPT-4o-mini 等模型',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    envKeyNames: ['OPENAI_API_KEY'],
  },
};

/**
 * Get provider definition by ID
 */
export function getProvider(id: string): ProviderDefinition | null {
  return PROVIDERS[id as ProviderType] ?? null;
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): ProviderType[] {
  return Object.keys(PROVIDERS) as ProviderType[];
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKey(provider: ProviderType, apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API Key 不能为空' };
  }

  // Provider-specific validation
  switch (provider) {
    case 'zhipu':
      // 智谱 API key 通常以特定格式开头
      if (apiKey.length < 10) {
        return { valid: false, error: '智谱 API Key 格式不正确（太短）' };
      }
      break;

    case 'openai':
      // OpenAI API key 通常以 sk- 开头
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API Key 通常以 sk- 开头' };
      }
      if (apiKey.length < 20) {
        return { valid: false, error: 'OpenAI API Key 格式不正确（太短）' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate base URL format
 */
export function validateBaseUrl(baseUrl: string): { valid: boolean; error?: string } {
  if (!baseUrl || baseUrl.trim().length === 0) {
    return { valid: true }; // Empty is OK (will use default)
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { valid: false, error: 'Base URL 必须以 http:// 或 https:// 开头' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Base URL 格式不正确' };
  }
}

/**
 * Get API key from environment variables
 */
export function getApiKeyFromEnv(provider: ProviderType): string | null {
  const providerDef = PROVIDERS[provider];

  for (const envKey of providerDef.envKeyNames) {
    const value = process.env[envKey];
    if (value) {
      return value;
    }
  }

  return null;
}
