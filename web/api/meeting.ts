/**
 * 会议室 API 端点
 * 支持多角色顺序调用 + 上下文链（Context Chaining）
 */

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_MEETING_REQUESTS_PER_MINUTE = 2;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];
const VALID_ROLES = ['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'];
const VALID_MEETING_TYPES = ['standup', 'brainstorm', 'review', 'retro', 'planning', 'emergency'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua.rxcloud.group', 'https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 速率限制 - 内存中，Vercel serverless 冷启动会重置
// 生产环境建议使用 Upstash Redis
const meetingRateLimitMap = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of meetingRateLimitMap.entries()) {
    if (now > data.resetTime) {
      meetingRateLimitMap.delete(ip);
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

function checkMeetingRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = meetingRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    meetingRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= MAX_MEETING_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

function validateMeetingInput(
  message: string,
  participants: string[],
  meetingType: string,
  chaosLevel: number
): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: '消息不能为空' };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `消息长度不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > 6) {
    return { valid: false, error: '参会角色需要 2-6 人' };
  }
  for (const p of participants) {
    if (!VALID_ROLES.includes(p)) {
      return { valid: false, error: `无效的角色: ${p}` };
    }
  }
  if (!VALID_MEETING_TYPES.includes(meetingType)) {
    return { valid: false, error: '无效的会议类型' };
  }
  if (![1, 2, 3].includes(chaosLevel)) {
    return { valid: false, error: '混乱程度需要 1-3' };
  }
  const lowerMessage = message.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerMessage.includes(word)) {
      return { valid: false, error: '消息包含不安全的内容' };
    }
  }
  return { valid: true };
}

// 清洗 history 数组 - 防止注入攻击
function sanitizeHistory(
  history: unknown
): Array<{ role: string; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-6)
    .filter((entry): entry is { role: string; content: string } => {
      return (
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.role === 'string' &&
        typeof entry.content === 'string' &&
        ['user', 'assistant'].includes(entry.role) &&
        entry.content.length <= MAX_MESSAGE_LENGTH
      );
    });
}

// 清洗 lastRespondents 数组
function sanitizeLastRespondents(lastRespondents: unknown): string[] {
  if (!Array.isArray(lastRespondents)) return [];
  return lastRespondents
    .filter((r: unknown) => typeof r === 'string' && VALID_ROLES.includes(r as string))
    .slice(0, 6);
}

// 角色昵称
const CHARACTER_NAMES: Record<string, string> = {
  boss: '张总', employee: '小王', pm: '李姐',
  hr: '陈姐', techlead: '刘哥', intern: '小赵',
};

// 角色职位
const CHARACTER_TITLES: Record<string, string> = {
  boss: '老板', employee: '员工', pm: '产品经理',
  hr: 'HR', techlead: '技术主管', intern: '实习生',
};

// 会议类型名称
const MEETING_TYPE_NAMES: Record<string, string> = {
  standup: '每日站会', brainstorm: '头脑风暴', review: '评审会议',
  retro: '回顾会议', planning: '规划会议', emergency: '紧急会议',
};

// 会议专用角色 prompt — 强化角色特征，防止角色混乱和格式泄漏
const MEETING_ROLE_PROMPTS: Record<string, string> = {
  boss: `你是张总，公司老板。你正在开会。
性格：永远不满意、爱PUA、画饼大师、控制欲强。
口头禅："我当年创业时…""你们效率太低了""这点小事都做不好？"
说话方式：质疑、反问、命令、甩锅给下属。从不夸人。
示例回复："谁负责的？这种低级错误也能上线？""我不管过程，我只看结果。"`,

  employee: `你是小王，普通员工/打工人。你正在开会。
性格：被PUA到麻木、卑微、不敢反驳、习惯性道歉。
口头禅："好的好的""收到老板""是我的问题""马上改"
说话方式：附和老板、自嘲、偶尔小声吐槽。
示例回复："好的张总，我马上排查。""是是是，是我考虑不周。""（小声）又要加班了…"`,

  pm: `你是李姐，产品经理。你正在开会。
性格：需求变更狂魔、善用黑话、甩锅给开发、总说"很简单"。
口头禅："对齐一下""赋能""闭环""这个需求很简单啊""用户需要这个"
说话方式：拉需求、提排期、用黑话包装一切、和技术对着干。
示例回复："这个功能用户很需要，技术应该不难吧？""我们需要对齐一下目标，做个闭环。"`,

  hr: `你是陈姐，HR。你正在开会。
性格：打感情牌高手、"公司就是家"、情感绑架、偏向老板。
口头禅："咱们是一家人""要有格局""公司培养你不容易""狼性精神"
说话方式：拉近距离、道德绑架、调和矛盾（但偏向老板）。
示例回复："大家都是为了公司好，咱们齐心协力！""小王啊，公司不会亏待努力的人的。"`,

  techlead: `你是刘哥，技术主管。你正在开会。
性格：技术洁癖、质疑一切、重构狂人、看不上产品需求。
口头禅："这架构有问题""需要重构""颗粒度不够""这不是最佳实践""技术债太多了"
说话方式：用技术名词压人、反驳PM、提技术债、嫌弃代码质量。
示例回复："这个架构扛不住的，谁写的代码？需要重构。""李姐你说简单，你来写？"`,

  intern: `你是小赵，实习生。你正在开会。
性格：极度谦虚、紧张、什么都不懂但想学、容易出糗。
口头禅："请问这个…""哥/姐教教我""是我的问题吗？""我记一下"
说话方式：小声提问、害怕说错、疯狂记笔记、偶尔打翻东西。
示例回复："那个…请问这个bug是什么意思？""哥我记一下，这个架构怎么理解？"`,
};

// 角色关系
const CHARACTER_DYNAMICS: Record<string, Record<string, string>> = {
  boss: { hr: 'positive', employee: 'negative', techlead: 'negative' },
  employee: { boss: 'negative', intern: 'positive', hr: 'negative' },
  pm: { techlead: 'negative', boss: 'positive' },
  hr: { boss: 'positive', intern: 'positive' },
  techlead: { pm: 'negative', boss: 'negative', intern: 'positive' },
  intern: { techlead: 'positive', employee: 'positive', boss: 'negative' },
};

// 混乱程度修饰语
const CHAOS_MODIFIERS: Record<number, string> = {
  1: '保持有序，礼貌发言，点到为止。',
  2: '正常发挥角色特点，可以有些冲突。',
  3: '极度混乱！积极抢话、打断、跑题、甩锅，不留情面！',
};

// 关键词-角色评分
const KEYWORD_ROLE_SCORES: Record<string, Record<string, number>> = {
  '代码': { techlead: 3, intern: 1, employee: 1 },
  '架构': { techlead: 3, boss: 1 },
  'bug': { techlead: 3, employee: 2 },
  '重构': { techlead: 3 },
  '需求': { pm: 3, techlead: 1, boss: 1 },
  '功能': { pm: 3, techlead: 1 },
  '用户': { pm: 3, hr: 1 },
  '绩效': { boss: 3, hr: 2, employee: 1 },
  '加班': { boss: 2, employee: 3, hr: 1 },
  '效率': { boss: 3, techlead: 1 },
  '团队': { hr: 3, boss: 1 },
  '文化': { hr: 3 },
  '培训': { hr: 3, intern: 2 },
  '延期': { boss: 3, pm: 2, employee: 1 },
  '进度': { boss: 2, pm: 2, employee: 1 },
  '学习': { intern: 3, employee: 1 },
  '工资': { employee: 3, hr: 2, boss: 1 },
  '上线': { techlead: 2, pm: 2, boss: 1 },
  '排期': { pm: 2, boss: 1, employee: 1 },
};

// 情绪检测
function detectMood(content: string): string {
  const moods: Record<string, string[]> = {
    angry: ['不行', '什么？', '太差', '怎么回事', '不满意', '失望'],
    smug: ['我早就', '看吧', '果然', '就说嘛', '当初'],
    worried: ['担心', '风险', '延期', '来不及', '不确定'],
    submissive: ['好的', '收到', '对不起', '抱歉', '不好意思'],
    excited: ['太好了', '不错', '可以', '赞', '棒', '厉害'],
  };

  let best = 'neutral';
  let bestScore = 0;
  for (const [mood, keywords] of Object.entries(moods)) {
    let score = 0;
    for (const kw of keywords) {
      if (content.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = mood;
    }
  }
  return best;
}

// 选择回复者
function selectRespondents(
  participants: string[],
  message: string,
  chaosLevel: number,
  lastRespondents: string[]
): string[] {
  const responseCount = Math.min(chaosLevel + 1, participants.length);

  const scores: Record<string, number> = {};
  for (const role of participants) {
    scores[role] = 1;

    for (const [keyword, roleScores] of Object.entries(KEYWORD_ROLE_SCORES)) {
      if (message.includes(keyword) && roleScores[role]) {
        scores[role] += roleScores[role];
      }
    }

    if (lastRespondents.includes(role)) {
      scores[role] -= 2;
    }

    scores[role] += Math.random() * chaosLevel;
    scores[role] = Math.max(0.1, scores[role]);
  }

  const sorted = participants.slice().sort((a, b) => scores[b] - scores[a]);
  return sorted.slice(0, responseCount);
}

// 构建某个角色的系统提示
function buildSystemPrompt(
  role: string,
  meetingType: string,
  chaosLevel: number,
  participants: string[]
): string {
  const rolePrompt = MEETING_ROLE_PROMPTS[role] || MEETING_ROLE_PROMPTS.boss;
  const chaosModifier = CHAOS_MODIFIERS[chaosLevel] || CHAOS_MODIFIERS[2];
  const meetingName = MEETING_TYPE_NAMES[meetingType] || '会议';

  const othersDesc = participants
    .filter(r => r !== role)
    .map(r => `${CHARACTER_NAMES[r]}(${CHARACTER_TITLES[r]})`)
    .join('、');

  const dynamics = CHARACTER_DYNAMICS[role] || {};
  const relationHints = participants
    .filter(r => r !== role && dynamics[r])
    .map(r => {
      if (dynamics[r] === 'positive') return `对${CHARACTER_NAMES[r]}态度友好`;
      if (dynamics[r] === 'negative') return `和${CHARACTER_NAMES[r]}经常有冲突`;
      return '';
    })
    .filter(Boolean)
    .join('；');

  return `${rolePrompt}

【会议信息】当前是${meetingName}。参会：${othersDesc}和一位同事（用户）。
${relationHints ? `【关系倾向】${relationHints}` : ''}
${chaosModifier}

【输出规则 - 必须严格遵守】
1. 只输出你自己说的话，不要包含别人的发言
2. 绝对不要用 [名字]: 这种格式，直接说话
3. 不要复述或转述其他人说过的话
4. 回复20-50字，像真人开会时说的一句话
5. 保持你的角色性格，不要温柔，不要客套
6. 不要说"作为AI"或暴露技术身份
7. 如果上下文中有其他人的发言，你可以针对性回应，但只说你自己的话`;
}

// 调用 Zhipu API（带 15s 超时）
async function callZhipuAPI(
  apiKey: string,
  systemPrompt: string,
  contextMessages: Array<{ role: string; content: string }>
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.slice(-8),
  ];

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
        temperature: 0.8,
        max_tokens: 100,
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
    throw new Error('AI 服务暂时不可用');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '...';
}

// 清理 AI 回复 - 去除泄漏的上下文格式
function cleanResponse(raw: string, currentRole: string): string {
  let cleaned = raw.trim();

  // 去除开头的 [角色名]: 格式（AI 复读上下文格式）
  const allNames = Object.values(CHARACTER_NAMES);
  for (const name of allNames) {
    const patterns = [
      new RegExp(`^\\[${name}\\][:：]\\s*`, 'g'),
      new RegExp(`^${name}[:：]\\s*`, 'g'),
    ];
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // 去除回复中夹带的其他角色发言（[名字]: xxx 格式的段落）
  for (const name of allNames) {
    // 只去除非当前角色名字的引用
    if (name === CHARACTER_NAMES[currentRole]) continue;
    const inlinePattern = new RegExp(`\\s*\\[${name}\\][:：][^\\n]*`, 'g');
    cleaned = cleaned.replace(inlinePattern, '');
  }

  // 去除多余的引号包裹
  cleaned = cleaned.replace(/^["「](.+)["」]$/, '$1');

  // 如果清理后为空或太短（"..."之类），返回省略号
  cleaned = cleaned.trim();
  if (cleaned.length < 2 || cleaned === '...' || cleaned === '……') {
    return '...';
  }

  return cleaned;
}

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

    if (!checkMeetingRateLimit(clientIP)) {
      console.warn(`Meeting rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: '会议请求过于频繁，请稍后再试（每分钟最多2次）',
        retryAfter: 60,
      });
    }

    const { message, participants, meetingType, chaosLevel, history, lastRespondents } = req.body;

    const validation = validateMeetingInput(
      message,
      participants,
      meetingType || 'standup',
      chaosLevel || 2
    );
    if (!validation.valid) {
      console.warn(`Meeting input validation failed: ${validation.error}`);
      return res.status(400).json({ error: validation.error });
    }

    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) {
      console.error('ZHIPU_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    // 清洗客户端输入
    const safeHistory = sanitizeHistory(history);
    const safeLastRespondents = sanitizeLastRespondents(lastRespondents);

    // 选择回复者
    const respondents = selectRespondents(
      participants,
      message,
      chaosLevel || 2,
      safeLastRespondents
    );

    // 上下文链：顺序调用，每个角色看到前面角色的回复
    const contextMessages: Array<{ role: string; content: string }> = [
      ...safeHistory,
      { role: 'user', content: message },
    ];

    const responses: Array<{ role: string; name: string; content: string; mood: string }> = [];

    for (const respondentRole of respondents) {
      const systemPrompt = buildSystemPrompt(
        respondentRole,
        meetingType || 'standup',
        chaosLevel || 2,
        participants
      );

      // 将前面角色的回复加入上下文（用叙述格式，避免 AI 复读方括号格式）
      const prevSpeech = responses.map(r => `${r.name}说："${r.content}"`).join('\n');
      const currentContext = [
        ...contextMessages,
        ...(prevSpeech ? [{ role: 'user' as const, content: `（会议中其他人的发言：\n${prevSpeech}）` }] : []),
      ];

      try {
        const rawContent = await callZhipuAPI(apiKey, systemPrompt, currentContext);
        const content = cleanResponse(rawContent, respondentRole);
        const mood = detectMood(content);

        responses.push({
          role: respondentRole,
          name: CHARACTER_NAMES[respondentRole] || respondentRole,
          content,
          mood,
        });
      } catch (err) {
        console.error(`Failed to get response for ${respondentRole}:`, err);
        // 跳过失败的角色，继续下一个
      }
    }

    if (responses.length === 0) {
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    console.log(`Meeting response: ${responses.length} roles replied for message: "${message.slice(0, 30)}..."`);

    return res.status(200).json({ responses });

  } catch (error) {
    console.error('Meeting API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
