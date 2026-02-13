/**
 * 统一边框渲染系统
 * 功能：提供统一的边框样式，支持不同颜色和主题
 */

import chalk from 'chalk';

/**
 * 边框选项
 */
export interface BoxOptions {
  title?: string;
  width?: number;
  style?: 'single' | 'double' | 'rounded';
  padding?: number;
  content?: string[];
}

/**
 * 边框样式
 */
export interface BoxStyle {
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  headerBg?: string;
  contentBg?: string;
  borderColor?: string;
}

/**
 * 边框字符定义
 */
interface BorderChars {
  'top-left': string;
  'top-right': string;
  'bottom-left': string;
  'bottom-right': string;
  'bottom': string;
  'top': string;
}

/**
 * BoxRenderer 类
 */
export class BoxRenderer {
  /**
   * 获取边框字符
   */
  private static getBorderChars(style: 'single' | 'double' | 'rounded'): BorderChars {
    const borderChars: Record<string, BorderChars> = {
      single: {
        'top-left': '┌',
        'top-right': '┐',
        'bottom-left': '└',
        'bottom-right': '┘',
        'bottom': '─',
        'top': '─'
      },
      double: {
        'top-left': '╔',
        'top-right': '╗',
        'bottom-left': '╚',
        'bottom-right': '╝',
        'bottom': '═',
        'top': '═'
      },
      rounded: {
        'top-left': '╭',
        'top-right': '╮',
        'bottom-left': '╯',
        'bottom-right': '╰',
        'bottom': '─',
        'top': '─'
      }
    };
    return borderChars[style] || borderChars.single;
  }

  /**
   * 渲染完整边框
   */
  static render(options: BoxOptions & BoxStyle): string {
    const {
      title = '',
      width = 60,
      style = 'single',
      padding = 1,
      content = []
    } = options;

    const border = this.getBorderChars(style);
    const horizontal = border['top'];
    const bottom = border['bottom'];
    const left = border['top-left'];
    const right = border['top-right'];

    // 生成边框
    const box: string[] = [];

    // 顶部边框
    const topLine = left + horizontal.repeat(width - 2) + right;
    box.push(topLine);

    // 标题行
    if (title) {
      const titleLine = '│ ' + title.padEnd(width - 4) + ' │';
      box.push(titleLine);
    }

    // 中间内容区（逐行渲染）
    const contentWidth = width - padding * 2 - 2;
    for (const line of content) {
      const paddedLine = '│ ' + line.padEnd(contentWidth) + ' │';
      box.push(paddedLine);
    }

    // 底部边框
    const bottomLeft = border['bottom-left'];
    const bottomRight = border['bottom-right'];
    const bottomLine = bottomLeft + bottom.repeat(width - 2) + bottomRight;
    box.push(bottomLine);

    return box.join('\n');
  }

  /**
   * 渲染横向分隔线
   */
  static horizontal(char: string = '─', width: number = 60): string {
    return char.repeat(Math.ceil(width / 2));
  }

  /**
   * 渲染垂直分隔线（带可选的交点）
   */
  static vertical(height: number, char: string = '│'): string {
    return char.repeat(height);
  }
}

/**
 * 简化的渲染函数
 */
export function createBox(title: string, content: string[]): string {
  return BoxRenderer.render({ title, content });
}

/**
 * 创建简单信息框
 */
export function createInfoBox(title: string, content: string[]): string {
  return BoxRenderer.render({
    title,
    content,
    borderColor: 'cyan'
  });
}

/**
 * 创建成功框（绿色）
 */
export function createSuccessBox(title: string, content: string[]): string {
  return BoxRenderer.render({
    title,
    content,
    borderColor: 'green'
  });
}

/**
 * 创建警告框（黄色）
 */
export function createWarningBox(title: string, content: string[]): string {
  return BoxRenderer.render({
    title,
    content,
    borderColor: 'yellow'
  });
}

/**
 * 创建错误框（红色）
 */
export function createErrorBox(title: string, content: string[]): string {
  return BoxRenderer.render({
    title,
    content,
    borderColor: 'red'
  });
}
