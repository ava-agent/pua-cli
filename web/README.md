# PUA CLI - Web 版本

这是一个安全的 Web 版本，API Key 存储在服务器端，用户无法获取。

## 🔐 安全架构

```
用户浏览器 → Vercel API → 智谱 AI
             ↑
        API Key 在这里（安全）
```

**关键点**：
- ❌ 前端代码中没有任何 API Key
- ✅ API Key 存储在 Vercel 环境变量中
- ✅ 用户只能通过你的 API 调用 AI，无法获取 Key

## 📦 部署到 Vercel（免费）

### 1. 安装 Vercel CLI

```bash
npm install -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

### 3. 部署

```bash
cd web
vercel
```

按提示操作：
- 链接或创建新项目
- 选择部署到 Vercel
- 等待部署完成

### 4. 配置环境变量（重要！）

部署完成后，在 Vercel 项目中设置 API Key：

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加以下变量：
   - Name: `ZHIPU_API_KEY`
   - Value: 你的智谱 AI API Key
5. 保存后重新部署项目

```bash
vercel --prod
```

## 🎯 使用方法

部署完成后，访问 Vercel 给你的域名即可使用。

### 控制使用量（可选）

如果你想控制成本，可以在 API 中添加：

1. **Rate Limiting**：限制每个 IP 的请求次数
2. **每日配额**：设置每天最大请求数
3. **用户认证**：添加简单的登录系统

示例：添加每日配额限制（使用 Vercel KV）

```typescript
// 在 api/chat.ts 中添加
import { kv } from '@vercel/kv';

async function checkDailyLimit(ip: string) {
  const key = `limit:${ip}:${new Date().toDateString()}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 86400); // 24小时过期
  return count <= 100; // 每天100次限制
}
```

## 📊 成本估算

- **Vercel Hobby 计划**：免费
  - 100GB 带宽/月
  - 无限请求
  - 自动 HTTPS

- **智谱 AI API**：
  - glm-4-flash: 免费/低价
  - 按实际调用计费

## 🛠️ 本地开发

```bash
cd web
npm install

# 创建 .env 文件
echo "ZHIPU_API_KEY=your_key_here" > .env

# 运行开发服务器
npm run dev
```

访问 http://localhost:3000

## 🔒 安全提示

1. ✅ API Key 只存在于服务器环境变量
2. ✅ 前端代码中没有任何敏感信息
3. ✅ Vercel 的服务器端代码不会暴露给用户
4. ✅ 所有 AI 调用都通过你的后端

用户无法通过浏览器获取你的 API Key！
