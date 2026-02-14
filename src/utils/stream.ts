import chalk from 'chalk';
import { StreamChunk } from '../llm/base';

const BOX_WIDTH = 50;

/**
 * 计算字符串的终端显示宽度（CJK 字符算 2 宽度）
 */
function displayWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0) || 0;
    if (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3000 && code <= 0x303F) ||
      (code >= 0xFF00 && code <= 0xFFEF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0x20000 && code <= 0x2FA1F)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 用空格填充到指定显示宽度
 */
function padToWidth(str: string, targetWidth: number): string {
  const currentWidth = displayWidth(str);
  const padding = Math.max(0, targetWidth - currentWidth);
  return str + ' '.repeat(padding);
}

/**
 * 角色标签映射
 */
const ROLE_LABELS: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

/**
 * 角色颜色映射
 */
const ROLE_COLOR_FNS: Record<string, (text: string) => string> = {
  boss: chalk.red.bold,
  employee: chalk.yellow.bold,
  pm: chalk.cyan.bold,
  hr: chalk.magenta.bold,
  techlead: chalk.blue.bold,
  intern: chalk.green.bold,
};

export class StreamPrinter {
  private buffer: string = '';
  private currentRoleColor: (text: string) => string;

  constructor(private readonly roleColor: (text: string) => string = chalk.green) {
    this.currentRoleColor = roleColor;
  }

  /**
   * Print a streaming chunk to the terminal
   */
  printChunk(chunk: StreamChunk): void {
    if (chunk.content) {
      this.buffer += chunk.content;
      process.stdout.write(chunk.content);
    }

    if (chunk.done) {
      process.stdout.write('\n');
    }
  }

  /**
   * Print a complete message (non-streaming)
   */
  printMessage(message: string): void {
    console.log(this.roleColor(message));
  }

  /**
   * Print user input with box
   */
  printUserInput(input: string): void {
    const innerWidth = BOX_WIDTH - 4;
    const lines = wrapByWidth(input, innerWidth);

    console.log(chalk.gray(`┌${'─'.repeat(BOX_WIDTH - 2)}┐`));
    console.log(chalk.gray('│') + ' 你: ' + padToWidth(lines[0] || '', innerWidth - 4) + chalk.gray(' │'));
    for (let i = 1; i < lines.length; i++) {
      console.log(chalk.gray('│') + '     ' + padToWidth(lines[i], innerWidth - 4) + chalk.gray(' │'));
    }
    console.log(chalk.gray(`└${'─'.repeat(BOX_WIDTH - 2)}┘`));
  }

  /**
   * Print assistant response header (supports all 6 roles)
   */
  printResponseHeader(role: string): void {
    const roleLabel = ROLE_LABELS[role] || role;
    const colorFn = ROLE_COLOR_FNS[role] || chalk.white.bold;

    const headerText = `─ ${roleLabel} `;
    const headerDisplayWidth = displayWidth(headerText);
    const remaining = Math.max(0, BOX_WIDTH - 2 - headerDisplayWidth);

    // Store role color for footer
    this.currentRoleColor = colorFn;

    console.log();
    console.log(colorFn(`┌${headerText}${'─'.repeat(remaining)}┐`));
  }

  /**
   * Print assistant response footer
   */
  printResponseFooter(): void {
    console.log(this.currentRoleColor(`└${'─'.repeat(BOX_WIDTH - 2)}┘`));
    console.log();
  }

  /**
   * Print error message
   */
  printError(message: string): void {
    console.error(chalk.red('✗ 错误:'), message);
  }

  /**
   * Clear current line
   */
  clearLine(): void {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }
}

/**
 * 按显示宽度换行文本
 */
function wrapByWidth(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  let currentWidth = 0;

  for (const char of text) {
    const charWidth = displayWidth(char);
    if (currentWidth + charWidth > maxWidth) {
      lines.push(current);
      current = char;
      currentWidth = charWidth;
    } else {
      current += char;
      currentWidth += charWidth;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}
