#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { chatCommand, ChatOptions } from './commands/chat';
import { promptCommand, PromptOptions } from './commands/prompt';
import { configWizard, showConfig } from './commands/config';
import { createJargonCommand } from './commands/jargon';
import { createWeeklyCommand } from './commands/weekly';
import { createEmailCommand } from './commands/email';
import { createMeetingCommand } from './commands/meeting';
import { createMeetingRoomCommand } from './commands/meeting-room';
import { createInterviewCommand } from './commands/interview';
import {
  loadConfig,
  needsOnboarding,
  type RuntimeConfig,
} from './config/settings';
import { logger } from './utils/logger';

const program = new Command();

// CLI metadata
program
  .name('pua')
  .description('Workplace PUA CLI - 一个趣味性 AI CLI 工具，具有 6 种角色模式')
  .version('0.8.0');

/**
 * Wrap command action with onboarding check
 */
async function withOnboardingCheck<T extends (...args: any[]) => any>(
  fn: T
): Promise<ReturnType<T>> {
  // Check if onboarding is needed
  if (needsOnboarding()) {
    console.log();
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.cyan.bold('                       欢迎使用 PUA CLI！'));
    console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════'));
    console.log();
    console.log(chalk.gray('在开始之前，让我们先配置一些基本信息。'));
    console.log();

    try {
      await configWizard({ autoMode: true });
    } catch (error) {
      if ((error as Error).message === '配置已取消') {
        console.log();
        logger.info('配置已取消，退出程序');
        process.exit(0);
      }
      throw error;
    }

    console.log();
    console.log(chalk.green('✓ 配置完成！'));
    console.log();
  }

  return fn();
}

// Config command
program
  .command('config')
  .description('配置 PUA CLI（选择 Provider、设置 API Key）')
  .option('--show', '显示当前配置')
  .action(async (options) => {
    try {
      if (options.show) {
        await showConfig();
      } else {
        await configWizard();
      }
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Chat command - interactive mode
program
  .command('chat')
  .description('启动交互式聊天模式（支持会话历史）')
  .option('-r, --role <role>', '角色模式: boss(老板), employee(员工), pm(产品经理), hr(HR), techlead(技术主管), intern(实习生)')
  .option('-m, --model <model>', '模型名称')
  .option('-s, --severity <mild|medium|extreme>', 'PUA 强度')
  .option('-p, --provider <ark|openai>', 'AI 服务提供商')
  .action(async (options) => {
    await withOnboardingCheck(async () => {
      try {
        const config = loadConfig(options);
        const chatOptions: ChatOptions = {
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.model,
          role: config.role,
          severity: config.severity,
        };
        await chatCommand(chatOptions);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
  });

// Prompt command - single-shot mode
program
  .command('prompt')
  .description('单次提示模式（适合 AI 工作流集成）')
  .option('-r, --role <role>', '角色模式: boss(老板), employee(员工), pm(产品经理), hr(HR), techlead(技术主管), intern(实习生)')
  .option('-m, --model <model>', '模型名称')
  .option('-s, --severity <mild|medium|extreme>', 'PUA 强度')
  .option('-p, --provider <ark|openai>', 'AI 服务提供商')
  .option('-f, --format <text|markdown|json>', '输出格式: text (文本), markdown (Markdown), json (JSON)')
  .argument('[input...]', '输入内容（可选，也支持管道输入）')
  .action(async (inputArgs, options) => {
    await withOnboardingCheck(async () => {
      try {
        const config = loadConfig(options);
        const input = inputArgs.join(' ');
        const promptOptions: PromptOptions = {
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.model,
          role: config.role,
          severity: config.severity,
          input,
          format: options.format as any,
        };
        await promptCommand(promptOptions);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
  });

// Jargon command - 职场黑话生成器
program.addCommand(createJargonCommand());

// Weekly command - 周报生成器
program.addCommand(createWeeklyCommand());

// Email command - 邮件语气转换器
program.addCommand(createEmailCommand());

// Meeting command - 会议发言建议
program.addCommand(createMeetingCommand());

// Meeting Room command - 多角色会议室
program.addCommand(createMeetingRoomCommand());

// Interview command - 压力面试
program.addCommand(createInterviewCommand());

// Default command - show help
program.action(() => {
  console.log();
  console.log(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + '          ' + chalk.white.bold('PUA CLI v0.8.0') + ' - 趣味 AI 职场角色扮演工具' + '   ' + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝'));
  console.log();

  // === 互动场景 ===
  console.log(chalk.green.bold('  互动场景'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
  console.log('  ' + chalk.white('pua chat')                + chalk.gray('              💬 交互聊天 - 选角色，开始PUA对话'));
  console.log('  ' + chalk.white('pua meeting-room')        + chalk.gray('      🏢 会议室 - 多角色同时参会模拟'));
  console.log('  ' + chalk.white('pua interview')           + chalk.gray('         🎯 压力面试 - 10轮问答挑战'));
  console.log();

  // === AI 工具 ===
  console.log(chalk.yellow.bold('  AI 工具'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
  console.log('  ' + chalk.white('pua jargon')              + chalk.gray('            🗣️  黑话生成 - 生成/翻译职场黑话'));
  console.log('  ' + chalk.white('pua weekly')              + chalk.gray('            📋 周报生成 - AI 生成角色风格周报'));
  console.log('  ' + chalk.white('pua email')               + chalk.gray('             📧 邮件转换 - AI 转换邮件语气'));
  console.log('  ' + chalk.white('pua meeting')             + chalk.gray('           🎤 会议发言 - AI 生成发言建议'));
  console.log('  ' + chalk.white('pua prompt "你好"')     + chalk.gray('     ⚡ 单次提问 - 快速获取一次回复'));
  console.log();

  // === 配置 ===
  console.log(chalk.blue.bold('  配置'));
  console.log(chalk.gray('  ─────────────────────────────────────────────────────'));
  console.log('  ' + chalk.white('pua config')              + chalk.gray('            🔧 配置 API Key 和默认选项'));
  console.log('  ' + chalk.white('pua config --show')       + chalk.gray('       📄 查看当前配置'));
  console.log();

  // === 角色 ===
  console.log(chalk.gray('  支持角色: ')
    + chalk.red('👔老板') + ' '
    + chalk.yellow('😓员工') + ' '
    + chalk.blue('📋产品经理') + ' '
    + chalk.green('💼HR') + ' '
    + chalk.magenta('💻技术主管') + ' '
    + chalk.cyan('🌱实习生'));
  console.log();
});

// Parse arguments
program.parseAsync(process.argv).catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
