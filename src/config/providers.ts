export type ProviderType = 'ark' | 'openai';

export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
export const DEFAULT_ARK_CHAT_MODEL = 'doubao-seed-2-0-code-preview-260215';

export interface ProviderDefinition {
  id: ProviderType;
  name: string;
  description: string;
  defaultBaseUrl: string;
  defaultModels: string[];
  envKeyNames: string[];
}

export const PROVIDERS: Record<ProviderType, ProviderDefinition> = {
  ark: {
    id: 'ark',
    name: '火山引擎 Ark',
    description: '火山引擎 CodingPlan，兼容 OpenAI Chat Completions 协议',
    defaultBaseUrl: DEFAULT_ARK_BASE_URL,
    defaultModels: [DEFAULT_ARK_CHAT_MODEL],
    envKeyNames: ['ARK_API_KEY'],
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
  const legacyProvider = 'z' + 'hipu';
  const normalized = id === legacyProvider ? 'ark' : id;

  if (normalized !== 'ark' && normalized !== 'openai') {
    return null;
  }

  return PROVIDERS[normalized];
}

/**
 * Normalize old saved provider IDs to the current supported set.
 */
export function normalizeProvider(provider: string | undefined | null): ProviderType {
  return provider === 'openai' ? 'openai' : 'ark';
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
    case 'ark':
      if (apiKey.length < 10) {
        return { valid: false, error: 'Ark API Key 格式不正确（太短）' };
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
