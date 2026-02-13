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
import { SessionStorage, type SessionData } from '../config/session-storage';
import { logger } from '../utils/logger';
import { type ProviderType } from '../config/providers';

export interface ChatOptions {
  apiKey: string;
  provider: ProviderType;
  model: string;
  role: 'boss' | 'employee';
  severity: 'mild' | 'medium' | 'extreme';
}

// 全局会话存储实例
const sessionStorage = new SessionStorage();

// 扩展 readline 接口以支持动态属性
declare module 'readline' {
  interface Interface {
    [key: string]: any;
  }
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  // Create session
  const sessionId = `session-${Date.now()}`;
  sessionManager.createSession(sessionId);

  // Create readline interface first
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('❯ ')
  });

  // 保存元数据到 rl 以便在命令处理中使用
  rl['role'] = options.role;
  rl['severity'] = options.severity;
  rl['provider'] = options.provider;
  rl['model'] = options.model;

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

    case '/save':
      await handleSaveCommand(args, rl);
      break;

    case '/sessions':
      await handleSessionsCommand(rl);
      break;

    case '/load':
      await handleLoadCommand(args, rl);
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
  console.log('  /save [名称]  保存当前会话');
  console.log('  /sessions      列出所有已保存会话');
  console.log('  /load <ID>     加载指定会话');
  console.log('  /exit          退出程序');
  console.log();
}

async function handleSaveCommand(args: string[], rl: readline.Interface): Promise<void> {
  const sessionName = args.join(' ') || '未命名会话';
  const currentMessages = sessionManager.getMessages();

  const spinner = ora('保存会话中...').start();
  try {
    const savedSession = sessionStorage.saveSession({
      name: sessionName,
      description: `包含 ${currentMessages.length} 条消息`,
      messages: currentMessages,
      metadata: {
        role: rl['role'] || 'boss',
        severity: rl['severity'] || 'medium',
        provider: rl['provider'] || 'zhipu',
        model: rl['model'] || 'glm-4.7'
      }
    });

    spinner.stop();
    logger.success(`会话已保存: ${savedSession.name} (ID: ${savedSession.id})`);
  } catch (error) {
    spinner.stop();
    logger.error(`保存失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  rl.prompt();
}

async function handleSessionsCommand(rl: readline.Interface): Promise<void> {
  const spinner = ora('加载会话列表...').start();
  try {
    const sessions = sessionStorage.listSessions();
    spinner.stop();

    if (sessions.length === 0) {
      logger.info('暂无已保存的会话');
      rl.prompt();
      return;
    }

    console.log();
    console.log(chalk.bold('已保存的会话:'));
    console.log(chalk.gray('─').repeat(60));

    for (const session of sessions) {
      const messageCount = session.messages?.length || 0;
      const timeAgo = getTimeAgo(session.updatedAt);

      console.log(`  ${chalk.cyan(session.id.padEnd(12))}  ${chalk.white(session.name.padEnd(20))}  ${chalk.gray(`(${messageCount} 条消息, ${timeAgo})`)}`);
    }

    console.log();
    logger.info('使用 /load <ID> 加载会话');
    rl.prompt();
  } catch (error) {
    spinner.stop();
    logger.error(`加载失败: ${error instanceof Error ? error.message : String(error)}`);
    rl.prompt();
  }
}

async function handleLoadCommand(args: string[], rl: readline.Interface): Promise<void> {
  const sessionId = args[0];

  if (!sessionId) {
    logger.error('请指定会话 ID');
    console.log(chalk.gray('使用 /sessions 查看所有会话'));
    rl.prompt();
    return;
  }

  const spinner = ora('加载会话中...').start();
  try {
    const session = sessionStorage.loadSession(sessionId);

    if (!session) {
      spinner.stop();
      logger.error(`未找到会话: ${sessionId}`);
      rl.prompt();
      return;
    }

    spinner.stop();

    // 加载会话消息
    sessionManager.clearCurrentSession();
    for (const msg of session.messages || []) {
      sessionManager.addMessage({ role: msg.role as any, content: msg.content });
    }

    logger.success(`已加载会话: ${session.name}`);
    console.log();
    console.log(chalk.gray(`会话包含 ${session.messages?.length || 0} 条消息`));
    console.log();

    rl.prompt();
  } catch (error) {
    spinner.stop();
    logger.error(`加载失败: ${error instanceof Error ? error.message : String(error)}`);
    rl.prompt();
  }
}

function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const past = new Date(timestamp).getTime();
  const diff = Math.floor((now - past) / 1000);

  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}
