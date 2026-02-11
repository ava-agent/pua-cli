import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, DEFAULTS, type ProviderType } from '../config/settings';

describe('config/settings', () => {
  beforeEach(() => {
    // 清除环境变量
    delete process.env.ZHIPUAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe('loadConfig', () => {
    it('should return defaults when no config exists', () => {
      const config = loadConfig({});

      expect(config.provider).toBe(DEFAULTS.provider);
      expect(config.model).toBe(DEFAULTS.model);
      expect(config.role).toBe(DEFAULTS.role);
    });

    it('should prioritize CLI options over env vars', () => {
      process.env.ZHIPUAI_API_KEY = 'env-key';

      const config = loadConfig({
        apiKey: 'cli-key',
        provider: 'zhipu' as ProviderType
      } as any);

      expect(config.apiKey).toBe('cli-key');
    });

    it('should load from environment variables', () => {
      process.env.ZHIPUAI_API_KEY = 'test-key';

      const config = loadConfig({});

      expect(config.apiKey).toBe('test-key');
    });
  });

  describe('DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(DEFAULTS.provider).toBe('zhipu');
      expect(DEFAULTS.model).toBe('glm-4.7');
      expect(DEFAULTS.role).toBe('boss');
      expect(DEFAULTS.severity).toBe('medium');
    });
  });
});
