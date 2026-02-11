import chalk from 'chalk';

export type OutputFormat = 'text' | 'markdown' | 'json';

export interface FormattedOutput {
  format: OutputFormat;
  content: string;
  metadata?: {
    role?: string;
    severity?: string;
    provider?: string;
    model?: string;
    tokens?: number;
    timestamp?: string;
  };
}

export class OutputFormatter {
  private outputFormat: OutputFormat;

  constructor(format: OutputFormat = 'text') {
    this.outputFormat = format;
  }

  format(data: FormattedOutput): string {
    switch (this.outputFormat) {
      case 'json':
        return this.formatJson(data);
      case 'markdown':
        return this.formatMarkdown(data);
      case 'text':
      default:
        return this.formatText(data);
    }
  }

  private formatJson(data: FormattedOutput): string {
    return JSON.stringify({
      output: data.content,
      metadata: data.metadata || {},
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  private formatMarkdown(data: FormattedOutput): string {
    let result = '';

    if (data.metadata?.role) {
      result += `## ${data.metadata.role}\n\n`;
    }

    result += data.content;
    result += '\n';

    if (data.metadata) {
      result += '\n---\n\n';
      result += '### Metadata\n\n';
      result += '| Key | Value |\n';
      result += '|-----|-------|\n';

      for (const [key, value] of Object.entries(data.metadata)) {
        result += `| ${key} | ${value} |\n`;
      }
    }

    return result;
  }

  private formatText(data: FormattedOutput): string {
    return data.content;
  }

  print(data: FormattedOutput): void {
    const formatted = this.format(data);

    switch (this.outputFormat) {
      case 'json':
        console.log(formatted);
        break;
      case 'markdown':
        console.log(formatted);
        break;
      case 'text':
      default:
        // 对于文本格式，处理颜色
        if (data.metadata?.role === 'boss') {
          console.log(chalk.red(formatted));
        } else if (data.metadata?.role === 'employee') {
          console.log(chalk.yellow(formatted));
        } else {
          console.log(formatted);
        }
        break;
    }
  }

  setFormat(format: OutputFormat): void {
    this.outputFormat = format;
  }

  getFormat(): OutputFormat {
    return this.outputFormat;
  }
}
