import chalk from 'chalk';
import input from '@inquirer/input';
import select from '@inquirer/select';
import confirm from '@inquirer/confirm';
import { saveGlobalConfig, loadGlobalConfig, ensureConfigDir, type GlobalConfig } from '../config/storage';
import { PROVIDERS, getProvider, validateApiKey, validateBaseUrl, type ProviderType } from '../config/providers';
import { logger } from '../utils/logger';

export interface ConfigWizardOptions {
  autoMode?: boolean;
  initialProvider?: ProviderType;
}

/**
 * Run the configuration wizard
 */
export async function configWizard(options: ConfigWizardOptions = {}): Promise<GlobalConfig> {
  const { autoMode = false, initialProvider } = options;

  // Show welcome message
  if (!autoMode) {
    console.log();
    console.log(chalk.cyan.bold('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + '              ' + chalk.white.bold('PUA CLI 配置向导') + '                    ' + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.gray('欢迎使用 PUA CLI！让我们先配置一些基本信息。'));
    console.log();
  }

  // Load existing config if available
  let existingConfig = loadGlobalConfig();

  // Step 1: Select Provider
  const providerAnswer = await select({
    message: '选择 AI 服务提供商:',
    choices: [
      {
        name: `${chalk.green('1.')} 智谱 AI ${chalk.gray('(国产，推荐)')}`,
        value: 'zhipu',
        description: '国产大模型，稳定可靠，响应快速',
      },
      {
        name: `${chalk.blue('2.')} OpenAI ${chalk.gray('(GPT-4o)')}`,
        value: 'openai',
        description: '国际通用，支持 GPT-4o、GPT-4o-mini 等模型',
      },
    ],
    default: existingConfig?.currentProvider || initialProvider || 'zhipu',
  });

  const provider = providerAnswer as ProviderType;
  const providerDef = getProvider(provider)!;

  console.log();
  console.log(chalk.gray(`已选择: ${chalk.white.bold(providerDef.name)}`));
  console.log();

  // Step 2: Input API Key
  let apiKey = '';
  let apiKeyValid = false;

  while (!apiKeyValid) {
    apiKey = await input({
      message: `请输入 ${providerDef.name} API Key:`,
      default: existingConfig?.providers[provider]?.apiKey || '',
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'API Key 不能为空';
        }
        const validation = validateApiKey(provider, value);
        if (!validation.valid) {
          return validation.error || 'API Key 无效';
        }
        return true;
      },
    });

    const validation = validateApiKey(provider, apiKey);
    apiKeyValid = validation.valid;

    if (!apiKeyValid) {
      console.log(chalk.red(validation.error || 'API Key 无效，请重新输入'));
    }
  }

  console.log();
  console.log(chalk.green('✓ API Key 已设置'));
  console.log();

  // Step 3: Input Base URL (optional)
  const useCustomUrl = await confirm({
    message: '是否使用自定义 Base URL（用于代理）？',
    default: false,
  });

  let baseUrl = providerDef.defaultBaseUrl;

  if (useCustomUrl) {
    baseUrl = await input({
      message: '请输入 Base URL:',
      default: existingConfig?.providers[provider]?.baseUrl || providerDef.defaultBaseUrl,
      validate: (value: string) => {
        const validation = validateBaseUrl(value);
        if (!validation.valid) {
          return validation.error || 'Base URL 无效';
        }
        return true;
      },
    });
  }

  console.log();

  // Step 4: Select Default Model
  const model = await select({
    message: '选择默认模型:',
    choices: providerDef.defaultModels.map((m) => ({
      name: m,
      value: m,
    })),
    default: existingConfig?.defaults.model || providerDef.defaultModels[0],
  });

  console.log();
  console.log(chalk.gray(`已选择: ${chalk.white(model)}`));
  console.log();

  // Step 5: Select Default Role
  const role = await select({
    message: '选择默认角色:',
    choices: [
      { name: '老板模式 (PUA 别人)', value: 'boss' },
      { name: '员工模式 (被 PUA)', value: 'employee' },
    ],
    default: existingConfig?.defaults.role || 'boss',
  });

  console.log();
  console.log(chalk.gray(`已选择: ${chalk.white(role === 'boss' ? '老板模式' : '员工模式')}`));
  console.log();

  // Step 6: Select Default Severity
  const severity = await select({
    message: '选择 PUA 强度:',
    choices: [
      { name: '温和 (mild)', value: 'mild' },
      { name: '标准 (medium)', value: 'medium' },
      { name: '极端 (extreme)', value: 'extreme' },
    ],
    default: existingConfig?.defaults.severity || 'medium',
  });

  console.log();
  console.log(chalk.gray(`已选择: ${chalk.white(severity)}`));
  console.log();

  // Step 7: Confirm and Save
  const shouldSave = await confirm({
    message: '确认保存配置？',
    default: true,
  });

  if (!shouldSave) {
    console.log();
    logger.warning('配置已取消');
    throw new Error('配置已取消');
  }

  // Build config object
  const newConfig: GlobalConfig = {
    currentProvider: provider,
    providers: {
      ...existingConfig?.providers,
      [provider]: {
        apiKey,
        baseUrl,
        models: providerDef.defaultModels,
      },
    },
    defaults: {
      provider,
      model,
      role: role as 'boss' | 'employee',
      severity: severity as 'mild' | 'medium' | 'extreme',
    },
    onboardingCompleted: true,
  };

  // Save config
  ensureConfigDir();
  saveGlobalConfig(newConfig);

  console.log();
  console.log(chalk.green('✓ 配置已保存'));
  console.log();
  console.log(chalk.gray('配置文件位置:'), chalk.white(getConfigPath()));
  console.log();

  if (!autoMode) {
    console.log(chalk.cyan('─────────────────────────────────────────────────────────────'));
    console.log();
    console.log(chalk.white.bold('配置完成！现在你可以开始使用 PUA CLI 了：'));
    console.log();
    console.log('  ' + chalk.white('pua chat --role boss') + chalk.gray('           # 启动老板模式'));
    console.log('  ' + chalk.white('pua prompt --role boss "你好"') + chalk.gray('     # 单次提示'));
    console.log();
    console.log(chalk.gray('更多选项请运行: pua --help'));
    console.log();
  }

  return newConfig;
}

