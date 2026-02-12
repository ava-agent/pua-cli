# PUA CLI 优化分析

## 架构分析

### 当前架构（用户提供的图）

```
┌─────────────────────────────────────────────────────────────┐
│                      PUA CLI 架构                      │
├─────────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌──────────┐  ┌──────────────┐              │
│  │ CLI Layer  │────│ Config Layer│  │ Prompt Layer │              │
│  │ (Commander) │    │ (Settings) │  │ (Boss/Empl)│              │
│  └──────┬──────┘    └──────┬───────┘              │
│         │                    │                            │
│         ▼                    ▼                            ▼         │
│  ┌─────────────────────────────────────────────────┐       │
│  │          LLM Layer (Factory Pattern)     │       │
│  │                                            │         │
│  │  ┌──────────────────────────────────────────┐│         │
│  │  │ Abstract Base (LLMBase)              ││         │
│  │  │ - chat() 抽象方法                ││         │
│  │  │ - chatStream() 抽象方法           ││         │
│  │  │ - 流式处理 (SSE)                  ││         │
│  │  └──────────┬──────────────────────────┘│         │
│  │             │                            │         │
│  │  ┌─────────┴────────┐              │         │
│  │  │ ZhipuLLM  │  OpenAI     │         │
│  │  └──────────┬─────────┘              │         │
│  │             │                            │         │
└─────────────┼─────────────────┼──────────────┘         │
              │                   │
         ┌─────────┴─────────┐         │
         │  AI 服务提供商          │         │
         │  - 智谱 AI (zhipu)   │         │
         │  - OpenAI              │         │
         └───────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 架构优势分析

#### ✅ 当前优势
1. **清晰的分层** - 4 层架构，职责分明
2. **工厂模式** - 易于扩展新 Provider
3. **抽象基类** - LLM 接口统一
4. **会话管理** - 内存中的上下文维护
5. **配置分层** - 多源配置合并
6. **流式输出** - SSE 实时响应

#### ⚠️ 当前不足
1. **无标准 CLI 框架** - 使用 Commander.js（非 OCLIF）
2. **缺少插件系统** - 功能扩展能力有限
3. **无缓存机制** - 重复请求无优化
4. **会话无持久化** - 重启丢失上下文
5. **输出格式单一** - 仅支持纯文本
6. **无成本追踪** - 无法监控 token 使用
7. **错误处理简单** - 缺少重试机制
8. **测试覆盖不足** - 当前测试仅占源码 10%

---

## 优化方案

### 方案 1: CLI 框架升级 (OCLIF)

#### 目标
实现符合 [OCLIF](https://oclif.io/) 标准的命令行工具，提升专业性和互操作性。

#### 实施细节

```typescript
// src/core/oclif-commands.ts
import { Args, Command, Flags } from '@oclif/core';

export class ChatCommand extends Command {
  static flags = {
    role: Flags.custom({
      description: '角色模式',
      options: ['boss', 'employee'],
      default: 'boss',
      helpGroup: 'AI',
    }),
    severity: Flags.string({
      description: 'PUA 强度',
      options: ['mild', 'medium', 'extreme'],
      default: 'medium',
    }),
  };

  static description = '启动交互式 PUA 聊天';

  async run() {
    const { flags } = this.parse(ChatCommand);
    // OCLIF 自动生成帮助和使用说明
    this.log('启动', flags.role, '模式');
  }
}

// src/index.ts - OCLIF 风格
import { CLI } from '@oclif/core';

const cli = new CLI({
  id: 'pua',
  description: 'PUA CLI - 趣味 AI 职场角色扮演工具',
  commands: [ChatCommand, PromptCommand, ConfigCommand],
  // 全局选项
  flags: {
    version: Flags.boolean({ description: '显示版本号' }),
    verbose: Flags.boolean({ description: '详细输出' }),
  },
});

// 自动生成帮助、使用说明和文档
cli.parse().catch((error) => {
  if (error instanceof Error) {
    this.error(error.message);
    process.exit(1);
  }
});
```

#### 收益
- ✅ 自动生成的标准帮助格式
- ✅ 更好的参数组织（支持嵌套子命令）
- ✅ 标准化的错误处理和退出码
- ✅ 更好的多语言支持基础

---

### 方案 2: 插件系统架构

#### 目标
实现类似 VS Code 插件或 MCP (Model Context Protocol) 的插件系统，支持动态扩展功能。

#### 实施细节

```typescript
// src/core/plugin-manager.ts
interface PUAPLugin {
  name: string;
  version: string;
  author?: string;
  description?: string;

  // 命令扩展
  commands?: PluginCommand[];

  // 提示词模板
  prompts?: PromptTemplate[];

