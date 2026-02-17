/**
 * 邮件语气转换器 API 端点
 * 根据方向（向上/向下/平级/对外）和可选角色，改写邮件语气
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];
const VALID_ROLES = ['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'];
const VALID_DIRECTIONS = ['upward', 'downward', 'cross', 'external'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua.rxcloud.group', 'https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 速率限制 - 内存中，Vercel serverless 冷启动会重置
// 生产环境建议使用 Upstash Redis
const emailRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 定期清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of emailRateLimitMap.entries()) {
    if (now > data.resetTime) {
      emailRateLimitMap.delete(ip);
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
  const record = emailRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    emailRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
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
  content: string,
  direction: string,
  role?: string
): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: '邮件内容不能为空' };
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `邮件内容不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }

  if (!direction || !VALID_DIRECTIONS.includes(direction)) {
    return { valid: false, error: '无效的方向，请选择 upward、downward、cross 或 external' };
  }

  if (role !== undefined && role !== null && role !== '' && !VALID_ROLES.includes(role)) {
    return { valid: false, error: `无效的角色: ${role}` };
  }

  // 检查禁止的词语（防止 XSS 和注入攻击）
  const lowerContent = content.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerContent.includes(word)) {
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

// 方向对应的系统提示
const DIRECTION_PROMPTS: Record<string, string> = {
  upward: '你是一个邮件语气转换器。把用户的邮件内容改写成向上级汇报的语气：恭敬、谨慎、用数据说话、适当拍马屁、表忠心。注意用\'您\'称呼对方，多用\'汇报\'、\'请示\'、\'烦请\'等词。',
  downward: '你是一个邮件语气转换器。把用户的邮件内容改写成向下级布置任务的语气：权威、简洁、有压迫感、设定deadline、暗示后果。多用\'务必\'、\'确保\'、\'限期\'、\'责任到人\'等词。',
  cross: '你是一个邮件语气转换器。把用户的邮件内容改写成同事之间协作的语气：客气但有边界感、推锅留后路、CC领导暗示、留书面证据。多用\'对齐\'、\'同步\'、\'麻烦\'、\'方便的话\'等词。',
  external: '你是一个邮件语气转换器。把用户的邮件内容改写成对外商务邮件的语气：极度正式、滴水不漏、法务安全、留有余地。多用\'贵公司\'、\'敬请\'、\'承蒙\'、\'恳请惠允\'等词。',
};

// 角色中文名映射
const ROLE_NAMES: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

// 输出规则
const OUTPUT_RULES = `
【输出规则】
1. 直接输出改写后的邮件，不要解释
2. 保持原邮件的核心内容和意图
3. 150-300字左右
4. 包含合适的开头称呼和结尾署名（用"xxx"代替具体名字）
5. 不要暴露AI身份`;

// 构建系统提示
function buildSystemPrompt(direction: string, role?: string): string {
  const directionPrompt = DIRECTION_PROMPTS[direction] || DIRECTION_PROMPTS.upward;

  let roleHint = '';
  if (role && VALID_ROLES.includes(role)) {
    const roleName = ROLE_NAMES[role] || role;
    roleHint = `\n以${roleName}的身份和风格来写这封邮件。`;
  }

  return `${directionPrompt}${roleHint}${OUTPUT_RULES}`;
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
      console.warn(`Email transform rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（每分钟最多10次）',
        retryAfter: 60,
      });
    }

    const { content, direction, role } = req.body;

    // 输入验证
    const validation = validateInput(content, direction, role);
    if (!validation.valid) {
      console.warn(`Email transform input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    // 获取 API Key（从环境变量中读取）
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 清洗输入
    const safeContent = sanitizeInput(content);

    // 构建系统提示
    const systemPrompt = buildSystemPrompt(direction, role);

    // 构建消息
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: safeContent },
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
          max_tokens: 400,
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
    const result = data.choices?.[0]?.message?.content || '邮件改写失败，请重试。';

    console.log(`Email transform response: direction=${direction}, role=${role || 'none'}, content="${safeContent.slice(0, 30)}..."`);

    return res.status(200).json({ result });

  } catch (error) {
    console.error('Email transform API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
