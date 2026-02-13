# Workplace PUA CLI

> 一个趣味性 AI CLI 工具，具有 6 种角色模式：**老板**、**员工**、**产品经理**、**HR**、**技术主管**、**实习生**。

## 界面预览

### 配置完成界面
![Chat Mode](screenshots/chat-mode.png)

### 交互对话界面
![Chat Dialogue](screenshots/chat-dialogue.png)

---

## 角色介绍

### 老板模式 👔
- 对员工的工作永远不满意
- 喜欢用"为你好"来包装指责
- 经常说"年轻人要多锻炼"
- 喜欢画大饼，但从不兑现
- 用质疑的语气评价一切

### 员工模式 👤
- 对老板的任何要求都说"好的"
- 习惯性道歉
- 不敢表达真实想法
- 用卑微的语气回应一切
- 经常加班，从不敢拒绝

### 产品经理模式 📊
- 经常说"这个需求很简单"
- 喜欢画饼："下周上线"
- 习惯性改需求
- 善用黑话："对齐""赋能""闭环"

### HR 模式 💼
- 开口就是"公司就是家"
- 喜欢打感情牌
- 总是强调"要有格局"
- 喜欢说"年轻人要有狼性"

### 技术主管模式 💻
- 对代码各种质疑
- 喜欢指点江山
- 口头禅："你这代码不行""重写"
- 总是能发现架构问题

### 实习生模式 🌱
- 极度谦虚，总是说"哥/姐教我"
- 什么都想学
- 总是说"想学东西"
- 积极主动，但什么都不会

---

## 快速开始

### 一键安装（推荐）

```bash
# 直接从 npm 全局安装
npm install -g workplace-pua-cli

# 启动聊天（首次运行会自动进入配置向导）
pua chat
```

### 从源码安装

```bash
# 克隆项目
git clone https://github.com/ava-agent/pua-cli.git
cd pua_cli

# 安装依赖并构建
npm install && npm run build

# 全局安装
npm install -g .
```

配置向导会引导你：
- 选择 AI 服务提供商（智谱 AI / OpenAI）
- 输入 API Key
- 设置默认模型和角色

### 立即体验

```bash
# 老板模式 - PUA 别人
pua chat --role boss --severity extreme

# 员工模式 - 被 PUA
pua chat --role employee
```

#### 单次提示模式

```bash
# 直接提问
pua prompt --role boss "代码写完了"

# 管道输入（适合脚本调用）
echo "加班" | pua prompt --role employee
```

---

## 常用命令

### 主命令

| 命令 | 说明 |
|------|------|
| `pua chat` | 启动交互模式 |
| `pua prompt "问题"` | 单次提问 |
| `pua config` | 重新配置 |
| `pua config --show` | 查看配置 |

### 新增趣味命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `pua jargon` | 职场黑话生成器 | `pua jargon --type meeting` |
| `pua weekly` | 周报生成器 | `pua weekly --role pm` |
| `pua email` | 邮件语气转换 | `pua email --from pm --to dev "你好"` |
| `pua meeting` | 会议发言建议 | `pua meeting --role hr --scenario standup` |

### 交互模式内命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空会话历史 |
| `/history` | 查看历史 |
| `/info` | 显示会话统计信息 |
| `/save [名称]` | 保存当前会话 |
| `/sessions` | 列出所有会话 |
| `/load <ID>` | 加载指定会话 |
| `/exit` | 退出程序 |

---

## 配置说明

### 查看当前配置

```bash
pua config --show
```

### 重新配置

```bash
pua config
```

---

## 支持的 AI 服务提供商

| Provider | 代码 | 默认模型 | 说明 |
|----------|------|----------|------|
| 智谱 AI | `zhipu` | `glm-4.7` | 国产，稳定 |
| OpenAI | `openai` | `gpt-4o` | 国际通用 |

---

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--provider <zhipu\|openai>` | AI 服务提供商 |
| `--role <boss\|employee\|pm\|hr\|techlead\|intern>` | 角色模式（6 种角色） |
| `--model <model>` | 模型名称 |
| `--severity <mild\|medium\|extreme>` | PUA 强度 |
| `--format <text\|markdown\|json>` | 输出格式 |

---

## 使用场景

### 趣味对话

体验"职场 PUA"的趣味互动：

```bash
# 老板模式 - PUA 别人
pua chat --role boss --severity extreme

# 产品经理模式 - 画饼大师
pua chat --role pm

# HR 模式 - 公司就是家
pua chat --role hr
```

### 职场黑话生成

生成各种类型的职场黑话：

```bash
# 生成会议黑话
pua jargon --type meeting --intensity heavy

# 生成报告黑话
pua jargon --type report

# 翻译普通文本为黑话
pua jargon "帮我做个PPT"
```

### 周报生成

根据不同角色自动生成周报：

```bash
# 产品经理周报
pua weekly --role pm

# HR 周报
pua weekly --role hr

# 开发人员周报
pua weekly --role techlead
```

### 邮件语气转换

转换不同角色之间的邮件语气：

```bash
# PM -> 开发
pua email --from pm --to dev "请查收附件"

# HR -> 员工（紧急）
pua email --from hr --to employee --tone urgent "今天加班"

# 开发 -> PM
pua email --from dev --to pm "已完成开发"
```

### 会议发言建议

根据不同会议场景生成发言建议：

```bash
# 站会发言
pua meeting --role pm --scenario standup

# 代码评审发言
pua meeting --role techlead --scenario review

# 头脑风暴发言
pua meeting --role intern --scenario brainstorm
```

### AI 工作流

在脚本中作为提示词生成器：

```bash
# 生成批评性提示
critique=$(pua prompt --role boss "代码质量差")

# 传递给其他工具
echo "$critique" | your-ai-tool --prompt "{}"
```

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

---

## 配置文件位置

- **Windows**: `%APPDATA%\pua-cli\config.json`
- **Linux/macOS**: `~/.config/pua-cli/config.json`

---

## 获取 API Key

### 智谱 AI（推荐）

- 访问 [bigmodel.cn](https://bigmodel.cn/)
- 完成实名认证后免费获取 2000 万 tokens
- 在控制台复制 API Key

### OpenAI

- 访问 [platform.openai.com](https://platform.openai.com/)
- 注册账号并在 API Keys 页面创建 Key

---

## 文档

### 📘 [详细技术文档](docs/TECHNICAL_PRINCIPLES.md)
完整的 CLI 工具开发实践，包含架构设计、实现细节和最佳实践

### 🚀 [优化方案](docs/OPTIMIZATION.md)
7 大优化方案的完整技术分析，参考 Claude Code、Gemini CLI 等优秀 AI CLI

### 📜 [更新日志](CHANGELOG.md)
版本历史和变更记录

---

## 免责声明

本工具仅供娱乐和学习使用，通过角色扮演的方式对职场 PUA 现象进行讽刺和调侃。

---

## License

MIT

© 2025 PUA CLI Contributors
