#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { chatCommand, ChatOptions } from './commands/chat';
import { promptCommand, PromptOptions } from './commands/prompt';
import { configWizard, showConfig } from './commands/config';
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
  .description('PUA CLI - 一个趣味性 AI CLI 工具，具有两种角色模式')
  .version('0.2.0');

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
  .option('-r, --role <boss|employee>', '角色模式: boss (老板模式) 或 employee (员工模式)')
  .option('-m, --model <model>', '模型名称')
  .option('-s, --severity <mild|medium|extreme>', 'PUA 强度')
  .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
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
  .option('-r, --role <boss|employee>', '角色模式: boss (老板模式) 或 employee (员工模式)')
  .option('-m, --model <model>', '模型名称')
  .option('-s, --severity <mild|medium|extreme>', 'PUA 强度')
  .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
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

// Default command - show help
program.action(() => {
  console.log();
  console.log(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + '          ' + chalk.white.bold('PUA CLI') + ' - 趣味 AI 职场角色扮演工具' + '        ' + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray('这是一个趣味性的 AI CLI 工具，提供两种角色模式：'));
  console.log();
  console.log('  ' + chalk.red.bold('老板模式') + '   - 用喜欢 PUA 员工的老板风格回应');
  console.log('  ' + chalk.yellow.bold('员工模式') + ' - 用被老板 PUA 的员工风格回应');
  console.log();
  console.log(chalk.gray('─────────────────────────────────────────────────────────────'));
  console.log();
  console.log('使用示例:');
  console.log();
  console.log('  ' + chalk.white('pua chat') + chalk.gray('                          # 启动交互模式'));
  console.log('  ' + chalk.white('pua config') + chalk.gray('                        # 配置 API Key'));
  console.log('  ' + chalk.white('pua prompt --role boss "你好"') + chalk.gray('   # 单次提示'));
  console.log();
  console.log(chalk.gray('─────────────────────────────────────────────────────────────'));
  console.log();
  console.log(chalk.gray('运行 ') + chalk.white('pua --help') + chalk.gray(' 查看更多选项'));
  console.log();
});

// Parse arguments
program.parseAsync(process.argv).catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
