/**
 * 职场黑话生成器 API 端点
 * 支持两种模式：翻译模式（普通话 -> 黑话）和生成模式（主题 -> 黑话发言）
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 有效的模式和场景
const VALID_MODES = ['translate', 'generate'];
const VALID_SCENES = ['meeting', 'report', 'email', 'chat'];

// 场景中文名映射
const SCENE_NAMES: Record<string, string> = {
  meeting: '会议发言',
  report: '工作汇报',
  email: '邮件沟通',
  chat: '日常聊天',
};

// 速率限制 - 内存中，Vercel serverless 冷启动会重置
// 生产环境建议使用 Upstash Redis
const jargonRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 定期清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of jargonRateLimitMap.entries()) {
    if (now > data.resetTime) {
      jargonRateLimitMap.delete(ip);
    }
  }
}, 60000);

// 获取客户端 IP
function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

// 检查速率限制
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = jargonRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    jargonRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

// 输入验证
function validateInput(
  mode: string,
  input: string,
  scene?: string
): { valid: boolean; error?: string } {
  if (!mode || !VALID_MODES.includes(mode)) {
    return { valid: false, error: '无效的模式，请选择 translate 或 generate' };
  }

  if (!input || input.trim().length === 0) {
    return { valid: false, error: '输入内容不能为空' };
  }

  if (input.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `输入长度不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }

  if (scene !== undefined && !VALID_SCENES.includes(scene)) {
    return { valid: false, error: '无效的场景选择' };
  }

  // 检查禁止的词语（防止 XSS 和注入攻击）
  const lowerInput = input.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerInput.includes(word)) {
      return { valid: false, error: '输入包含不安全的内容' };
    }
  }

  return { valid: true };
}

// 清洗输入文本
function sanitizeInput(text: string): string {
  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

// 构建系统提示
function buildSystemPrompt(mode: string, scene?: string): string {
  const sceneName = scene ? SCENE_NAMES[scene] || '日常聊天' : '日常聊天';

  if (mode === 'translate') {
    return `你是一个职场黑话翻译器。把用户输入的普通话翻译成充满职场黑话的版本。

翻译规则：
- 把简单的话用复杂的职场术语替换
- 多用"赋能"、"对齐"、"闭环"、"抓手"、"颗粒度"、"底层逻辑"、"打通"、"拉齐"、"破圈"、"组合拳"、"链路"等词汇
- 保持原意但让表达更"高大上"
- 语气要正式但略显浮夸
- 回复只输出翻译结果，不要解释

场景：${sceneName}`;
  }

  return `你是一个职场黑话生成器。根据用户给的主题，生成一段充满职场黑话的发言。

生成规则：
- 围绕用户主题，生成3-5句职场黑话
- 大量使用"赋能"、"对齐"、"闭环"、"抓手"、"颗粒度"、"底层逻辑"、"打通"、"拉齐"、"破圈"、"组合拳"、"链路"、"生态"、"矩阵"等词汇
- 听起来很专业但其实啥也没说
- 适合在会议/汇报/邮件中使用
- 回复只输出生成的黑话内容，不要解释

场景：${sceneName}`;
}

export default async function handler(req: any, res: any) {
  // CORS - 限制允许的来源
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只处理 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取客户端 IP
    const clientIP = getClientIP(req);

    // 检查速率限制
    if (!checkRateLimit(clientIP)) {
      console.warn(`Jargon rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（每分钟最多10次）',
        retryAfter: 60,
      });
    }

    const { mode, input, scene } = req.body;

    // 输入验证
    const validation = validateInput(mode, input, scene);
    if (!validation.valid) {
      console.warn(`Jargon input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    // 获取 API Key（从环境变量中读取）
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 清洗输入
    const safeInput = sanitizeInput(input);

    // 构建系统提示
    const systemPrompt = buildSystemPrompt(mode, scene);

    // 构建消息
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: safeInput },
    ];

    // 调用智谱 AI API（带 15s 超时）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages,
          temperature: 0.7,
          max_tokens: 300,
          top_p: 0.9,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Zhipu API error:', errorData);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '黑话生成失败，请重试。';

    console.log(`Jargon response: mode=${mode}, scene=${scene || 'default'}, input="${safeInput.slice(0, 30)}..."`);

    return res.status(200).json({ result });

  } catch (error) {
    console.error('Jargon API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
