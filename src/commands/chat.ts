import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import type { Ora } from 'ora';
import { Message } from '../llm/base';
import { getBossSystemMessage, getEmployeeSystemMessage } from '../prompts';
import { createLLM } from '../llm/factory';
import { getProviderBaseUrl } from '../config/settings';
import { StreamPrinter } from '../utils/stream';
import { sessionManager } from '../history/session';
import { logger } from '../utils/logger';
import { type ProviderType } from '../config/providers';

export interface ChatOptions {
  apiKey: string;
  provider: ProviderType;
  model: string;
  role: 'boss' | 'employee';
  severity: 'mild' | 'medium' | 'extreme';
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  // Create session
  const sessionId = `session-${Date.now()}`;
  sessionManager.createSession(sessionId);

  // Set up system message
  const systemMessage =
    options.role === 'boss'
      ? getBossSystemMessage(options.severity)
      : getEmployeeSystemMessage(options.severity);

  sessionManager.addMessage({ role: 'system', content: systemMessage });

  // Create LLM instance
  const llm = createLLM(options.provider, {
    apiKey: options.apiKey,
    model: options.model,
    baseUrl: getProviderBaseUrl(options.provider),
  });

  const printer = new StreamPrinter(
    options.role === 'boss' ? chalk.red : chalk.yellow
  );

  // Print welcome message
  const roleLabel = options.role === 'boss' ? '老板模式' : '员工模式';
  const roleEmoji = options.role === 'boss' ? '👔' : '👤';
  const severityLabel = {
    mild: '温和',
    medium: '标准',
    extreme: '极端'
  }[options.severity];

  console.log();
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(`            ${roleEmoji} PUA CLI - ${roleLabel}                 `) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + `   Provider: ${chalk.gray(options.provider)}   强度: ${chalk.gray(severityLabel)}   ` + chalk.cyan('║'));
  console.log(chalk.cyan('║') + `   模型: ${chalk.gray(options.model)}                                     ` + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.gray('输入 /help 查看可用命令，输入 /exit 退出'));
  console.log();

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('❯ ')
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmedInput = input.trim();

    // Handle commands
    if (trimmedInput.startsWith('/')) {
      await handleCommand(trimmedInput, rl, printer);
      rl.prompt();
      return;
    }

    if (!trimmedInput) {
      rl.prompt();
      return;
    }

    // Add user message to session
    sessionManager.addMessage({ role: 'user', content: trimmedInput });

    // Print user input
    printer.printUserInput(trimmedInput);

    // Call LLM
    let spinner: any = null;
    let hasStarted = false;

    try {
      printer.printResponseHeader(options.role);

      const messages = sessionManager.getMessages();

      await llm.chatStream(messages, (chunk) => {
        if (!hasStarted) {
          hasStarted = true;
          if (spinner) {
            spinner.stop();
            spinner = null;
          }
        }
        printer.printChunk(chunk);
      });

      printer.printResponseFooter();

    } catch (error) {
      if (spinner) spinner.stop();
      printer.printError(error instanceof Error ? error.message : String(error));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log();
    logger.info('再见！');
    process.exit(0);
  });
}

async function handleCommand(
  command: string,
  rl: readline.Interface,
  printer: StreamPrinter
): Promise<void> {
  const [cmd, ...args] = command.split(' ');

  switch (cmd) {
    case '/help':
      printHelp();
      break;

    case '/exit':
    case '/quit':
    case '/q':
      console.log();
      logger.info('再见！');
      rl.close();
      process.exit(0);
      break;

    case '/clear':
      sessionManager.clearCurrentSession();
      logger.success('会话历史已清空');
      break;

    case '/history':
      console.log(sessionManager.getFormattedHistory());
      break;

    case '/info':
      console.log(sessionManager.getSessionInfo());
      break;

    default:
      logger.warning(`未知命令: ${cmd}`);
      console.log(chalk.gray('输入 /help 查看可用命令'));
  }
}

function printHelp(): void {
  console.log();
  console.log(chalk.bold('可用命令:'));
  console.log(chalk.gray('─').repeat(50));
  console.log('  /help          显示此帮助信息');
  console.log('  /clear         清空当前会话历史');
  console.log('  /history       显示会话历史记录');
  console.log('  /info          显示会话统计信息');
  console.log('  /exit          退出程序');
  console.log();
}
