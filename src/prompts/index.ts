// Boss
export { getBossPrompt, getBossSystemMessage } from './boss';

// Employee
export { getEmployeePrompt, getEmployeeSystemMessage } from './employee';

// PM
export { getPMSystemMessage, getPMUserMessage } from './pm';

// HR
export { getHRSystemMessage, getHRUserMessage } from './hr';

// Tech Lead
export { getTechLeadSystemMessage, getTechLeadUserMessage } from './techlead';

// Intern
export { getInternSystemMessage, getInternUserMessage } from './intern';

// 类型导出
export type { PromptConfig } from './boss';

/**
 * 所有角色类型
 */
export type RoleType = 'boss' | 'employee' | 'pm' | 'hr' | 'techlead' | 'intern';

/**
 * 角色颜色映射（用于终端输出）
 */
export const ROLE_COLORS: Record<RoleType, string> = {
  boss: 'red',
  employee: 'yellow',
  pm: 'cyan',
  hr: 'magenta',
  techlead: 'blue',
  intern: 'green'
};

/**
 * 角色表情符号
 */
export const ROLE_EMOJIS: Record<RoleType, string> = {
  boss: '👔',
  employee: '👤',
  pm: '📊',
  hr: '💼',
  techlead: '💻',
  intern: '🌱'
};

/**
 * 角色中文名称
 */
export const ROLE_NAMES: Record<RoleType, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生'
};

/**
 * 获取角色系统消息
 */
export function getRoleSystemMessage(role: RoleType, config?: any): string {
  const severity = config?.severity || 'medium';
  const promptConfig = { severity, ...config };

  switch (role) {
    case 'boss':
      const { getBossSystemMessage } = require('./boss');
      return getBossSystemMessage(promptConfig);
    case 'employee':
      const { getEmployeeSystemMessage } = require('./employee');
      return getEmployeeSystemMessage(promptConfig);
    case 'pm':
      const { getPMSystemMessage } = require('./pm');
      return getPMSystemMessage(promptConfig);
    case 'hr':
      const { getHRSystemMessage } = require('./hr');
      return getHRSystemMessage(promptConfig);
    case 'techlead':
      const { getTechLeadSystemMessage } = require('./techlead');
      return getTechLeadSystemMessage(promptConfig);
    case 'intern':
      const { getInternSystemMessage } = require('./intern');
      return getInternSystemMessage(promptConfig);
    default:
      return getBossSystemMessage(promptConfig);
  }
}
