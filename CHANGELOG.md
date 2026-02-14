# Changelog

All notable changes to PUA CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.6.0] - 2026-02-14 - Meeting Room Edition

### Added
- **会议室功能（核心）**: 多角色同时参会的职场会议模拟
  - 支持 2-6 个角色同时参与会议
  - 上下文链调用（Context Chaining）：角色能回应其他角色的发言
  - 角色间动态关系系统（老板-HR同盟、PM-技术对立等）
  - 关键词智能匹配回复者选择算法
  - 情绪检测系统（angry/smug/worried/submissive/excited）
- **Web 会议室** (`web/meeting.html`):
  - 独立 SPA 页面，不影响 v1 功能
  - 元素人画风 CSS 头像系统（渐变圆形 + emoji + 情绪光环动画）
  - 两个视图：会议设置 → 会议进行中
  - 角色选择网格（6个角色卡片）
  - 会议类型选择（站会/头脑风暴/评审/回顾/规划/紧急会议）
  - 混乱程度滑块（有序/标准/混乱）
  - 打字指示器动画 + 交错延迟回复
  - 随机会议事件系统（10%概率触发趣味事件）
  - 会议评分卡（画饼次数、黑话密度、有效决策数、金句高亮）
- **CLI 会议室** (`pua meeting-room`):
  - 交互式参会者选择（checkbox）
  - 多角色彩色边框输出
  - 支持 /score（评分卡）、/minutes（会议纪要）、/exit 命令
  - 随机会议事件
- **Web 入口**: 1v1 页面状态栏添加 Meeting Room 链接

### Technical Details
- **新增文件**:
  - `web/meeting.html` - 会议室 Web 页面
  - `web/api/meeting.ts` - 会议室 API（Vercel serverless）
  - `src/prompts/meeting-prompts.ts` - 会议专用 prompt + 角色昵称/关系
  - `src/commands/meeting-room.ts` - CLI 会议室命令
  - `src/utils/meeting-utils.ts` - 共享工具函数
- **修改文件**:
  - `src/index.ts` - 注册 meeting-room 命令，版本升级
  - `web/index.html` - 状态栏添加会议室链接
  - `README.md` - 添加会议室文档
  - `package.json` - 版本升级至 0.6.0

### Contributors
- @ava-agent (Claude Opus 4.6)

---

## [0.5.1] - 2026-02-14 - Bug Fix & UX Enhancement Edition

### Fixed
- **Website**: 修复缺失的 `.terminal` 和 `.terminal-header` CSS 类导致的布局异常
- **Website**: 修复 ASCII art 显示乱码
- **Website**: 修复版本号不一致（v0.4.0 -> v0.5.0）
- **Website**: 修复 npm 包名显示错误（pua-cli -> workplace-pua-cli）
- **Website**: 改进 429/400 错误提示为用户友好文案
- **CLI**: 修复默认帮助文本仅显示 2 种角色（现正确显示全部 6 种）
- **CLI**: 移除 index.ts 中未使用的 Box/Theme 导入
- **文档**: 修复 README 重复的"快速开始"章节
- **文档**: 修复重复的安装命令
- **文档**: 移除不存在的 `web/assets/` 目录引用
- **文档**: 统一 Node.js 版本要求为 >=18.0.0

### Added
- **Website**: 添加 SEO meta 标签（description, Open Graph, Twitter Card）
- **Website**: 输入区域改为 textarea 支持多行输入
- **Website**: 添加发送按钮
- **Website**: 添加键盘快捷键提示（Enter/Shift+Enter/Esc）
- **Website**: 状态栏添加 GitHub 和 npm 链接
- **Website**: 移动端隐藏 ASCII art 避免显示异常

---

## [0.5.0] - 2025-02-13 - Feature Expansion Edition

### Added
- **新增 4 个角色**:
  - 产品经理 (PM) - 画饼大师，善用黑话
  - HR - 公司就是家，打感情牌
  - 技术主管 - 指点江山，质疑代码
  - 实习生 - 谦虚好学，求带求教
- **职场黑话生成器** (`pua jargon`)
  - 支持多种类型：会议、报告、邮件、聊天
  - 支持强度调节：轻度、中度、重度
  - 支持普通文本翻译为黑话
- **周报生成器** (`pua weekly`)
  - 根据不同角色自动生成周报
  - 包含本周工作、下周计划、风险问题、数据统计
  - 支持指定周数
- **邮件语气转换器** (`pua email`)
  - 支持不同角色之间的邮件语气转换
  - 支持多种语气：礼貌、紧急、随意、委婉
  - 支持角色别名（dev、team 等）
- **会议发言建议** (`pua meeting`)
  - 支持多种会议场景：站会、评审、头脑风暴、回顾、规划
  - 根据角色和场景生成针对性发言建议
- **统一边框渲染系统**:
  - 支持多种边框样式：单线、双线、圆角
  - 支持自定义宽度、内边距、标题
  - 提供多种预设：info、success、warning、error
- **颜色主题系统**:
  - 4 种预定义主题：默认、暗色、多彩、极简
  - 支持主题切换和列表显示

### Changed
- **配置向导**:
  - 更新角色选择，新增 4 个角色选项
  - 更新示例命令，包含新功能介绍
  - 改进配置显示格式
- **类型系统**:
  - RoleType 扩展为 6 种角色
  - GlobalConfig 和 ProjectConfig 支持新角色

### Fixed
- 修复 box.ts 中的类型定义和语法错误
- 修复 theme.ts 中的 chalk.Color 类型问题
- 修复 jargon.ts 中的类型转换错误
- 修复 weekly.ts 中的 Date.getWeek() 方法不存在问题
- 修复 email.ts 中的角色模板键名不匹配问题
- 移除遗留开发文件 chat-new-imports.ts

### Technical Details
- **新增文件**:
  - `src/prompts/pm.ts` - 产品经理提示词
  - `src/prompts/hr.ts` - HR 提示词
  - `src/prompts/techlead.ts` - 技术主管提示词
  - `src/prompts/intern.ts` - 实习生提示词
  - `src/commands/jargon.ts` - 黑话生成器命令
  - `src/commands/weekly.ts` - 周报生成器命令
  - `src/commands/email.ts` - 邮件语气转换命令
  - `src/commands/meeting.ts` - 会议发言建议命令
  - `src/utils/box.ts` - 边框渲染工具
  - `src/utils/theme.ts` - 主题管理系统

### Contributors
- @ava-agent (Claude Opus 4.6)

---

## [0.4.1] - 2025-02-12

### Changed
- **Package name**: renamed from `pua-cli` to `workplace-pua-cli` to avoid naming conflict
- **Installation**: Updated README with npm installation instructions

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