/**
 * Get the config file path for display
 */
function getConfigPath(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    return '%APPDATA%\\pua-cli\\config.json';
  } else {
    return '~/.config/pua-cli/config.json';
  }
}

/**
 * Show current configuration
 */
export async function showConfig(): Promise<void> {
  const config = loadGlobalConfig();

  if (!config) {
    console.log();
    logger.warning('未找到配置文件');
    console.log(chalk.gray('运行 ') + chalk.white('pua config') + chalk.gray(' 来配置 PUA CLI'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.cyan.bold('当前配置:'));
  console.log(chalk.gray('─').repeat(50));
  console.log();

  const providerDef = getProvider(config.currentProvider);
  console.log(chalk.bold('当前 Provider:'), chalk.white(providerDef?.name || config.currentProvider));
  console.log();

  console.log(chalk.bold('已配置的 Providers:'));
  for (const [id, providerConfig] of Object.entries(config.providers)) {
    const p = getProvider(id as any);
    const isCurrent = id === config.currentProvider;
    const prefix = isCurrent ? chalk.green('→') : ' ';

    console.log(`  ${prefix} ${chalk.white(p?.name || id)}`);
    console.log(`    API Key: ${chalk.gray(maskApiKey(providerConfig.apiKey))}`);
    if (providerConfig.baseUrl) {
      console.log(`    Base URL: ${chalk.gray(providerConfig.baseUrl)}`);
    }
    console.log();
  }

  console.log(chalk.bold('默认设置:'));
  console.log(`  模型: ${chalk.white(config.defaults.model)}`);
  console.log(`  角色: ${chalk.white(config.defaults.role)}`);
  console.log(`  强度: ${chalk.white(config.defaults.severity)}`);
  console.log();

  console.log(chalk.gray('配置文件:'), chalk.white(getConfigPath()));
  console.log();
}

/**
 * Mask API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length);
  }
  return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4);
}
