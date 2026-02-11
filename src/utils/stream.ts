import chalk from 'chalk';
import { StreamChunk } from '../llm/base';

export class StreamPrinter {
  private buffer: string = '';
  private currentLine: string = '';

  constructor(private readonly roleColor: (text: string) => string = chalk.green) {}

  /**
   * Print a streaming chunk to the terminal
   */
  printChunk(chunk: StreamChunk): void {
    if (chunk.content) {
      // Accumulate content for smoother display
      this.buffer += chunk.content;

      // Print directly for real-time effect
      process.stdout.write(chunk.content);
    }

    if (chunk.done) {
      // Add newline when done
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
   * Print user input
   */
  printUserInput(input: string): void {
    console.log(chalk.gray('┌─────────────────────────────────────'));
    console.log(chalk.gray('│ 你:'), input);
    console.log(chalk.gray('└─────────────────────────────────────'));
  }

  /**
   * Print assistant response header
   */
  printResponseHeader(role: string): void {
    const roleLabel = role === 'boss' ? '老板' : '员工';
    const color = role === 'boss' ? chalk.red.bold : chalk.yellow.bold;
    console.log();
    console.log(color(`┌─ ${roleLabel} ─────────────────────────────`));
  }

  /**
   * Print assistant response footer
   */
  printResponseFooter(): void {
    console.log(chalk.gray('└─────────────────────────────────────'));
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