  // 钩子
  hooks?: {
    beforeChat?: (config: ChatConfig) => void;
    afterResponse?: (response: string) => void;
    onConfigChange?: (key: string, value: any) => void;
  };
}

// 自定义角色插件
export class CustomRolePlugin implements PUAPLugin {
  name = 'custom-dev-lead';
  version = '1.0.0';
  description = '开发主管角色 - 更严厉更专业';

  commands: [
    {
      name: 'review',
      handler: async (input: string) => {
        return `# 代码评审\n\n你写的代码是什么垃圾？${input}\n\n重写！`;
      }
    }
  ];
}

// 插件管理器
export class PluginManager {
  private plugins: Map<string, PUAPLugin> = new Map();
  private pluginDir: string;

  async loadPlugin(pluginPath: string): Promise<void> {
    const plugin = require(pluginPath);
    this.plugins.set(plugin.name, plugin);
    console.log(`✓ 已加载插件: ${plugin.name}`);
  }

  getCommands(): PluginCommand[] {
    return Array.from(this.plugins.values())
      .flatMap(plugin => plugin.commands || []);
  }
}
```

#### 收益
- ✅ 用户可创建自定义角色
- ✅ 社区可贡献角色模板
- ✅ 核心功能与扩展解耦
- ✅ 支持插件的热加载/卸载

---

### 方案 3: 配置验证系统

#### 目标
使用 Zod 进行运行时配置验证，提供类型安全的配置管理。

#### 实施细节

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const ConfigSchema = z.object({
  // Provider 验证
  provider: z.enum(['zhipu', 'openai'], {
    errorMap: {
      invalid_type_error: '不支持的 AI 服务商',
    },
  }),

  // API Key 验证
  apiKey: z.string().min(10, {
    errorMap: {
      too_small: 'API Key 长度不能少于 10 个字符',
    },
  }),

  // 模型验证
  model: z.string().default('glm-4.7', {
    errorMap: {
      invalid_model: '模型名称无效',
    },
  }),

  // 角色验证
  role: z.enum(['boss', 'employee'], {
    errorMap: {
      invalid_role: '角色必须是 boss 或 employee',
    },
  }),

  // 强度验证
  severity: z.enum(['mild', 'medium', 'extreme']).default('medium'),

  // 输出格式验证
  format: z.enum(['text', 'markdown', 'json']).default('text'),
});

export type Config = z.infer<typeof ConfigSchema>;

// 运行时验证
export function loadAndValidateConfig(input: unknown): Result<Config, ZodError> {
  try {
    const config = ConfigSchema.parse(input);
    return { success: true, data: config };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // 返回详细的错误信息
      return {
        success: false,
        error: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        }))
      };
    }
    return { success: false, error: { message: '未知错误' } };
  }
}
```

#### 收益
- ✅ 运行时类型检查
- ✅ 详细的错误提示（多语言支持）
- ✅ 配置迁移和版本管理
- ✅ 防止无效配置导致的问题

---

### 方案 4: 缓存系统

#### 目标
实现多层缓存机制，减少 API 调用次数和响应时间。

#### 实施细节

```typescript
// src/cache/cache-manager.ts
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // 存活时间（秒）
  hits: number; // 命中次数
}

export class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private diskCacheDir: string;

  constructor() {
    this.diskCacheDir = path.join(os.homedir(), '.pua-cli', 'cache');
    this.ensureCacheDir();
  }

  // 获取缓存（内存 > 磁盘）
  async get<T>(key: string): Promise<T | null> {
    // 先查内存
    const memEntry = this.memoryCache.get(key);
    if (memEntry && Date.now() - memEntry.timestamp < memEntry.ttl * 1000) {
      memEntry.hits++;
      return memEntry.value;
    }

    // 再查磁盘
    return await this.getFromDisk<T>(key);
  }

  // 设置缓存
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      hits: 0,
    };

    // 写入内存
    this.memoryCache.set(key, entry);

    // 异步写入磁盘
    this.setToDisk(key, entry);
  }

  // 清理过期缓存
  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(key);
        await this.deleteFromDisk(key);
      }
    }
  }
}
```

#### 缓存策略

| 缓存类型 | TTL | 用途 |
|---------|-----|------|
| 提示词缓存 | 永久 | 减少重复生成系统提示词 |
| API 响应缓存 | 1 小时 | 相同问题快速返回 |
| 会话历史缓存 | 会话期 | 重启后快速恢复上下文 |
| 配置缓存 | 永久 | 加速配置加载 |

#### 收益
- ✅ 减少 API 调用成本
- ✅ 提升响应速度
- ✅ 降低延迟感知
- ✅ 支持离线模式（部分功能）

---

### 方案 5: 会话持久化增强

#### 目标
实现完整的会话持久化系统，支持会话的保存、加载、搜索、导出、导入。

