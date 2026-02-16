/**
 * 职场黑话生成器
 * 功能：使用 AI 生成各种类型的职场黑话，或将普通文本转换为黑话版本
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { loadConfig } from '../config/settings';
import { getProviderBaseUrl } from '../config/settings';
import type { RoleType } from '../prompts';

export interface JargonOptions {
  type?: 'meeting' | 'report' | 'email' | 'chat' | 'all';
  intensity?: 'light' | 'medium' | 'heavy';
  translate?: boolean;
}

/**
 * 使用 AI 生成黑话词典
 */
async function generateWithAI(
  type: string,
  config: { apiKey: string; provider: any; model: string }
): Promise<string> {
  const llm = createLLM(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: getProviderBaseUrl(config.provider),
  });

  const sceneMap: Record<string, string> = {
    meeting: '会议场景',
    report: '汇报/报告场景',
    email: '邮件场景',
    chat: '日常聊天场景',
    all: '各种职场场景',
  };

  const scene = sceneMap[type] || '各种职场场景';

  const result = await llm.chat([
    {
      role: 'system',
      content: `你是一个职场黑话专家。请生成${scene}下常用的职场黑话词汇和例句。
要求：
1. 列出 8-12 个黑话词汇，每个附带简短解释
2. 用这些黑话造 3 个完整的例句
3. 风格要搞笑、夸张，带有讽刺感
4. 格式清晰，使用编号列表`,
    },
    {
      role: 'user',
      content: `请生成"${scene}"的职场黑话词汇和例句。`,
    },
  ]);

  return result;
}

/**
 * 使用 AI 翻译文本为黑话
 */
async function translateWithAI(
  text: string,
  config: { apiKey: string; provider: any; model: string }
): Promise<string> {
  const llm = createLLM(config.provider, {
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: getProviderBaseUrl(config.provider),
  });

  const result = await llm.chat([
    {
      role: 'system',
      content: `你是职场黑话翻译器。将用户输入的普通文本翻译成充满职场黑话的版本。
要求：
1. 尽量用"赋能""对齐""闭环""抓手""颗粒度""拉通""沉淀""赛道""打法""底层逻辑"等黑话替换普通表达
2. 保持原文含义但让句子变得"高大上"
3. 风格夸张搞笑
4. 先输出翻译结果，再用一行简短解释翻译了哪些词`,
    },
    {
      role: 'user',
      content: text,
    },
  ]);

  return result;
}

/**
 * 黑话生成器命令
 */
export function createJargonCommand(): Command {
  const command = new Command('jargon')
    .description('职场黑话生成器 - AI 生成各种类型的职场黑话')
    .option('-t, --type <type>', '黑话类型: meeting(会议), report(报告), email(邮件), chat(聊天), all(全部)', 'meeting')
    .option('-i, --intensity <level>', '强度: light(轻度), medium(中度), heavy(重度)', 'medium')
    .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称')
    .argument('[text...]', '要翻译的普通文本（输入文本则进入翻译模式）');

  command.action(async (textArgs, options) => {
    const type = options.type || 'meeting';
    const spinner = ora({ text: 'AI 生成中...', color: 'cyan' });

    try {
      const config = loadConfig(options);

      if (textArgs.length > 0) {
        // 翻译模式
        const input = textArgs.join(' ');
        console.log();
        console.log(chalk.gray('📝 原文: ') + input);
        spinner.start();

        const result = await translateWithAI(input, config);
        spinner.stop();

        console.log(chalk.cyan('🎯 黑话版本:'));
        console.log();
        console.log(result);
        console.log();
      } else {
        // 生成模式
        console.log();
        console.log(chalk.cyan.bold(`🎯 职场黑话生成器 [${type.toUpperCase()}]`));
        console.log(chalk.gray('─'.repeat(50)));
        spinner.start();

        const result = await generateWithAI(type, config);
        spinner.stop();

        console.log();
        console.log(result);
        console.log();
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
