/**
 * 邮件语气转换器
 * 功能：使用 AI 根据不同角色转换邮件语气
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { loadConfig, getProviderBaseUrl } from '../config/settings';
import type { RoleType } from '../prompts';

export interface EmailOptions {
  from: RoleType;
  to: RoleType;
  tone?: 'polite' | 'urgent' | 'casual' | 'passive';
}

const ROLE_NAMES: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

/**
 * 推导邮件方向
 */
function deriveDirection(from: string, to: string): string {
  const levels: Record<string, number> = {
    boss: 4, hr: 3, techlead: 3, pm: 2, employee: 1, intern: 0,
  };
  const fromLevel = levels[from] ?? 1;
  const toLevel = levels[to] ?? 1;
  if (fromLevel < toLevel) return 'upward';
  if (fromLevel > toLevel) return 'downward';
  return 'cross';
}

/**
 * 使用 AI 转换邮件语气
 */
async function transformWithAI(
  content: string,
  from: string,
  to: string,
  config: { apiKey: string; provider: any; model: string }
): Promise<string> {
  const llm = createLLM(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: getProviderBaseUrl(config.provider),
  });

  const direction = deriveDirection(from, to);
  const fromName = ROLE_NAMES[from] || from;
  const toName = ROLE_NAMES[to] || to;

  const directionGuide: Record<string, string> = {
    upward: '语气恭敬、谦逊，使用敬语，表达尊重。适当加入"您""辛苦了""望""为盼"等词。',
    downward: '语气威严、指令性，带有PUA色彩。使用"务必""抓紧""格局""赋能"等职场黑话。暗示对方做得不够好。',
    cross: '语气平等但暗藏锋芒，使用"对齐""拉通""协同"等黑话。表面客气实则甩锅或抢功。',
  };

  const result = await llm.chat([
    {
      role: 'system',
      content: `你是一个职场邮件语气转换专家。
当前场景：${fromName} 写给 ${toName} 的邮件（${direction === 'upward' ? '下级→上级' : direction === 'downward' ? '上级→下级' : '平级'}）。

转换规则：
${directionGuide[direction]}

请将用户提供的邮件内容转换为符合该场景的职场风格。
要求：
1. 保持原意但改变语气和用词
2. 适当加入职场黑话
3. 风格搞笑夸张但像正经邮件
4. 先输出转换后的邮件，再用"---"分隔后简要说明转换了什么`,
    },
    {
      role: 'user',
      content: content,
    },
  ]);

  return result;
}

/**
 * 邮件语气转换器命令
 */
export function createEmailCommand(): Command {
  const command = new Command('email')
    .description('邮件语气转换器 - AI 转换邮件语气和风格')
    .option('-f, --from <role>', '发送者角色: boss, employee, pm, hr, techlead, intern', 'pm')
    .option('-t, --to <role>', '接收者角色: boss, employee, pm, hr, techlead, intern', 'employee')
    .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称')
    .argument('[content...]', '要转换的邮件内容');

  command.action(async (contentArgs, options) => {
    const from = (options.from || 'pm') as RoleType;
    const to = (options.to || 'employee') as RoleType;
    const fromName = ROLE_NAMES[from] || from;
    const toName = ROLE_NAMES[to] || to;

    if (contentArgs.length === 0) {
      console.log();
      console.log(chalk.cyan.bold('📧 邮件语气转换器'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log();
      console.log('用法: ' + chalk.white('pua email --from <角色> --to <角色> "邮件内容"'));
      console.log();
      console.log('角色: ' + chalk.red('boss') + ' ' + chalk.yellow('employee') + ' ' + chalk.cyan('pm') + ' ' + chalk.magenta('hr') + ' ' + chalk.blue('techlead') + ' ' + chalk.green('intern'));
      console.log();
      console.log('示例:');
      console.log(chalk.gray('  pua email --from pm --to employee "请处理一下这个需求"'));
      console.log(chalk.gray('  pua email --from intern --to boss "想请一天假"'));
      console.log(chalk.gray('  pua email --from boss --to employee "项目进度怎么样"'));
      console.log();
      return;
    }

    const content = contentArgs.join(' ');
    const direction = deriveDirection(from, to);
    const dirLabel = direction === 'upward' ? '⬆️ 上行' : direction === 'downward' ? '⬇️ 下行' : '↔️ 平行';

    console.log();
    console.log(chalk.cyan.bold('📧 邮件语气转换'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray(`方向: ${fromName} → ${toName} (${dirLabel})`));
    console.log(chalk.gray('原文: ') + content);
    console.log(chalk.gray('─'.repeat(50)));

    const spinner = ora({ text: 'AI 转换中...', color: 'cyan' });
    spinner.start();

    try {
      const config = loadConfig(options);
      const result = await transformWithAI(content, from, to, config);
      spinner.stop();

      console.log();
      console.log(result);
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