#### 实施细节

```typescript
// src/session/persistent-session-manager.ts
export interface SessionMetadata {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  role: string;
  severity: string;
  provider: string;
  model: string;
  tokensUsed: number;
}

export class PersistentSessionManager {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.pua-cli', 'sessions');
    this.ensureDir();
  }

  // 保存会话（包含完整元数据）
  async saveSession(options: {
    name?: string;
    description?: string;
    tags?: string[];
  autoSave?: boolean;
  } = Promise<SessionMetadata> {
    const session: SessionMetadata = {
      id: generateId(),
      name: options.name || '未命名会话',
      description: options.description || '',
      tags: options.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: sessionManager.getMessageCount(),
      role: currentConfig.role,
      severity: currentConfig.severity,
      provider: currentConfig.provider,
      model: currentConfig.model,
      tokensUsed: sessionManager.getTokensUsed(),
    };

    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

    return session;
  }

  // 搜索会话
  searchSessions(query: string): SessionMetadata[] {
    const sessions = this.listSessions();

    if (!query) return sessions;

    const lowerQuery = query.toLowerCase();
    return sessions.filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description?.toLowerCase().includes(lowerQuery) ||
      s.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // 导出会话
  exportSessions(sessionIds: string[], format: 'json' | 'markdown'): void {
    const sessions = sessionIds.map(id => this.loadSession(id))
      .filter(Boolean);

    const data = format === 'json'
      ? JSON.stringify(sessions, null, 2)
      : this.toMarkdown(sessions);

    const exportPath = path.join(os.homedir(), 'pua-cli', `sessions-export.${Date.now()}.${format}`);
    fs.writeFileSync(exportPath, data);

    console.log(`✓ 已导出 ${sessions.length} 个会话到 ${exportPath}`);
  }

  // 导入会话
  importSessions(importFile: string): void {
    const content = fs.readFileSync(importFile, 'utf-8');
    const sessions = JSON.parse(content) as SessionMetadata[];

    for (const session of sessions) {
      const filePath = path.join(this.sessionsDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    }

    console.log(`✓ 已导入 ${sessions.length} 个会话`);
  }
}
```

#### 命令扩展

```bash
# 新增会话管理命令
/sessions                    # 列出所有会话
/save [名称] [描述...]    # 保存当前会话
/load <ID>                  # 加载指定会话
/export <format>              # 导出所有会话
/import <file>               # 导入会话文件
/delete <ID>                # 删除指定会话
/search <关键词>             # 搜索会话
/tag <标签>                 # 为当前会话添加标签
```

#### 收益
- ✅ 重启不丢失上下文
- ✅ 支持多会话管理
- ✅ 会话可搜索和分类
- ✅ 支持会话导出/导入

---

### 方案 6: 成本追踪系统

#### 目标
实现完整的 token 使用追踪和成本计算功能，帮助用户控制使用成本。

#### 实施细节

```typescript
// src/cost/token-tracker.ts
export interface TokenUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  timestamp: number;
}

export interface CostSummary {
  totalTokens: number;
  totalCost: number;
  currency: string;
  breakdownByProvider: Record<string, number>;
  breakdownByModel: Record<string, number>;
}

export class TokenTracker {
  private usageFile: string;

  // 定价（示例）
  private pricing = {
    zhipu: {
      'glm-4.7': 0.0005,  // 每千 tokens 价格
      'glm-4.7-flash': 0.0001,
    },
    openai: {
      'gpt-4o': 0.005,
      'gpt-4o-mini': 0.00015,
    },
  };

  constructor() {
    this.usageFile = path.join(os.homedir(), '.pua-cli', 'usage.json');
  }

  // 记录 token 使用
  async recordUsage(usage: TokenUsage): Promise<void> {
    const record: TokenUsage = {
      ...usage,
      timestamp: Date.now(),
    };

    const history = this.getUsageHistory();
    history.push(record);
    fs.writeFileSync(this.usageFile, JSON.stringify(history, null, 2));
  }

  // 获取今日统计
  getTodayStats(): CostSummary {
    const today = new Date().toDateString();
    const history = this.getUsageHistory();

    const todayUsage = history.filter(u =>
      new Date(u.timestamp).toDateString() === today
    );

    const totalTokens = todayUsage.reduce((sum, u) => sum + u.outputTokens, 0);
    const totalCost = this.calculateCost(todayUsage);

    return {
      totalTokens,
      totalCost,
      currency: 'CNY',
      breakdownByProvider: this.groupByProvider(todayUsage),
      breakdownByModel: this.groupByModel(todayUsage),
    };
  }

  // 显示成本统计
  async showStats(days: number = 7): Promise<void> {
    const stats = this.getStats(days);

    console.log(`\n📊 Token 使用统计（最近 ${days} 天）\n`);
    console.log('─'.repeat(50));

    console.log(`总 Token: ${stats.totalTokens.toLocaleString()}`);
    console.log(`总成本: ¥${stats.totalCost.toFixed(2)}`);
    console.log(`\n按 Provider:`);
    for (const [provider, cost] of Object.entries(stats.breakdownByProvider)) {
      console.log(`  ${provider}: ¥${cost.toFixed(2)}`);
    }

    console.log(`\n按模型:`);
    for (const [model, cost] of Object.entries(stats.breakdownByModel)) {
      console.log(`  ${model}: ¥${cost.toFixed(2)}`);
    }
  }
}
```

