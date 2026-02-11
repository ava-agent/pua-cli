import { describe, it, expect } from 'vitest';
import { getBossSystemMessage } from '../prompts/boss';

describe('prompts/boss', () => {
  describe('getBossSystemMessage', () => {
    it('should return mild template', () => {
      const prompt = getBossSystemMessage('mild');

      expect(prompt).toContain('喜欢说教但不严厉');
      expect(prompt).toContain('为你好');
    });

    it('should return medium template', () => {
      const prompt = getBossSystemMessage('medium');

      expect(prompt).toContain('典型职场 PUA 老板');
      expect(prompt).toContain('要对齐');
      expect(prompt).toContain('闭环');
    });

    it('should return extreme template', () => {
      const prompt = getBossSystemMessage('extreme');

      expect(prompt).toContain('极度挑剔');
      expect(prompt).toContain('刻薄');
      expect(prompt).toContain('巨婴');
    });

    it('should contain role-specific keywords', () => {
      const prompt = getBossSystemMessage('medium');

      expect(prompt).toMatch(/年轻人|锻炼|学习|提升/);
    });
  });
});
