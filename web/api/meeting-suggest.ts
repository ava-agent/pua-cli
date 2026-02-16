/**
 * 会议发言建议生成器 API 端点
 * 根据角色和会议场景，生成 3-5 条适合在会议中使用的发言建议
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 300;
const MAX_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];
const VALID_ROLES = ['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'];
const VALID_SCENARIOS = ['standup', 'review', 'brainstorm', 'retro', 'planning'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 速率限制 - 内存中，Vercel serverless 冷启动会重置
// 生产环境建议使用 Upstash Redis
const meetingSuggestRateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 定期清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of meetingSuggestRateLimitMap.entries()) {
    if (now > data.resetTime) {
      meetingSuggestRateLimitMap.delete(ip);
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
  const record = meetingSuggestRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    meetingSuggestRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
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
  role: string,
  scenario: string,
  context?: string
): { valid: boolean; error?: string } {
  if (!role || !VALID_ROLES.includes(role)) {
    return { valid: false, error: '无效的角色，请选择 boss、employee、pm、hr、techlead 或 intern' };
  }

  if (!scenario || !VALID_SCENARIOS.includes(scenario)) {
    return { valid: false, error: '无效的会议场景，请选择 standup、review、brainstorm、retro 或 planning' };
  }

  if (context !== undefined && context !== null && context !== '') {
    if (context.length > MAX_CONTEXT_LENGTH) {
      return { valid: false, error: `上下文内容不能超过 ${MAX_CONTEXT_LENGTH} 字符` };
    }

    // 检查禁止的词语（防止 XSS 和注入攻击）
    const lowerContext = context.toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      if (lowerContext.includes(word)) {
        return { valid: false, error: '输入包含不安全的内容' };
      }
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

// 角色中文名映射
const ROLE_NAMES: Record<string, string> = {
  boss: '老板',
  employee: '员工',
  pm: '产品经理',
  hr: 'HR',
  techlead: '技术主管',
  intern: '实习生',
};

// 角色描述映射
const ROLE_DESCRIPTIONS: Record<string, string> = {
  boss: '居高临下、PUA、画饼、质疑效率',
  employee: '卑微、附和、汇报、小心翼翼',
  pm: '黑话连篇、拉需求、对齐目标',
  hr: '打感情牌、团队文化、情感绑架',
  techlead: '质疑架构、挑代码毛病、技术傲慢',
  intern: '谦虚好学、紧张、请教前辈',
};

// 会议场景中文名映射
const SCENARIO_NAMES: Record<string, string> = {
  standup: '每日站会',
  review: '评审会议',
  brainstorm: '头脑风暴',
  retro: '回顾会议',
  planning: '规划会议',
};

// 构建系统提示
function buildSystemPrompt(role: string, scenario: string, context?: string): string {
  const roleName = ROLE_NAMES[role] || role;
  const roleDescription = ROLE_DESCRIPTIONS[role] || '';
  const scenarioName = SCENARIO_NAMES[scenario] || scenario;
  const contextLine = context ? `会议主题/背景：${context}` : '';

  return `你是一个会议发言建议生成器。根据角色和会议场景，生成3-5条适合在会议中使用的发言建议。

角色：${roleName}（${roleDescription}）
会议类型：${scenarioName}
${contextLine}

【角色特点】
- boss（老板）: 居高临下、PUA、画饼、质疑效率
- employee（员工）: 卑微、附和、汇报、小心翼翼
- pm（产品经理）: 黑话连篇、拉需求、对齐目标
- hr（HR）: 打感情牌、团队文化、情感绑架
- techlead（技术主管）: 质疑架构、挑代码毛病、技术傲慢
- intern（实习生）: 谦虚好学、紧张、请教前辈

【输出规则】
1. 输出JSON数组格式：["发言1", "发言2", "发言3"]
2. 每条发言15-40字，像真人在会议中说的一句话
3. 3-5条建议
4. 保持角色特点，语气要到位
5. 不要解释，只输出JSON数组`;
}

// 解析 AI 返回的建议数组
function parseSuggestions(raw: string): string[] {
  const trimmed = raw.trim();

  // 尝试直接解析 JSON 数组
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((item: unknown) => typeof item === 'string')) {
      return parsed.slice(0, 5);
    }
  } catch {
    // JSON 解析失败，继续尝试其他方式
  }

  // 尝试从文本中提取 JSON 数组（AI 可能在 JSON 前后添加了文字）
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((item: unknown) => typeof item === 'string')) {
        return parsed.slice(0, 5);
      }
    } catch {
      // 提取的内容也无法解析，继续回退
    }
  }

  // 回退：按换行分割并清理
  const lines = trimmed
    .split('\n')
    .map(line => line
      .replace(/^\d+[.、)\]]\s*/, '')   // 去除序号前缀
      .replace(/^["「]|["」]$/g, '')     // 去除引号包裹
      .replace(/^[-*·•]\s*/, '')         // 去除列表前缀
      .trim()
    )
    .filter(line => line.length >= 5 && line.length <= 100);

  if (lines.length > 0) {
    return lines.slice(0, 5);
  }

  // 最终回退：返回默认建议
  return ['这个问题我们需要进一步讨论。', '我同意大家的看法。', '我们回去再确认一下。'];
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
      console.warn(`Meeting suggest rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（每分钟最多10次）',
        retryAfter: 60,
      });
    }

    const { role, scenario, context } = req.body;

    // 输入验证
    const validation = validateInput(role, scenario, context);
    if (!validation.valid) {
      console.warn(`Meeting suggest input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    // 获取 API Key（从环境变量中读取）
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 清洗上下文输入
    const safeContext = context ? sanitizeInput(context) : undefined;

    // 构建系统提示
    const systemPrompt = buildSystemPrompt(role, scenario, safeContext);

    // 构建消息
    const userMessage = safeContext
      ? `请根据以上角色和会议场景，结合主题"${safeContext}"，生成发言建议。`
      : '请根据以上角色和会议场景，生成发言建议。';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
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
    const rawContent = data.choices?.[0]?.message?.content || '';

    // 解析建议数组
    const suggestions = parseSuggestions(rawContent);

    console.log(`Meeting suggest response: role=${role}, scenario=${scenario}, context="${(safeContext || '').slice(0, 30)}...", suggestions=${suggestions.length}`);

    return res.status(200).json({ suggestions });

  } catch (error) {
    console.error('Meeting suggest API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
