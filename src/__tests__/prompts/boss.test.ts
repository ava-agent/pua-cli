import { describe, it, expect } from 'vitest';
import { getBossSystemMessage } from '../../prompts/boss';

describe('prompts/boss', () => {
  describe('getBossSystemMessage', () => {
    it('should return mild template', () => {
      const prompt = getBossSystemMessage('mild');

      expect(prompt).toContain('语气稍微委婉');
      expect(prompt).toContain('为你好');
    });

    it('should return medium template', () => {
      const prompt = getBossSystemMessage('medium');

      expect(prompt).toContain('典型的 PUA 风格');
      expect(prompt).toContain('对齐');
      expect(prompt).toContain('抓手');
    });

    it('should return extreme template', () => {
      const prompt = getBossSystemMessage('extreme');

      expect(prompt).toContain('语气极其严厉');
      expect(prompt).toContain('讽刺');
      expect(prompt).toContain('人身攻击');
    });

    it('should contain role-specific keywords', () => {
      const prompt = getBossSystemMessage('medium');

      expect(prompt).toMatch(/年轻人|锻炼|学习|提升/);
    });
  });
});
