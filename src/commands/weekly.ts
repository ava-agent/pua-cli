/**
 * 周报生成器
 * 功能：使用 AI 根据不同角色自动生成职场周报
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { loadConfig, getProviderBaseUrl } from '../config/settings';
import type { RoleType } from '../prompts';

/**
 * 获取当前周数
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export interface WeeklyReportOptions {
  role: RoleType;
  week?: number;
  highlights?: number;
}

const ROLE_NAMES: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

const ROLE_PROMPTS: Record<string, string> = {
  boss: '你是一个喜欢画饼、PUA下属的老板。周报风格：强调团队管理成果，暗示自己功劳最大，用"赋能""格局""战略"等词。对下属的工作轻描淡写，把困难说成"成长机会"。',
  employee: '你是一个被PUA的打工人。周报风格：把简单工作写得很复杂，把加班美化成"主动学习"，把被骂说成"收到领导指导"。充满卑微感但又要体现自己很努力。',
  pm: '你是一个需求变更专家产品经理。周报风格：大量使用"对齐""闭环""赋能""抓手""颗粒度"等黑话。把改需求说成"优化用户体验"，把砍功能说成"聚焦核心价值"。',
  hr: '你是一个打感情牌的HR。周报风格：强调企业文化建设和员工关怀，把裁员说成"组织优化"，把降薪说成"薪酬结构调整"。充满正能量但细看全是套路。',
  techlead: '你是一个喜欢质疑别人代码的技术主管。周报风格：强调技术债务和架构问题，把别人的代码说得一文不值，暗示只有自己能拯救项目。大量使用技术术语。',
  intern: '你是一个卑微的实习生。周报风格：把所有事情都写成学习心得，疯狂感谢各位前辈。把被使唤说成"获得锻炼机会"，把不懂的说成"待深入学习的领域"。',
};

/**
 * 使用 AI 生成周报
 */
async function generateWithAI(
  role: RoleType,
  week: number,
  workItems: string,
  config: { apiKey: string; provider: any; model: string }
): Promise<string> {
  const llm = createLLM(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: getProviderBaseUrl(config.provider),
  });

  const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.boss;
  const roleName = ROLE_NAMES[role] || '老板';

  const userContent = workItems
    ? `请根据以下工作内容，以"${roleName}"的风格生成第${week}周的周报：\n\n工作内容：${workItems}`
    : `请以"${roleName}"的风格，生成第${week}周的周报。可以虚构合理的工作内容。`;

  const result = await llm.chat([
    {
      role: 'system',
      content: `${rolePrompt}

请生成一份完整的周报，格式如下：
【本周工作】
- 列出 3-5 项工作内容

【下周计划】
- 列出 2-3 项计划

【风险与问题】
- 列出 1-2 项（用该角色的风格描述）

要求：搞笑、夸张、充满PUA风格，但格式要像正经周报。每项控制在一句话。`,
    },
    {
      role: 'user',
      content: userContent,
    },
  ]);

  return result;
}

/**
 * 周报生成器命令
 */
export function createWeeklyCommand(): Command {
  const command = new Command('weekly')
    .description('周报生成器 - AI 生成角色风格职场周报')
    .option('-r, --role <role>', '角色: boss, employee, pm, hr, techlead, intern', 'boss')
    .option('-w, --week <number>', '周数（默认当前周）')
    .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称')
    .option('-o, --output <file>', '输出到文件（可选）')
    .argument('[items...]', '工作内容（可选，用于让 AI 基于实际工作生成）');

  command.action(async (itemArgs, options) => {
    const role = (options.role || 'boss') as RoleType;
    const week = options.week ? parseInt(options.week) : getWeekNumber(new Date());
    const workItems = itemArgs.join(' ');
    const roleName = ROLE_NAMES[role] || role;

    console.log();
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + chalk.bold.white(`          周报生成器 - ${roleName}`) + '                          ' + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('║') + chalk.gray(`          第 ${week} 周`) + '                                        ' + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════╝'));

    const spinner = ora({ text: 'AI 生成周报中...', color: 'cyan' });
    spinner.start();

    try {
      const config = loadConfig(options);
      const report = await generateWithAI(role, week, workItems, config);
      spinner.stop();

      console.log();
      console.log(report);
      console.log();

      if (options.output) {
        const { writeFile } = await import('fs/promises');
        const { join } = await import('path');
        const outputPath = join(process.cwd(), options.output);
        await writeFile(outputPath, report, 'utf-8');
        console.log(chalk.green('✓') + ' 周报已保存到: ' + outputPath);
      }
    } catch (error) {
      spinner.stop();
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('✗ ') + msg);
      process.exit(1);
    }
  });

  return command;
}
