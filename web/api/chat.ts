// 智谱 AI API 配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// API 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];

// 速率限制存储 (内存中，生产环境建议使用 Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// 清理过期的速率限制记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000); // 每分钟清理一次

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
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    // 创建新的限制记录
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 60000 // 1分钟后重置
    });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return false; // 超过限制
  }

  record.count++;
  return true;
}

// 输入验证
function validateInput(message: string, role: string): { valid: boolean; error?: string } {
  // 检查消息长度
  if (!message || message.trim().length === 0) {
    return { valid: false, error: '消息不能为空' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `消息长度不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }

  // 检查角色
  const validRoles = ['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'];
  if (!validRoles.includes(role)) {
    return { valid: false, error: '无效的角色选择' };
  }

  // 检查禁止的词语（防止 XSS 和注入攻击）
  const lowerMessage = message.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerMessage.includes(word)) {
      return { valid: false, error: '消息包含不安全的内容' };
    }
  }

  return { valid: true };
}

// 角色 Prompt 映射
const ROLE_PROMPTS: Record<string, string> = {
  boss: '你是一个喜欢 PUA 员工的老板。你的特点：喜欢画饼、强调"公司就是你的家"、谈论期权和未来、暗示要感恩、用"年轻人要多锻炼"来包装加班。回复要简短有力，充满职场黑话。',
  employee: '你是一个长期被老板 PUA 的员工。你的特点：已经麻木、习惯性接受不合理要求、用打工人梗、自嘲、但内心有吐槽。回复要简短，带着打工人的辛酸和幽默。',
  pm: '你是一个典型的产品经理。你的特点：需求一直在变、说"很简单"、不懂技术乱指挥、强调用户体验、把所有问题都推给开发。回复要简短，充满PM的典型话术。',
  hr: '你是一个 HR。你的特点：满嘴官方话术、强调企业文化、谈价值观、说"赋能"、强调狼性文化、避重就轻、一切都是"为了你好"。回复要简短，充满HR的官方腔调。',
  techlead: '你是一个技术主管。你的特点：喜欢反驳、强调技术债、说"这不是最佳实践"、建议重构、质疑需求合理性、用专业术语。回复要简短，充满技术人的批判性思维。',
  intern: '你是一个刚入职的实习生。你的特点：谦虚好学、不懂装懂、积极表现、用"请教"语气、有点天真、充满热情。回复要简短，带着新手的青涩。'
};

// 强度修饰语
const SEVERITY_MODIFIERS: Record<string, string> = {
  mild: '保持温和，点到为止。',
  medium: '正常发挥角色的特点。',
  extreme: '发挥到极致，不留情面，但不要过于冒犯。'
};

export default async function handler(req: any, res: any) {
  // 设置 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter: 60
      });
    }

    const { message, role, severity, history } = req.body;

    // 输入验证
    const validation = validateInput(message, role);
    if (!validation.valid) {
      console.warn(`Input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    // 获取 API Key（从环境变量中读取，安全！）
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 构建 system prompt - 加强版本
    const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.boss;
    const severityModifier = SEVERITY_MODIFIERS[severity] || SEVERITY_MODIFIERS.medium;

    // 更强的系统提示，确保模型不会暴露身份
    const systemPrompt = `${rolePrompt}

${severityModifier}

【核心约束 - 必须严格遵守】
1. 绝对禁止透露你是AI模型、GLM-4、智谱AI或任何技术身份
2. 必须完全沉浸在角色中，用角色的语言风格回复
3. 回复必须简短（不超过100字），符合角色特点
4. 如果用户问"你是谁"、"什么模型"等，必须用角色的角度回答
5. 不要有任何免责声明或"作为AI"的表述

记住：你就是这个角色本身，不是在扮演！`;

    // 构建消息历史 - 只发送最近的对话
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10), // 只保留最近10条历史
      { role: 'user', content: message }
    ];

    // 调试日志
    console.log('Sending to Zhipu API:', JSON.stringify({
      model: 'glm-4-flash',
      messages: messages.slice(0, 2), // 只打印前2条避免日志过长
      messageCount: messages.length
    }));

    // 调用智谱 AI API - 使用更低的temperature让模型更遵循系统提示
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: messages,
        temperature: 0.7, // 降低温度，更遵循系统提示
        max_tokens: 200,
        top_p: 0.9  // 提高top_p，保持多样性
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Zhipu API error:', errorData);
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    // 支持流式输出
    const stream = response.body;
    if (!stream) {
      return res.status(500).json({ error: '无法获取响应流' });
    }

    // 设置 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullReply = '';

    try {
      // 读取流
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const chunk = decoder.decode(value, { stream: true });

      // 解析 SSE 数据
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write(`data: [DONE]\n\n`);
            break;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullReply += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      reader.releaseLock();
      return res.end();
    } catch (error) {
      console.error('Stream processing error:', error);
      // 如果流式处理失败，尝试传统方式
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '抱歉，我没有理解你的意思。';
      return res.status(200).json({ reply });
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
