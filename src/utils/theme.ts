/**
 * 颜色主题系统
 * 功能：提供多种颜色主题和动态切换能力
 */

import chalk from 'chalk';

/**
 * 主题颜色接口
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  text: string;
  background?: string;
}

/**
 * 主题配置接口
 */
export interface ColorTheme {
  name: string;
  description: string;
  colors: ThemeColors;
}

/**
 * 预定义主题
 */
export const THEMES: Record<string, ColorTheme> = {
  default: {
    name: '默认',
    description: '标准亮色主题',
    colors: {
      primary: 'cyan',
      secondary: 'white',
      accent: 'gray',
      border: 'cyan',
      text: 'white'
    }
  },
  dark: {
    name: '暗色',
    description: '适合夜间使用的深色主题',
    colors: {
      primary: 'gray',
      secondary: 'white',
      accent: 'dim',
      border: 'gray',
      text: 'white'
    }
  },
  colorful: {
    name: '多彩',
    description: '鲜艳多彩的主题',
    colors: {
      primary: 'magenta',
      secondary: 'white',
      accent: 'yellow',
      border: 'gray',
      text: 'white'
    }
  },
  minimal: {
    name: '极简',
    description: '极简黑白风格',
    colors: {
      primary: 'white',
      secondary: 'gray',
      accent: 'gray',
      border: 'gray',
      text: 'white'
    }
  }
};

/**
 * 主题管理器
 */
export class ThemeManager {
  private currentTheme: ColorTheme = THEMES.default;

  /**
   * 设置主题
   */
  setTheme(themeName: string): void {
    const theme = THEMES[themeName];
    if (!theme) {
      console.warn(`未找到主题: ${themeName}，使用默认主题`);
      this.currentTheme = THEMES.default;
      return;
    }

    this.currentTheme = theme;
    console.log(`✓ 已切换到主题: ${chalk.bold(theme.name)} (${theme.description})`);
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): ColorTheme {
    return this.currentTheme;
  }

  /**
   * 应用主题到文本
   */
  applyTheme(text: string): string {
    const theme = this.getCurrentTheme();
    return (chalk[theme.colors.primary] as any)(text);
  }

  /**
   * 应用主题到边框
   */
  applyToBorder(text: string): string {
    const theme = this.getCurrentTheme();
    return (chalk[theme.colors.border] as any)(text);
  }

  /**
   * 应用主题到标题
   */
  applyToTitle(text: string): string {
    const theme = this.getCurrentTheme();
    return (chalk[theme.colors.primary] as any)(text);
  }

  /**
   * 应用主题到成功信息
   */
  applyToSuccess(text: string): string {
    return chalk.green(text);
  }

  /**
   * 应用主题到警告信息
   */
  applyToWarning(text: string): string {
    return chalk.yellow(text);
  }

  /**
   * 应用主题到错误信息
   */
  applyToError(text: string): string {
    return chalk.red(text);
  }

  /**
   * 应用主题到次要文本
   */
  applyToSecondary(text: string): string {
    const theme = this.getCurrentTheme();
    return (chalk[theme.colors.secondary] as any)(text);
  }

  /**
   * 列出所有可用主题
   */
  listThemes(): void {
    console.log();
    console.log(chalk.cyan.bold('╔════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + '                    ' + chalk.bold.white('可用颜色主题') + '                      ' + chalk.cyan('║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.white('1. default') + '          ' + chalk.gray('  - ') + chalk.gray(THEMES.default.description) + '           '.padEnd(31) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.white('2. dark') + '            ' + chalk.gray('  - ') + chalk.gray(THEMES.dark.description) + '              '.padEnd(31) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.white('3. colorful') + '         ' + chalk.gray('  - ') + chalk.gray(THEMES.colorful.description) + '             '.padEnd(31) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.white('4. minimal') + '          ' + chalk.gray('  - ') + chalk.gray(THEMES.minimal.description) + '             '.padEnd(31) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + '                    ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.gray('使用 pua chat --theme <主题名> 来切换主题'));
  }
}

// 主题管理器单例
export const themeManager = new ThemeManager();

/**
 * 切换主题
 */
export function setTheme(themeName: string): void {
  themeManager.setTheme(themeName);
}

/**
 * 应用主题
 */
export function applyTheme(text: string): string {
  return themeManager.applyTheme(text);
}

/**
 * 列出所有主题
 */
export function listThemes(): void {
  themeManager.listThemes();
}
