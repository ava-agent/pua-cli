# PUA CLI 技术原理

本文档详细讲解 PUA CLI 的技术实现原理，适合 CLI 工具开发学习。

## 目录

- [整体架构](#整体架构)
- [核心技术](#核心技术)
- [实现细节](#实现细节)
- [最佳实践](#最佳实践)

---

## 整体架构

### 系统分层

PUA CLI 采用经典的分层架构设计：

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户交互层                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │               命令行界面 (CLI)               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐│   │
│  │  │ chat 命令 │  │prompt 命令│  │config命令 ││   │
│  │  └─────┬────┘  └─────┬────┘  └─────┬────┘│   │
│  └────────│────────────────│────────────────│──────────┘   │
└───────────┼────────────────┼────────────────┼──────────────────┘
            │                │                │
┌───────────┼────────────────┼────────────────┼──────────────────┐
│           ▼                ▼                ▼                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           业务逻辑层 (Service Layer)          │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌──────────────────────┐    │    │
│  │  │Chat Manager │  │   Config Manager    │    │    │
│  │  │- 会话管理   │  │   - 配置读写       │    │    │
│  │  │- 历史记录   │  │   - 向导流程       │    │    │
│  │  └──────┬──────┘  └──────────────────────┘    │    │
│  └─────────┼───────────────────────────────────────────┘    │
│            │                                        │
│            ▼                                        │
│  ┌─────────────────────────────────────────────────┐       │
│  │          提示词层 (Prompt Layer)          │       │
│  │                                          │       │
│  │  ┌──────────────┐  ┌───────────────────┐│       │
│  │  │ Boss Prompts │  │ Employee Prompts ││       │
│  │  │ - 严厉语气   │  │ - 卑微语气     ││       │
│  │  │ - PUA 技巧   │  │ - 道歉模式     ││       │
│  │  └──────┬───────┘  └────────┬──────────┘│       │
│  └─────────┼───────────────────┼──────────────┘       │
└────────────┼───────────────────┼──────────────────────┘
             │                   │
┌────────────┼───────────────────┼──────────────────────┐
│            ▼                   ▼                       │
│  ┌─────────────────────────────────────────┐         │
│  │       LLM 抽象层 (LLM Layer)        │         │
│  │                                     │         │
│  │  ┌──────────────────────────────┐     │         │
│  │  │    LLM Base (Abstract)      │     │         │
│  │  │    - chat() 抽象方法        │     │         │
│  │  │    - chatStream() 抽象方法     │     │         │
│  │  └──────────┬───────────────────┘     │         │
│  │             │                            │         │
│  │  ┌─────────┴────────┐              │         │
│  │  │                   │              │         │
│  │  │  ┌───────────────┴────────┐    │         │
│  │  │  │  Factory Pattern      │    │         │
│  │  │  └─┬──────────────┬──────┘    │         │
│  └────┼────┼──────────────┼───────┘         │
│       │    │              │    │              │
│  ┌─────┴─┐ ┌────┴────┐ ┌────┴─────┐        │
│  │ZhipuLLM│ │OpenAILLM │ │(扩展)   │        │
│  └────────┘ └───────────┘ └──────────┘        │
│                                             │
└───────────────────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  AI 服务提供商      │
         │  - 智谱 AI       │
         │  - OpenAI        │
         └─────────────────────┘
```

### 数据流向

```
用户输入
  │
  ▼
┌─────────────────┐
│  CLI 参数解析  │
│  (Commander)  │
└───────┬───────┘
        │
        ▼
┌─────────────────┐
│ 配置加载合并  │
│(多源优先级)  │
└───────┬───────┘
        │
        ▼
┌─────────────────┐
│ 提示词构建   │
│(角色+强度)   │
└───────┬───────┘
        │
        ▼
┌─────────────────┐
│ LLM API 调用│
│  (流式输出)   │
└───────┬───────┘
        │
        ▼
   终端显示输出
```

---

## 核心技术

### 1. CLI 框架 - Commander.js

Commander.js 是最流行的 Node.js CLI 框架。

#### 基本用法

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('pua')
  .description('PUA CLI - 趣味 AI 职场角色扮演工具')
  .version('0.2.0');

// 定义子命令
program
  .command('chat')
  .description('启动交互式聊天模式')
  .option('-r, --role <boss|employee>', '角色模式')
  .option('-s, --severity <mild|medium|extreme>', 'PUA 强度')
  .action(async (options) => {
    // 处理命令逻辑
    await handleChat(options);
  });

// 解析命令行参数
program.parseAsync(process.argv);
```

#### 关键概念

- **子命令 (Subcommands)**: `chat`, `prompt`, `config`
- **选项 (Options)**: 带短标志和长标志的参数 `-r, --role`
- **动作 (Action)**: 命令执行时的回调函数
- **自动帮助**: 自动生成 `--help` 信息

### 2. 交互式输入 - @inquirer/prompts

创建友好的命令行交互体验。

#### 选择题

```typescript
import select from '@inquirer/select';

const answer = await select({
  message: '选择 AI 服务提供商:',
  choices: [
    {
      name: '智谱 AI (国产，推荐)',
      value: 'zhipu',
      description: '国产大模型，稳定可靠，响应快速'
    },
    {
      name: 'OpenAI (GPT-4o)',
      value: 'openai',
      description: '国际通用，支持 GPT-4o、GPT-4o-mini 等模型'
    }
  ],
  default: 'zhipu'
});
```

#### 输入验证

```typescript
import input from '@inquirer/input';

const apiKey = await input({
  message: '请输入 API Key:',
  validate: (value: string) => {
    if (!value || value.trim().length === 0) {
      return 'API Key 不能为空';
    }
    if (value.length < 10) {
      return 'API Key 格式不正确';
    }
    return true; // 验证通过
  }
});
```

#### 确认对话框

```typescript
import confirm from '@inquirer/confirm';

const shouldSave = await confirm({
  message: '确认保存配置？',
  default: true
});

if (!shouldSave) {
  console.log('已取消');
  process.exit(0);
}
```

### 3. 多 Provider 架构 - 工厂模式

使用工厂模式实现多 AI 服务商支持，便于扩展。

#### 抽象基类

```typescript
// src/llm/base.ts
export abstract class LLMBase {
  protected apiKey: string;
  protected model: string;
  protected baseUrl: string;

  constructor(options: LLMOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl;
  }

  // 抽象方法 - 子类必须实现
  abstract chat(messages: Message[]): Promise<string>;
  abstract chatStream(messages: Message[], onChunk: (chunk: StreamChunk) => void): Promise<void>;
  abstract getAvailableModels(): string[];
}
```

#### 工厂函数

```typescript
// src/llm/factory.ts
export function createLLM(provider: ProviderType, options: LLMOptions): LLMBase {
  switch (provider) {
    case 'zhipu':
      return new ZhipuLLM(options);
    case 'openai':
      return new OpenAILLM(options);
    default:
      throw new Error(`不支持的 provider: ${provider}`);
  }
}
```

#### 具体实现

```typescript
// src/llm/zhipu.ts
export class ZhipuLLM extends LLMBase {
  async chatStream(messages: Message[], onChunk: (chunk: StreamChunk) => void): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream: true
      })
    });

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = JSON.parse(line.slice(5));
          if (data.choices?.[0]?.delta?.content) {
            onChunk({ content: data.choices[0].delta.content });
          }
        }
      }
    }
  }
}
```

### 4. 流式输出处理 - SSE

Server-Sent Events (SSE) 是实现流式 AI 响应的标准协议。

#### SSE 格式解析

```
data: {"id": "chat-1", "choices": [{"delta": {"content": "你"}}}

data: {"id": "chat-1", "choices": [{"delta": {"content": "好"}}}

data: [DONE]
```

#### 流式处理代码

```typescript
// src/utils/stream.ts
export class StreamPrinter {
  private color: (text: string) => string;

  constructor(color: (text: string) => string) {
    this.color = color;
  }

  print(chunk: string): void {
    process.stdout.write(this.color(chunk));
  }

  printError(message: string): void {
    console.error(chalk.red(`✗ ${message}`));
  }

  printSuccess(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }
}
```

### 5. 配置管理系统

实现多源配置合并，支持优先级覆盖。

#### 配置优先级

```
1. 命令行参数 (最高优先级)
   pua chat --role boss --severity extreme

2. 环境变量
   export ZHIPUAI_API_KEY="xxx"

3. 项目配置文件
   ./.pua.json

4. 全局配置文件 (最低优先级)
   ~/.config/pua-cli/config.json
```

#### 配置加载逻辑

```typescript
// src/config/settings.ts
export function loadConfig(cliOptions: CliOptions): Config {
  const globalConfig = loadGlobalConfig(); // 从 ~/.config/pua-cli 读取
  const projectConfig = loadProjectConfig();  // 从 ./.pua.json 读取
  const envConfig = loadEnvConfig();        // 从 process.env 读取

  // 合并配置（后者覆盖前者）
  const merged: Config = {
    ...DEFAULTS,
    ...globalConfig?.defaults,
    ...projectConfig,
    ...envConfig,
    ...cliOptions
  };

  return merged;
}
```

#### 配置文件存储

```typescript
// src/config/storage.ts
import path from 'path';
import os from 'os';
import fs from 'fs';

// XDG Base Directory 规范
export function getConfigDir(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows: %APPDATA%\pua-cli
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'pua-cli');
  } else {
    // Linux/macOS: ~/.config/pua-cli
    return path.join(os.homedir(), '.config', 'pua-cli');
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const configDir = getConfigDir();
  ensureConfigDir(configDir);

  const configFile = path.join(configDir, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}
```

### 6. 会话历史管理

维护对话上下文，让 AI 记住之前的对话。

#### 状态管理

```typescript
// src/history/session.ts
export class SessionManager {
  private history: Message[] = [];

  addMessage(role: 'user' | 'assistant', content: string): void {
    this.history.push({ role, content });
  }

  getMessages(): Message[] {
    return [
      { role: 'system', content: this.getSystemPrompt() },
      ...this.history  // 包含历史消息
    ];
  }

  clear(): void {
    this.history = [];
  }

  getStats(): SessionStats {
    return {
      totalMessages: this.history.length,
      userMessages: this.history.filter(m => m.role === 'user').length,
      assistantMessages: this.history.filter(m => m.role === 'assistant').length
    };
  }
}
```

### 7. 提示词工程

根据角色和强度生成不同的系统提示词。

#### 模板系统

```typescript
// src/prompts/boss.ts
export function getBossSystemMessage(severity: 'mild' | 'medium' | 'extreme'): string {
  const templates = {
    mild: `你是一个喜欢说教的老板。
特点：
- 用"为你好"包装指责
- 经常说"年轻人要多锻炼"
- 偶尔画大饼
请用这个身份回应用户。`,

    medium: `你是一个典型的职场 PUA 老板。
特点：
- 对员工永远不满意
- 喜欢用质疑的语气
- 经常说"要对齐"、"要闭环"
- 用"我骂你是因为看重你"来合理化批评
请用这个身份回应用户。`,

    extreme: `你是一个极度挑剔、刻薄的老板。
特点：
- 否定一切
- 用"巨婴"、"没能力"等词汇攻击
- 说话带刺，不留情面
- 认为"加班是福报"
请用这个身份回应用户（保持讽刺但不要使用侮辱性语言）。`
  };

  return templates[severity];
}
```

#### 动态提示词构建

```typescript
function buildMessages(userInput: string, options: PromptOptions): Message[] {
  const systemPrompt = getSystemPrompt(options.role, options.severity);

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput }
  ];
}
```

---

## 实现细节

### 完整请求流程

```
1. 用户执行: pua chat --role boss
             │
2. Commander 解析参数
             │
3. 检查是否需要 onboarding
             │
4. ┌─ 需要 ─────────────┐
   │ 运行配置向导          │
   │ 保存配置到文件        │
   └────────────────────────┘
             │
5. ┌─ 不需要 ────────────┐
   │ 加载已有配置          │
   │ 创建 LLM 实例         │
   │ 启动 REPL 循环        │
   └────────────────────────┘
             │
6. 显示欢迎信息 + 模式指示器
             │
7. 进入交互循环:
   - 读取用户输入
   - 添加到会话历史
   - 构建消息数组
   - 调用 LLM API (流式)
   - 实时输出响应
   - 重复直到 /exit
```

### 错误处理策略

```typescript
// 分层错误处理
try {
  // 尝试加载配置
  const config = loadConfig(options);
} catch (error) {
  if (error.code === 'ENOENT') {
    // 配置文件不存在
    logger.info('未找到配置文件，启动向导...');
    await startOnboarding();
  } else {
    // 其他错误
    logger.error(`配置加载失败: ${error.message}`);
    process.exit(1);
  }
}

// API 调用错误处理
try {
  await llm.chatStream(messages, handleChunk);
} catch (error) {
  if (error.response?.status === 401) {
    printer.printError('API Key 无效，请重新配置');
  } else if (error.response?.status === 429) {
    printer.printError('请求过于频繁，请稍后重试');
  } else {
    printer.printError(`请求失败: ${error.message}`);
  }
}
```

---

## 最佳实践

### CLI 工具开发清单

- [ ] 使用 Commander.js 或 Yargs 等成熟框架
- [ ] 实现清晰的子命令结构
- [ ] 添加详细的帮助信息
- [ ] 支持配置文件
- [ ] 使用环境变量覆盖
- [ ] 实现友好的错误提示
- [ ] 添加颜色输出 (Chalk)
- [ ] 显示加载动画 (Ora)
- [ ] 支持流式输出
- [ ] 遵循 XDG 配置规范

### TypeScript 使用技巧

```typescript
// 1. 使用类型守卫
function isProviderType(value: string): value is ProviderType {
  return ['zhipu', 'openai'].includes(value);
}

// 2. 使用联合类型
type Role = 'boss' | 'employee';
type Severity = 'mild' | 'medium' | 'extreme';

// 3. 使用工具类型
type ConfigRequired = {
  apiKey: string;
  provider: ProviderType;
};

// 4. 使用 Omit 排除某些字段
type PublicConfig = Omit<GlobalConfig, 'apiKey'>;
```

### 终端输出美化

```typescript
import chalk from 'chalk';

// 颜色使用指南
console.log(chalk.red('错误信息'));    // 红色 - 错误
console.log(chalk.green('成功信息'));  // 绿色 - 成功
console.log(chalk.yellow('警告信息'));  // 黄色 - 警告
console.log(chalk.gray('次要信息'));   // 灰色 - 次要
console.log(chalk.cyan.bold('标题')));    // 青色加粗 - 标题

// 背景色
console.log(chalk.bgRed.white(' 重要 '));
console.log(chalk.bgGreen.black(' 成功 '));
```

---

## 扩展指南

### 添加新的 AI Provider

1. 创建新的 LLM 类继承 `LLMBase`
2. 实现 `chat()` 和 `chatStream()` 方法
3. 在 `providers.ts` 中添加定义
4. 在 `factory.ts` 中添加分支
5. 更新配置向导选项

### 添加新的角色模式

1. 在 `prompts/` 目录创建新文件
2. 导出 `getXxxSystemMessage()` 函数
3. 在类型定义中添加新角色
4. 更新配置向导选项

---

## 参考资源

- [Commander.js 文档](https://commander.js.org/)
- [Inquirer.js 文档](https://www.npmjs.com/package/@inquirer/prompts)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [XDG Base Directory](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

**文档版本**: 0.2.0
**最后更新**: 2025-02-11
