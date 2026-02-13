// 智谱 AI API 配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

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

export default async function handler(request: Request) {
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { message, role, severity, history } = await request.json();

    if (!message || !role) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 获取 API Key（从环境变量中读取，安全！）
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: '服务器配置错误' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构建 system prompt
    const rolePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS.boss;
    const severityModifier = SEVERITY_MODIFIERS[severity] || SEVERITY_MODIFIERS.medium;
    const systemPrompt = `${rolePrompt}\n\n${severityModifier}\n\n重要：回复必须简短（不超过100字），幽默风趣，符合角色特点。`;

    // 构建消息历史
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10), // 只保留最近10条历史
      { role: 'user', content: message }
    ];

    // 调用智谱 AI API
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash', // 使用快速模型
        messages: messages,
        temperature: 0.8,
        max_tokens: 200,
        top_p: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Zhipu API error:', errorData);
      return new Response(JSON.stringify({ error: 'AI 服务暂时不可用，请稍后重试' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '抱歉，我没有理解你的意思。';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