#### 命令

```bash
# 成本管理命令
/cost                        # 显示成本统计
/cost --days 7             # 显示指定天数统计
/cost --today               # 只显示今日
/cost --export               # 导出成本数据
```

#### 收益
- ✅ 实时成本监控
- ✅ 历史趋势分析
- ✅ 预算提醒
- ✅ 按 Provider/模型分组统计

---

### 方案 7: 错误处理增强

#### 目标
实现统一的错误处理机制，包括重试、回退、错误分类等。

#### 实施细节

```typescript
// src/utils/error-handler.ts
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
}

export class AppError extends Error {
  type: ErrorType;
  retryable: boolean;
  userMessage: string;
  originalError?: Error;

  constructor(
    type: ErrorType,
    message: string,
    retryable: boolean = true,
    originalError?: Error
  ) {
    super(message);
    this.type = type;
    this.retryable = retryable;
    this.originalError = originalError;
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 秒

  async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
    options?: {
      maxRetries?: number;
      baseDelay?: number;
      exponentialBackoff?: boolean;
    }
  ): Promise<T> {
    const opts = {
      maxRetries: options?.maxRetries || this.maxRetries,
      baseDelay: options?.baseDelay || this.baseDelay,
      exponentialBackoff: options?.exponentialBackoff ?? true,
    };

    let lastError: Error | null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;

        // 最后一次尝试不重试
        if (attempt === opts.maxRetries) break;

        // 指数退避
        const delay = opts.exponentialBackoff
          ? opts.baseDelay * Math.pow(2, attempt)
          : opts.baseDelay;

        await this.sleep(delay);
      }
    }

    // 所有重试都失败
    throw new AppError(
      ErrorType.NETWORK_ERROR,
      `${context} 失败: ${opts.maxRetries} 次重试`,
      true,
      lastError
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 分类错误处理
  handle(error: unknown): void {
    if (error instanceof AppError) {
      switch (error.type) {
        case ErrorType.RATE_LIMIT_ERROR:
          console.warn('⚠️  请求过于频繁，请稍后重试');
          break;
        case ErrorType.NETWORK_ERROR:
          console.error('❌ 网络错误，请检查网络连接');
          break;
        case ErrorType.VALIDATION_ERROR:
          console.error('❌ 配置错误:', error.message);
          break;
        default:
          console.error('❌ 未知错误:', error.message);
      }
    } else {
      console.error('❌ 未知错误:', String(error));
    }
  }
}
```

#### 收益
- ✅ 网络错误自动重试
- ✅ 指数退避避免过载
- ✅ 用户友好的错误提示
- ✅ 错误分类和针对性处理

---

## 实施优先级

### 第一阶段：基础巩固 (1-2 周)
- [x] 修复 TypeScript 类型问题
- [ ] 完善测试覆盖到 60%
- [ ] 优化错误处理

### 第二阶段：架构升级 (2-4 周)
- [ ] 迁移到 OCLIF 框架
- [ ] 实现配置验证系统
- [ ] 添加缓存机制

### 第三阶段：功能增强 (4-6 周)
- [ ] 实现插件系统基础
- [ ] 实现会话持久化增强
- [ ] 实现成本追踪系统
- [ ] 添加智能自动补全

### 第四阶段：生态完善 (6-8 周)
- [ ] 多语言支持
- [ ] 社区贡献模板
- [ ] CI/CD 流水线
- [ ] 完善文档和示例

---

## 参考资源

- [OCLIF 规范](https://oclif.io/)
- [Ink - React for CLIs](https://github.com/vadimdemoneda/ink)
- [Zod - TypeScript Schema Validation](https://zod.dev/)
- [Bull - Redis for Node.js](https://github.com/OptimalBits/bull)
- [node-cache-manager](https://github.com/NodeRedis/node-cache-manager)
- [Commander.js vs OCLIF](https://stackoverflow.com/questions/38242272/commander-js-vs-oclif)
- [Pexels Terminal Icons](https://www.pexels.com/) - for CLI icons

---

**文档版本**: 1.0.0
**最后更新**: 2025-02-12
