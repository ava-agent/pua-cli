import os from 'os';
import path from 'path';
import fs from 'fs';
import type { RoleType } from '../prompts';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  models: string[];
}

export interface GlobalConfig {
  currentProvider: string;
  providers: {
    [key: string]: ProviderConfig;
  };
  defaults: {
    provider: string;
    model: string;
    role: RoleType;
    severity: 'mild' | 'medium' | 'extreme';
  };
  onboardingCompleted: boolean;
}

export interface ProjectConfig {
  provider?: string;
  model?: string;
  role?: RoleType;
  severity?: 'mild' | 'medium' | 'extreme';
}

/**
 * Get the config directory path following XDG Base Directory Specification
 */
export function getConfigDir(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: %APPDATA%\pua-cli
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pua-cli');
  } else {
    // Linux/macOS: ~/.config/pua-cli
    return path.join(os.homedir(), '.config', 'pua-cli');
  }
}

/**
 * Get the global config file path
 */
export function getGlobalConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Get the project config file path
 */
export function getProjectConfigPath(): string {
  return path.join(process.cwd(), '.pua.json');
}

/**
 * Ensure config directory exists
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Load global config from file
 */
export function loadGlobalConfig(): GlobalConfig | null {
  const configPath = getGlobalConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as GlobalConfig;
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save global config to file
 */
export function saveGlobalConfig(config: GlobalConfig): void {
  ensureConfigDir();
  const configPath = getGlobalConfigPath();

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save config to ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Load project config from file
 */
export function loadProjectConfig(): ProjectConfig | null {
  const configPath = getProjectConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch (error) {
    throw new Error(`Failed to load project config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if global config exists
 */
export function hasGlobalConfig(): boolean {
  return fs.existsSync(getGlobalConfigPath());
}

/**
 * Check if onboarding has been completed
 */
export function isOnboardingCompleted(): boolean {
  const config = loadGlobalConfig();
  return config?.onboardingCompleted ?? false;
}

/**
 * Get API key for a provider from config
 */
export function getProviderApiKey(provider: string): string | null {
  const config = loadGlobalConfig();
  return config?.providers[provider]?.apiKey ?? null;
}

/**
 * Get current provider
 */
export function getCurrentProvider(): string | null {
  const config = loadGlobalConfig();
  return config?.currentProvider ?? null;
}
