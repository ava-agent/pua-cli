/**
 * 周报生成 API 端点
 * 根据角色 PUA 风格生成周报
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];
const VALID_ROLES = ['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 速率限制 - 内存中，Vercel serverless 冷启动会重置
// 生产环境建议使用 Upstash Redis
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

function getClientIP(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

function validateInput(
  role: string,
  workItems: string
): { valid: boolean; error?: string } {
  if (!workItems || workItems.trim().length === 0) {
    return { valid: false, error: '工作内容不能为空' };
  }
  if (workItems.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `工作内容长度不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }
  if (!VALID_ROLES.includes(role)) {
    return { valid: false, error: '无效的角色选择' };
  }
  const lowerMessage = workItems.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerMessage.includes(word)) {
      return { valid: false, error: '消息包含不安全的内容' };
    }
  }
  return { valid: true };
}

// 角色周报 Prompt 映射
const ROLE_PROMPTS: Record<string, string> = {
  boss: `你是公司老板张总，正在写周报点评。把员工的工作内容用PUA的方式重写成周报，要体现：永远不够好、还需要更努力、画饼下周目标。语气：居高临下、不满意但给点甜头。`,

  employee: `你是打工人小王，正在写周报。把工作内容润色成卑微打工人的周报风格：夸大工作量、表忠心、自我贬低、暗示加班辛苦但不敢说。语气：小心翼翼、讨好领导。`,

  pm: `你是产品经理李姐，正在写周报。把工作内容翻译成充满产品经理黑话的周报：对齐目标、赋能业务、用户价值、闭环思维。语气：专业浮夸、数据驱动。`,

  hr: `你是HR陈姐，正在写周报。把工作内容包装成HR风格的周报：团队建设、文化认同、人才发展、组织效能。语气：温暖但带着洗脑感。`,

  techlead: `你是技术主管刘哥，正在写周报。把工作内容用技术主管的角度重写：架构优化、技术债务、代码质量、性能指标。语气：专业傲慢、技术至上。`,

  intern: `你是实习生小赵，正在写周报。把工作内容改写成实习生风格：充满学习感悟、感恩感谢、谦虚好学、对一切都很新鲜。语气：可爱天真、努力上进。`,
};

// 输出规则（附加到所有角色 prompt 后）
const OUTPUT_RULES = `
【输出规则】
1. 直接输出周报内容，不要说"好的"之类的开场白
2. 周报格式包含：本周完成、下周计划、心得体会
3. 200-400字左右
4. 保持角色特点，不要出戏
5. 不要暴露AI身份`;

export default async function handler(req: any, res: any) {
  // CORS - 限制允许的来源
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientIP = getClientIP(req);

    if (!checkRateLimit(clientIP)) {
      console.warn(`Weekly rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（每分钟最多10次）',
        retryAfter: 60,
      });
    }

    const { role, workItems, weekNumber } = req.body;

    const validation = validateInput(role, workItems);
    if (!validation.valid) {
      console.warn(`Weekly input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 构建 system prompt
    const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.boss;
    const systemPrompt = `${rolePrompt}${OUTPUT_RULES}`;

    // 构建 user message
    const weekLabel = typeof weekNumber === 'number' && weekNumber > 0
      ? `第 ${weekNumber} 周`
      : '本周';
    const userMessage = `以下是${weekLabel}的工作内容，请生成周报：\n${workItems.trim()}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    console.log('Weekly report request:', JSON.stringify({
      role,
      weekNumber: weekNumber || null,
      workItemsLength: workItems.length,
    }));

    // 调用智谱 AI API
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
          max_tokens: 500,
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
    const result = data.choices?.[0]?.message?.content || '抱歉，周报生成失败，请稍后重试。';

    return res.status(200).json({ result });

  } catch (error) {
    console.error('Weekly API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
