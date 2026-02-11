# PUA CLI

> 一个趣味性 AI CLI 工具，具有两种角色模式：**老板模式**和**员工模式**。

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

## 快速开始

### 一键安装

```bash
# 克隆项目
git clone https://github.com/your-username/pua_cli.git
cd pua_cli

# 安装依赖并构建
npm install && npm run build

# 全局安装
npm install -g .
```

### 首次使用

```bash
# 启动聊天（首次运行会自动进入配置向导）
pua chat
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

## 常用命令

| 命令 | 说明 |
|------|------|
| `pua chat` | 启动交互模式 |
| `pua prompt "问题"` | 单次提问 |
| `pua config` | 重新配置 |
| `pua config --show` | 查看配置 |

### 交互模式内命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清空历史 |
| `/history` | 查看历史 |
| `/exit` | 退出 |

## 配置说明

### 查看当前配置

```bash
pua config --show
```

### 重新配置

```bash
pua config
```

## 支持的 AI 服务提供商

| Provider | 代码 | 默认模型 | 说明 |
|----------|------|----------|------|
| 智谱 AI | `zhipu` | `glm-4.7` | 国产，稳定 |
| OpenAI | `openai` | `gpt-4o` | 国际通用 |

## 命令行选项

| 选项 | 说明 |
|------|------|
| `--provider <zhipu\|openai>` | AI 服务提供商 |
| `--role <boss\|employee>` | 角色模式 |
| `--model <model>` | 模型名称 |
| `--severity <mild\|medium\|extreme>` | PUA 强度 |

## 使用场景

### 趣味对话

体验"职场 PUA"的趣味互动：

```bash
pua chat --role boss --severity extreme
```

### AI 工作流

在脚本中作为提示词生成器：

```bash
# 生成批评性提示
critique=$(pua prompt --role boss "代码质量差")

# 传递给其他工具
echo "$critique" | your-ai-tool
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## 配置文件位置

- **Windows**: `%APPDATA%\pua-cli\config.json`
- **Linux/macOS**: `~/.config/pua-cli/config.json`

## 获取 API Key

### 智谱 AI（推荐）

- 访问 [bigmodel.cn](https://bigmodel.cn/)
- 完成实名认证后免费获取 2000 万 tokens
- 在控制台复制 API Key

### OpenAI

- 访问 [platform.openai.com](https://platform.openai.com/)
- 注册账号并在 API Keys 页面创建 Key

## 免责声明

本工具仅供娱乐和学习使用，通过角色扮演的方式对职场 PUA 现象进行讽刺和调侃。

## License

MIT
