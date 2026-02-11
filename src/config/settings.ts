import dotenv from 'dotenv';
import path from 'path';
import {
  loadGlobalConfig,
  loadProjectConfig,
  getProviderApiKey,
  getCurrentProvider,
  hasGlobalConfig,
  type GlobalConfig,
  type ProjectConfig,
} from './storage';
import { getProvider, validateApiKey, getApiKeyFromEnv, type ProviderType } from './providers';

// Load environment variables
dotenv.config();

export interface RuntimeConfig {
  apiKey: string;
  provider: ProviderType;
  model: string;
  role: 'boss' | 'employee';
  severity: 'mild' | 'medium' | 'extreme';
}

export const DEFAULTS = {
  provider: 'zhipu' as ProviderType,
  model: 'glm-4.7',
  role: 'boss' as 'boss' | 'employee',
  severity: 'medium' as 'mild' | 'medium' | 'extreme',
};

/**
 * Load configuration with priority:
 * 1. Command line options (highest)
 * 2. Environment variables
 * 3. Project config (.pua.json)
 * 4. Global config (~/.config/pua-cli/config.json)
 * 5. Defaults (lowest)
 */
export function loadConfig(options?: {
  provider?: ProviderType;
  model?: string;
  role?: 'boss' | 'employee';
  severity?: 'mild' | 'medium' | 'extreme';
  apiKey?: string;
}): RuntimeConfig {
  // Start with defaults
  let provider = DEFAULTS.provider;
  let model = DEFAULTS.model;
  let role = DEFAULTS.role;
  let severity = DEFAULTS.severity;
  let apiKey = '';

  // Load global config
  const globalConfig = loadGlobalConfig();

  // Load project config
  const projectConfig = loadProjectConfig();

  // Apply global config
  if (globalConfig) {
    provider = globalConfig.defaults.provider as ProviderType || provider;
    model = globalConfig.defaults.model || model;
    role = globalConfig.defaults.role as 'boss' | 'employee' || role;
    severity = globalConfig.defaults.severity as 'mild' | 'medium' | 'extreme' || severity;
    apiKey = globalConfig.providers[globalConfig.currentProvider]?.apiKey || '';
  }

  // Apply project config
  if (projectConfig) {
    if (projectConfig.provider) provider = projectConfig.provider as ProviderType;
    if (projectConfig.model) model = projectConfig.model;
    if (projectConfig.role) role = projectConfig.role as 'boss' | 'employee';
    if (projectConfig.severity) severity = projectConfig.severity as 'mild' | 'medium' | 'extreme';
  }

  // Apply environment variables
  const envApiKey = getApiKeyFromEnv(provider);
  if (envApiKey) {
    apiKey = envApiKey;
  }

  // Apply command line options (highest priority)
  if (options) {
    if (options.provider) provider = options.provider;
    if (options.model) model = options.model;
    if (options.role) role = options.role;
    if (options.severity) severity = options.severity;
    if (options.apiKey) apiKey = options.apiKey;
  }

  // Ensure API key is available
  if (!apiKey) {
    throw new MissingApiKeyError(provider);
  }

  return {
    apiKey,
    provider,
    model,
    role,
    severity,
  };
}

/**
 * Error thrown when API key is missing
 */
export class MissingApiKeyError extends Error {
  constructor(provider: ProviderType) {
    const providerDef = getProvider(provider);
    const envKey = providerDef?.envKeyNames[0] || 'API_KEY';

    super(
      `未找到 ${providerDef?.name || provider} 的 API Key\n\n` +
      `请使用以下方式之一配置：\n` +
      `  1. 运行: pua config\n` +
      `  2. 设置环境变量: export ${envKey}="your-api-key"\n` +
      `  3. 创建 .env 文件并添加: ${envKey}=your-api-key`
    );
    this.name = 'MissingApiKeyError';
  }
}

/**
 * Check if user needs onboarding
 */
export function needsOnboarding(): boolean {
  return !hasGlobalConfig();
}

/**
 * Get provider's base URL
 */
export function getProviderBaseUrl(provider: ProviderType): string {
  const globalConfig = loadGlobalConfig();
  const providerConfig = globalConfig?.providers[provider];

  if (providerConfig?.baseUrl) {
    return providerConfig.baseUrl;
  }

  const providerDef = getProvider(provider);
  return providerDef?.defaultBaseUrl || '';
}

/**
 * Get available models for a provider
 */
export function getProviderModels(provider: ProviderType): string[] {
  const globalConfig = loadGlobalConfig();
  const providerConfig = globalConfig?.providers[provider];

  if (providerConfig?.models && providerConfig.models.length > 0) {
    return providerConfig.models;
  }

  const providerDef = getProvider(provider);
  return providerDef?.defaultModels || [];
}

/**
 * Validate a config object
 */
export function validateConfig(config: RuntimeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate provider
  const providerDef = getProvider(config.provider);
  if (!providerDef) {
    errors.push(`无效的 provider: ${config.provider}`);
  }

  // Validate API key
  if (providerDef) {
    const keyValidation = validateApiKey(config.provider, config.apiKey);
    if (!keyValidation.valid) {
      errors.push(keyValidation.error || 'API Key 无效');
    }
  }

  // Validate model
  const availableModels = getProviderModels(config.provider);
  if (availableModels.length > 0 && !availableModels.includes(config.model)) {
    errors.push(
      `模型 ${config.model} 在 provider ${config.provider} 中不可用。可用模型: ${availableModels.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
