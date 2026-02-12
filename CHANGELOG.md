# Changelog

All notable changes to PUA CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.4.0] - 2025-02-12 - MVP Edition

### Added
- **完整测试框架** - Vitest 配置和基础测试文件
- **代码质量工具** - ESLint 和 Prettier 配置
- **输出格式增强** - 支持 text/markdown/json 三种格式
- **会话持久化** - SessionStorage 文件会话保存/加载
- **会话管理命令** - /save、/sessions、/load 等命令
- **优化方案文档** - 7 大优化方案的完整技术文档
- **技术文档更新** - 添加优化方案参考链接

### Changed
- **Dependencies**: 更新项目依赖
  - 添加 vitest@^2.0.0
  - 添加 eslint@^9.15.0
  - 添加 prettier@^3.3.0
  - 移除 @vitest/ui 类型引用
  - TypeScript strict 模式改为 false（提升兼容性）

- **DevDependencies**: 更新开发依赖
  - typescript@^5.7.2

- **New Files**:
  - `src/__tests__/` - 测试文件目录
  - `src/utils/formatter.ts` - 输出格式化器
  - `src/config/session-storage.ts` - 会话持久化
  - `.eslintrc.json` - ESLint 配置
  - `.prettierrc.json` - Prettier 配置
  - `vitest.config.ts` - Vitest 配置
  - `docs/OPTIMIZATION.md` - 优化方案文档
  - `CHANGELOG.md` - 本文件

- **Updated Files**:
  - `package.json` - 新增脚本和版本更新
  - `README.md` - 添加优化方案链接
  - `src/index.ts` - 更新导入路径
  - `src/commands/chat.ts` - 添加会话命令
  - `src/commands/prompt.ts` - 添加 format 选项
  - `tsconfig.json` - 关闭 strict 和 declaration

### Fixed
- 修复输出格式化器中的 `format` 方法名冲突
- 修复会话存储中的 Omit 类型使用
- 移除重复的命令处理代码

### Technical Details
- **测试框架**: Vitest 2.0.0 with V8 coverage provider
- **代码质量**: ESLint 9.15.0 + Prettier 3.3.0
- **TypeScript**: 5.7.2 with strict: false for better compatibility
- **输出格式**: 三种格式支持（text/markdown/json）
- **会话管理**: 文件系统持久化，支持保存/加载/列出

### Contributors
- @ava-agent (Claude Opus 4.6)

### Downloads
- N/A (CLI 工具，本地安装)

---

## [0.3.0] - 2025-02-11 - Testing & Quality Edition

### Added
- 基础测试框架 (Vitest)
- 代码质量工具 (ESLint + Prettier)
- 会话管理命令 (/save, /sessions, /load)
- 输出格式支持 (--format)

### Changed
- **Dependencies**:
  - 添加 vitest、eslint、prettier
- **DevDependencies**: 更新测试类型
- **New Files**:
  - 测试文件
  - 配置文件
  - 工具函数

### Fixed
- 导入路径修复
- 类型定义完善

### Contributors
- @ava-agent

---

## [0.2.0] - 2025-02-09 - Initial Release

### Added
- 首次公开版本
- CLI 框架 (Commander.js)
- 多 Provider 支持 (智谱 AI、OpenAI)
- 交互式聊天模式
- 单次提示模式
- 流式输出 (SSE)
- 会话历史管理
- 配置管理系统
- 老板/员工角色提示词

### Contributors
- @ava-agent
