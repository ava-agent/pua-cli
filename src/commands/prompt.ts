import readline from 'readline';
import chalk from 'chalk';
import { Message } from '../llm/base';
import { getBossSystemMessage, getEmployeeSystemMessage } from '../prompts';
import { createLLM } from '../llm/factory';
import { getProviderBaseUrl } from '../config/settings';
import { StreamPrinter } from '../utils/stream';
import { logger } from '../utils/logger';
import { type ProviderType } from '../config/providers';

export interface PromptOptions {
  apiKey: string;
  provider: ProviderType;
  model: string;
  role: 'boss' | 'employee';
  severity: 'mild' | 'medium' | 'extreme';
  input?: string;
}

export async function promptCommand(options: PromptOptions): Promise<void> {
  // Get input from argument or stdin
  let userInput = options.input;

  if (!userInput) {
    // Read from stdin if available (pipe mode)
    if (!process.stdin.isTTY) {
      userInput = await readFromStdin();
    }
  }

  if (!userInput) {
    logger.error('请提供输入内容');
    console.log(chalk.gray('用法: pua prompt --role boss "你的问题"'));
    console.log(chalk.gray('或者: echo "你的问题" | pua prompt --role boss'));
    process.exit(1);
  }

  // Set up system message
  const systemMessage =
    options.role === 'boss'
      ? getBossSystemMessage(options.severity)
      : getEmployeeSystemMessage(options.severity);

  const messages: Message[] = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userInput }
  ];

  // Create LLM instance
  const llm = createLLM(options.provider, {
    apiKey: options.apiKey,
    model: options.model,
    baseUrl: getProviderBaseUrl(options.provider),
  });

  const printer = new StreamPrinter(
    options.role === 'boss' ? chalk.red : chalk.yellow
  );

  try {
    const roleLabel = options.role === 'boss' ? '老板' : '员工';
    console.log();
    console.log(chalk.gray(`┌─ ${roleLabel} ─────────────────────────────`));

    let fullResponse = '';

    await llm.chatStream(messages, (chunk) => {
      if (chunk.content) {
        fullResponse += chunk.content;
        process.stdout.write(chunk.content);
      }
    });

    console.log();
    console.log(chalk.gray('└─────────────────────────────────────'));
    console.log();

    // Print just the response for piping purposes
    console.log(fullResponse);

  } catch (error) {
    printer.printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function readFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';

    const rl = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      data += line + '\n';
    });

    rl.on('close', () => {
      resolve(data.trim());
    });
  });
}

export async function promptBatchCommand(inputs: string[], options: PromptOptions): Promise<void> {
  // Set up system message
  const systemMessage =
    options.role === 'boss'
      ? getBossSystemMessage(options.severity)
      : getEmployeeSystemMessage(options.severity);

  // Create LLM instance
  const llm = createLLM(options.provider, {
    apiKey: options.apiKey,
    model: options.model,
    baseUrl: getProviderBaseUrl(options.provider),
  });

  for (const input of inputs) {
    const messages: Message[] = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: input }
    ];

    try {
      const response = await llm.chat(messages);
      console.log(response);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
    }
  }
}
