import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, DEFAULTS, type ProviderType } from '../../config/settings';

describe('config/settings', () => {
  beforeEach(() => {
    // 清除环境变量
    delete process.env.ARK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  describe('loadConfig', () => {
    it('should return defaults when an api key is provided', () => {
      const config = loadConfig({ apiKey: 'test-key' });

      expect(config.provider).toBe(DEFAULTS.provider);
      expect(config.model).toBe(DEFAULTS.model);
      expect(config.role).toBe(DEFAULTS.role);
      expect(config.apiKey).toBe('test-key');
    });

    it('should prioritize CLI options over env vars', () => {
      process.env.ARK_API_KEY = 'env-key';

      const config = loadConfig({
        apiKey: 'cli-key',
        provider: 'ark' as ProviderType
      } as any);

      expect(config.apiKey).toBe('cli-key');
    });

    it('should load from environment variables', () => {
      process.env.ARK_API_KEY = 'test-key';

      const config = loadConfig({});

      expect(config.apiKey).toBe('test-key');
    });
  });

  describe('DEFAULTS', () => {
    it('should have correct default values', () => {
      expect(DEFAULTS.provider).toBe('ark');
      expect(DEFAULTS.model).toBe('doubao-seed-2-0-code-preview-260215');
      expect(DEFAULTS.role).toBe('boss');
      expect(DEFAULTS.severity).toBe('medium');
    });
  });
});
