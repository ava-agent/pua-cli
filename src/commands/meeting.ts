/**
 * 会议发言建议生成器
 * 功能：使用 AI 根据不同会议场景和角色生成会议发言建议
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { loadConfig, getProviderBaseUrl } from '../config/settings';
import type { RoleType } from '../prompts';

export interface MeetingOptions {
  role: RoleType;
  scenario: 'standup' | 'review' | 'brainstorm' | 'retro' | 'planning';
}

const ROLE_NAMES: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

const SCENARIO_NAMES: Record<string, { name: string; desc: string; duration: string }> = {
  standup: { name: '每日站会', desc: '快速同步工作进展和计划', duration: '15分钟' },
  review: { name: '评审会议', desc: '方案评审/代码评审/产品评审', duration: '30-60分钟' },
  brainstorm: { name: '头脑风暴', desc: '创意发散和方案讨论', duration: '30-90分钟' },
  retro: { name: '回顾会议', desc: '总结经验教训和改进点', duration: '60分钟' },
  planning: { name: '规划会议', desc: '迭代规划和任务分配', duration: '60分钟' },
};

const ROLE_MEETING_PROMPTS: Record<string, string> = {
  boss: '你是老板/总经理。发言风格：喜欢画饼，用"格局""赋能""战略"等词。表面鼓励实则PUA，暗示员工做得不够好。喜欢说"想当年我..."',
  employee: '你是普通员工/打工人。发言风格：卑微谨慎，怕说错话。用"我觉得""可能""或许"等不确定词。随时准备被打断。',
  pm: '你是产品经理。发言风格：大量使用"对齐""闭环""赋能""抓手""颗粒度"等黑话。善于甩锅给开发，把改需求说成"优化体验"。',
  hr: '你是HR。发言风格：打感情牌，强调企业文化和团队氛围。把负面消息包装成正能量。善用"家""成长""机会"等词。',
  techlead: '你是技术主管/架构师。发言风格：质疑一切技术方案，认为只有自己能写好代码。大量使用技术术语，暗示别人代码质量差。',
  intern: '你是实习生。发言风格：极度卑微，疯狂感谢前辈。不敢表达意见，每句话都以"学习了""受教了"结尾。',
};

/**
 * 使用 AI 生成会议发言建议
 */
async function generateWithAI(
  role: RoleType,
  scenario: string,
  context: string,
  config: { apiKey: string; provider: any; model: string }
): Promise<string> {
  const llm = createLLM(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: getProviderBaseUrl(config.provider),
  });

  const rolePrompt = ROLE_MEETING_PROMPTS[role] || ROLE_MEETING_PROMPTS.boss;
  const scenarioInfo = SCENARIO_NAMES[scenario] || SCENARIO_NAMES.standup;

  const userContent = context
    ? `会议场景：${scenarioInfo.name}（${scenarioInfo.desc}）\n讨论主题：${context}\n\n请生成 3 条发言建议。`
    : `会议场景：${scenarioInfo.name}（${scenarioInfo.desc}）\n\n请生成 3 条发言建议，可以自行设定讨论主题。`;

  const result = await llm.chat([
    {
      role: 'system',
      content: `${rolePrompt}

请为该角色在会议中生成 3 条发言建议。
要求：
1. 每条发言 20-50 字，像真实会议中的一句话
2. 风格搞笑夸张，充满PUA和职场黑话
3. 编号列出（1. 2. 3.）
4. 每条发言后面加一行简短的"使用场景"提示`,
    },
    {
      role: 'user',
      content: userContent,
    },
  ]);

  return result;
}

/**
 * 会议发言建议命令
 */
export function createMeetingCommand(): Command {
  const command = new Command('meeting')
    .description('会议发言建议 - AI 生成角色化会议发言建议')
    .option('-r, --role <role>', '角色: boss, employee, pm, hr, techlead, intern', 'boss')
    .option('-s, --scenario <type>', '场景: standup(站会), review(评审), brainstorm(头脑风暴), retro(回顾), planning(规划)', 'standup')
    .option('-p, --provider <ark|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称')
    .argument('[context...]', '会议讨论主题/背景（可选）');

  command.action(async (contextArgs, options) => {
    const role = (options.role || 'boss') as RoleType;
    const scenario = options.scenario || 'standup';
    const context = contextArgs.join(' ');
    const roleName = ROLE_NAMES[role] || role;
    const scenarioInfo = SCENARIO_NAMES[scenario] || SCENARIO_NAMES.standup;

    console.log();
    console.log(chalk.cyan.bold('🎤 会议发言建议'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`角色: ${roleName}  |  场景: ${scenarioInfo.name}  |  时长: ${scenarioInfo.duration}`));
    if (context) {
      console.log(chalk.gray(`主题: ${context}`));
    }
    console.log(chalk.gray('─'.repeat(50)));

    const spinner = ora({ text: 'AI 生成发言建议...', color: 'cyan' });
    spinner.start();

    try {
      const config = loadConfig(options);
      const result = await generateWithAI(role, scenario, context, config);
      spinner.stop();

      console.log();
      console.log(result);
      console.log();
      console.log(chalk.gray('💡 提示: 在实际会议中，根据情况灵活调整发言内容和时机'));
      console.log();
    } catch (error) {
      spinner.stop();
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('✗ ') + msg);
      process.exit(1);
    }
  });

  return command;
}
