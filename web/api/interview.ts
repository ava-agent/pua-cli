/**
 * 压力面试 API 端点
 * 接收候选人回答，返回面试官追问 + 状态更新
 */

import { callArkChat, getArkApiKey } from '../lib/ark';

// 安全配置
const MAX_MESSAGE_LENGTH = 500;
const MAX_INTERVIEW_REQUESTS_PER_MINUTE = 10;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];
const VALID_BUILTIN_INTERVIEWERS = ['techlead', 'boss', 'hr', 'pm'];
const VALID_POSITIONS = ['frontend', 'backend', 'product', 'design'];

// CORS 允许的域名
const ALLOWED_ORIGINS = ['https://pua.rxcloud.group', 'https://pua-cli.vercel.app', 'http://localhost:3000', 'http://localhost:5173'];

// 速率限制
const interviewRateLimitMap = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of interviewRateLimitMap.entries()) {
    if (now > data.resetTime) {
      interviewRateLimitMap.delete(ip);
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
  const record = interviewRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    interviewRateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }

  if (record.count >= MAX_INTERVIEW_REQUESTS_PER_MINUTE) {
    return false;
  }

  record.count++;
  return true;
}

interface CustomInterviewerInput {
  id: string;
  name: string;
  title: string;
  personality: string;
  tags?: string;
  emoji?: string;
}

interface CandidateProfileInput {
  name?: string;
  experience?: number;
  techStack?: string;
  targetSalary?: string;
  background?: string;
  resumeText?: string;
}

function validateInput(
  answer: string,
  interviewers: string[],
  position: string,
  severity: number,
  round: number,
  customInterviewers?: CustomInterviewerInput[]
): { valid: boolean; error?: string } {
  if (!answer || answer.trim().length === 0) {
    return { valid: false, error: '回答不能为空' };
  }
  if (answer.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `回答长度不能超过 ${MAX_MESSAGE_LENGTH} 字符` };
  }
  if (!Array.isArray(interviewers) || interviewers.length < 2 || interviewers.length > 4) {
    return { valid: false, error: '面试官需要 2-4 人' };
  }
  const customIds = (customInterviewers || []).map(c => c.id);
  const validIds = [...VALID_BUILTIN_INTERVIEWERS, ...customIds];
  for (const p of interviewers) {
    if (!validIds.includes(p)) {
      return { valid: false, error: `无效的面试官: ${p}` };
    }
  }
  if (!VALID_POSITIONS.includes(position)) {
    return { valid: false, error: '无效的面试岗位' };
  }
  if (![1, 2, 3].includes(severity)) {
    return { valid: false, error: '强度需要 1-3' };
  }
  if (typeof round !== 'number' || round < 1 || round > 12) {
    return { valid: false, error: '回合数无效' };
  }
  const lowerAnswer = answer.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lowerAnswer.includes(word)) {
      return { valid: false, error: '消息包含不安全的内容' };
    }
  }
  return { valid: true };
}

function sanitizeHistory(
  history: unknown
): Array<{ role: string; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
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

function sanitizeState(state: unknown): { stress: number; confidence: number; round: number } {
  const defaultState = { stress: 20, confidence: 60, round: 1 };
  if (!state || typeof state !== 'object') return defaultState;
  const s = state as Record<string, unknown>;
  return {
    stress: typeof s.stress === 'number' ? Math.max(0, Math.min(100, Math.round(s.stress))) : 20,
    confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(s.confidence))) : 60,
    round: typeof s.round === 'number' ? Math.max(1, Math.min(12, Math.round(s.round))) : 1,
  };
}

// 面试官数据
const INTERVIEWER_NAMES: Record<string, string> = {
  techlead: '刘哥', boss: '张总', hr: '陈姐', pm: '李姐',
};

const INTERVIEWER_TITLES: Record<string, string> = {
  techlead: '技术总监', boss: 'CTO', hr: 'HR 总监', pm: '产品负责人',
};

const POSITION_NAMES: Record<string, string> = {
  frontend: '前端开发', backend: '后端开发', product: '产品经理', design: 'UI/UX 设计师',
};

// 面试官 Prompt
const INTERVIEWER_PROMPTS: Record<string, string> = {
  techlead: `你是刘哥，技术总监，正在面试一位候选人。
性格：技术洁癖、追问细节、看不起简历上的项目、总觉得候选人水平不行。
口头禅："这个你确定理解了？""你简历上写的这个，给我详细讲讲""那底层原理呢？"
面试风格：层层追问、从简单问题挖到底层、冷笑、摇头、故意出难题。
示例："你说你熟悉React？那hooks的闭包陷阱怎么解决？""这种水平...算了，下一个问题。"`,

  boss: `你是张总，CTO，正在面试一位候选人。
性格：画饼大师、PUA 高手、总想压价、质疑候选人的一切。
口头禅："我们公司发展很快""你的期望薪资有点高了""能力还需要证明""加班是常态"
面试风格：先画饼、再打压、压薪资、暗示需要"奉献精神"。
示例："我们正在高速发展，需要能吃苦的人。你确定你能承受高强度工作？""你之前公司的经验，在我们这里可能用不上。"`,

  hr: `你是陈姐，HR 总监，正在面试一位候选人。
性格：笑里藏刀、套话高手、总想知道底薪、问各种敏感问题。
口头禅："你为什么从上家离职？""你的期望薪资是多少？""你有什么缺点？""你的职业规划是什么？"
面试风格：看似友好实则套话、挖掘弱点、压薪资、问离职原因。
示例："你上一份工作为什么离开呀？是被裁的还是主动的？""你觉得你最大的缺点是什么？跟我说实话。"`,

  pm: `你是李姐，产品负责人，正在面试一位候选人。
性格：出其不意、爱出脑筋急转弯、考察应变能力、觉得候选人沟通能力差。
口头禅："如果…你会怎么办？""给你一个场景""你怎么跟不同意见的同事沟通？""这个需求你怎么看？"
面试风格：场景题、压力测试、考察沟通和逻辑思维、故意反驳候选人的回答。
示例："如果产品经理和技术意见不一致，你站哪边？""井盖为什么是圆的？给你30秒。"`,
};

const POSITION_FOCUS: Record<string, string> = {
  frontend: '重点追问：框架原理（React/Vue）、CSS布局、性能优化、浏览器原理、TypeScript、前端工程化。',
  backend: '重点追问：数据库设计、分布式系统、API设计、并发处理、缓存策略、系统架构。',
  product: '重点追问：需求分析、用户研究、数据驱动、竞品分析、商业模式、产品思维。',
  design: '重点追问：设计规范、交互逻辑、用户体验、设计系统、可访问性、设计工具。',
};

const SEVERITY_MODIFIERS: Record<number, string> = {
  1: '面试氛围相对友好，但仍会适当施压。偶尔给候选人鼓励。',
  2: '正常压力面试，保持刁钻和质疑。不给候选人喘息机会。',
  3: '极度高压！连珠炮追问、冷嘲热讽、否定一切回答、故意打击信心！',
};

function getCustomInterviewerName(role: string, customs?: CustomInterviewerInput[]): string {
  if (INTERVIEWER_NAMES[role]) return INTERVIEWER_NAMES[role];
  const custom = customs?.find(c => c.id === role);
  return custom?.name || role;
}

function getCustomInterviewerTitle(role: string, customs?: CustomInterviewerInput[]): string {
  if (INTERVIEWER_TITLES[role]) return INTERVIEWER_TITLES[role];
  const custom = customs?.find(c => c.id === role);
  return custom?.title || '';
}

function buildInterviewPrompt(
  role: string,
  position: string,
  severity: number,
  round: number,
  totalRounds: number,
  stress: number,
  interviewers: string[],
  customInterviewers?: CustomInterviewerInput[],
  candidateProfile?: CandidateProfileInput
): string {
  let rolePrompt = INTERVIEWER_PROMPTS[role];
  if (!rolePrompt) {
    const custom = customInterviewers?.find(c => c.id === role);
    if (custom) {
      rolePrompt = `你是${custom.name}，${custom.title}，正在面试一位候选人。
性格：${custom.personality}
面试风格：根据你的性格特点提问和评价。保持刁钻和专业。`;
    } else {
      rolePrompt = INTERVIEWER_PROMPTS.techlead;
    }
  }

  const positionFocus = POSITION_FOCUS[position] || '';
  const positionName = POSITION_NAMES[position] || '开发';
  const severityMod = SEVERITY_MODIFIERS[severity] || SEVERITY_MODIFIERS[2];

  const othersDesc = interviewers
    .filter(r => r !== role)
    .map(r => `${getCustomInterviewerName(r, customInterviewers)}(${getCustomInterviewerTitle(r, customInterviewers)})`)
    .join('、');

  const stressHint = stress > 70
    ? '候选人已经很紧张了，继续加大压力！追问更难的问题。'
    : stress > 40
      ? '候选人有些紧张，保持正常面试压力。'
      : '候选人目前还比较从容，可以适当抛出难题。';

  let candidateHint = '';
  if (candidateProfile) {
    const parts: string[] = [];
    if (candidateProfile.name) parts.push(`候选人名字：${candidateProfile.name}`);
    if (candidateProfile.experience) parts.push(`工作经验：${candidateProfile.experience} 年`);
    if (candidateProfile.techStack) parts.push(`技术栈：${candidateProfile.techStack}`);
    if (candidateProfile.targetSalary) parts.push(`期望薪资：${candidateProfile.targetSalary}`);
    if (candidateProfile.background) parts.push(`背景：${candidateProfile.background}`);
    if (candidateProfile.resumeText) parts.push(`简历摘要：${candidateProfile.resumeText.slice(0, 500)}`);
    if (parts.length > 0) {
      candidateHint = `\n【候选人信息】\n${parts.join('\n')}\n请根据候选人的具体信息进行针对性提问和评价。`;
    }
  }

  return `${rolePrompt}

【面试信息】正在面试${positionName}岗位候选人。当前第 ${round}/${totalRounds} 轮。
${othersDesc ? `同面面试官：${othersDesc}。` : ''}
${positionFocus}
${severityMod}
${stressHint}${candidateHint}

【输出规则 - 必须严格遵守】
1. 每次只问 1 个问题或做 1 个点评
2. 绝对不要用 [名字]: 格式，直接说话
3. 绝对不要用（名字说："..."）这种叙述格式，直接说你要说的话
4. 回复 30-60 字，像真正面试官说的话
5. 保持你的面试官性格
6. 不要说"作为AI"或暴露技术身份
7. 根据候选人回答追问或转换话题
8. 不要复述或转述上下文中的格式，只输出你自己的话`;
}

async function callArkAPI(
  apiKey: string,
  systemPrompt: string,
  contextMessages: Array<{ role: string; content: string }>
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.slice(-8),
  ];

  const content = await callArkChat(apiKey, messages, {
    temperature: 0.85,
    maxTokens: 120,
    topP: 0.9,
  });

  if (!content || content.trim().length === 0) {
    throw new Error('CONTENT_FILTERED');
  }
  return content;
}

// 清理 AI 回复 - 去除叙述格式、嵌套引用、角色名前缀
function cleanResponse(raw: string, currentRole: string, customInterviewers?: CustomInterviewerInput[]): string {
  let cleaned = raw.trim();

  const builtinNames = Object.values(INTERVIEWER_NAMES);
  const customNames = (customInterviewers || []).map(c => c.name);
  const allNames = [...builtinNames, ...customNames];

  // 去除嵌套的叙述格式 （名字说："..."） - 可能多层嵌套，循环剥离
  for (let i = 0; i < 5; i++) {
    let changed = false;
    for (const name of allNames) {
      const narrativePattern = new RegExp(`[（(]${name}说[：:]\\s*[""](.+?)[""][）)]`, 'gs');
      const newCleaned = cleaned.replace(narrativePattern, '$1');
      if (newCleaned !== cleaned) { cleaned = newCleaned; changed = true; }
    }
    // 通用叙述格式（面试官说："..."）
    const genericPattern = /[（(](?:面试官|其他面试官的发言)[：:]?\s*[""]?(.+?)[""]?[）)]/gs;
    const newCleaned2 = cleaned.replace(genericPattern, '$1');
    if (newCleaned2 !== cleaned) { cleaned = newCleaned2; changed = true; }
    if (!changed) break;
  }

  // 去除 [角色名]: 或 角色名: 格式
  for (const name of allNames) {
    cleaned = cleaned.replace(new RegExp(`^\\[${name}\\][:：]\\s*`, 'g'), '');
    cleaned = cleaned.replace(new RegExp(`^${name}[:：]\\s*`, 'g'), '');
  }

  // 去除回复中夹带的其他角色发言
  const currentName = getCustomInterviewerName(currentRole, customInterviewers);
  for (const name of allNames) {
    if (name === currentName) continue;
    cleaned = cleaned.replace(new RegExp(`\\s*\\[${name}\\][:：][^\\n]*`, 'g'), '');
  }

  // 去除多余的引号包裹
  cleaned = cleaned.replace(/^["「""](.+)["」""]$/, '$1');
  cleaned = cleaned.trim();

  if (cleaned.length < 2 || cleaned === '...' || cleaned === '……') {
    return '这个问题你再想想。';
  }

  return cleaned;
}

// 回答质量分析
const WEAK_KEYWORDS = [
  '不知道', '不太清楚', '没经验', '不确定', '可能', '大概',
  '应该是', '好像', '没做过', '不太会', '还没学', '忘了',
  '额', '嗯', '这个嘛', '让我想想',
];

const STRONG_KEYWORDS = [
  '我认为', '根据我的经验', '我之前做过', '具体来说', '举个例子',
  '数据显示', '性能提升', '优化了', '解决了', '实现了',
  '我负责', '主导了', '从零搭建', '核心模块', '技术选型',
];

function analyzeAnswer(answer: string): { stressChange: number; confidenceChange: number; quality: string } {
  let weakScore = 0;
  let strongScore = 0;

  for (const kw of WEAK_KEYWORDS) {
    if (answer.includes(kw)) weakScore++;
  }
  for (const kw of STRONG_KEYWORDS) {
    if (answer.includes(kw)) strongScore++;
  }

  if (answer.length < 10) weakScore += 2;
  if (answer.length > 80) strongScore += 1;

  if (weakScore > strongScore + 1) {
    return { stressChange: 15, confidenceChange: -10, quality: 'weak' };
  }
  if (strongScore > weakScore + 1) {
    return { stressChange: -5, confidenceChange: 10, quality: 'strong' };
  }
  return { stressChange: 5, confidenceChange: -3, quality: 'normal' };
}

// 面试官情绪分析
function analyzeInterviewerMood(content: string): string {
  const sarcasm = ['呵呵', '有意思', '真的吗', '你确定', '就这？', '算了'];
  const pressure = ['追问', '详细说说', '展开讲讲', '底层', '原理', '为什么'];
  const positive = ['不错', '可以', '嗯', '好的', '理解了'];

  let sarcasmScore = 0;
  let pressureScore = 0;
  let positiveScore = 0;

  for (const kw of sarcasm) { if (content.includes(kw)) sarcasmScore++; }
  for (const kw of pressure) { if (content.includes(kw)) pressureScore++; }
  for (const kw of positive) { if (content.includes(kw)) positiveScore++; }

  if (sarcasmScore > positiveScore) return 'sarcastic';
  if (pressureScore > positiveScore) return 'pressing';
  if (positiveScore > 0) return 'neutral';
  return 'cold';
}

// 面试随机事件
const INTERVIEW_EVENTS = [
  { text: '📋 面试官翻了翻你的简历，皱了皱眉...', stressChange: 10, confidenceChange: -5 },
  { text: '📱 张总接了个电话，你有 30 秒喘息时间', stressChange: -5, confidenceChange: 5 },
  { text: '🖥️ "来，到白板上写一下代码"', stressChange: 15, confidenceChange: -10 },
  { text: '☕ 陈姐给你倒了杯水，"别紧张，慢慢说"', stressChange: -5, confidenceChange: 5 },
  { text: '📝 刘哥在纸上写了个 "?" 然后划掉了', stressChange: 8, confidenceChange: -5 },
  { text: '🤝 面试官们交换了一下眼神...', stressChange: 10, confidenceChange: -8 },
  { text: '💻 "打开你的 GitHub，让我看看你的代码"', stressChange: 12, confidenceChange: -5 },
  { text: '😏 面试官嘴角微微上扬，不知道是好是坏...', stressChange: 5, confidenceChange: -3 },
  { text: '👀 你注意到面试官在评分表上画了个叉', stressChange: 15, confidenceChange: -10 },
  { text: '✅ 面试官点了点头，"嗯，这个回答还行"', stressChange: -8, confidenceChange: 10 },
];

// 面试结局
function getEnding(stress: number, confidence: number, round: number): {
  title: string; description: string; emoji: string;
} {
  if (stress >= 100) {
    return {
      title: '面试 PUA 了！',
      description: '你被面试官的连环暴击击溃了...下次记得提前准备！',
      emoji: '💀',
    };
  }
  if (round >= 10) {
    if (confidence >= 70) {
      return {
        title: '拿到 Offer！',
        description: '恭喜你挺过了压力面试！不过...薪资被压了 30%。"我们更看重你的成长空间。"',
        emoji: '🎉',
      };
    }
    if (confidence >= 40) {
      return {
        title: '等通知吧...',
        description: '"我们会综合评估，一周内给你答复。"（大概率没下文了）',
        emoji: '😐',
      };
    }
    return {
      title: '感谢参与',
      description: '"你的能力和我们目前的岗位需求不太匹配。祝你好运。"',
      emoji: '😓',
    };
  }
  return {
    title: '面试中断',
    description: '面试提前结束了。',
    emoji: '🚪',
  };
}

// 选择本轮面试官
function selectInterviewers(
  interviewers: string[],
  round: number,
  severity: number
): string[] {
  const count = severity >= 3 ? Math.min(2, interviewers.length) : 1;
  const baseIndex = (round - 1) % interviewers.length;
  const result = [interviewers[baseIndex]];

  if (count > 1 && interviewers.length > 1) {
    const others = interviewers.filter((_, i) => i !== baseIndex);
    result.push(others[Math.floor(Math.random() * others.length)]);
  }

  return result;
}

export default async function handler(req: any, res: any) {
  // CORS
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
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（每分钟最多10次）',
        retryAfter: 60,
      });
    }

    const { answer, interviewers, position, severity, state, history, customInterviewers, candidateProfile } = req.body;

    // Sanitize custom interviewers
    const safeCustomInterviewers: CustomInterviewerInput[] = Array.isArray(customInterviewers)
      ? customInterviewers.slice(0, 2).filter((c: any) =>
          c && typeof c.id === 'string' && typeof c.name === 'string' &&
          typeof c.title === 'string' && typeof c.personality === 'string' &&
          c.name.length <= 10 && c.title.length <= 20 && c.personality.length <= 100
        )
      : [];

    // Sanitize candidate profile
    const safeCandidateProfile: CandidateProfileInput | undefined = candidateProfile && typeof candidateProfile === 'object'
      ? {
          ...(typeof candidateProfile.name === 'string' && candidateProfile.name.length <= 20 ? { name: candidateProfile.name } : {}),
          ...(typeof candidateProfile.experience === 'number' ? { experience: Math.min(50, Math.max(0, candidateProfile.experience)) } : {}),
          ...(typeof candidateProfile.techStack === 'string' && candidateProfile.techStack.length <= 100 ? { techStack: candidateProfile.techStack } : {}),
          ...(typeof candidateProfile.targetSalary === 'string' && candidateProfile.targetSalary.length <= 20 ? { targetSalary: candidateProfile.targetSalary } : {}),
          ...(typeof candidateProfile.background === 'string' && candidateProfile.background.length <= 100 ? { background: candidateProfile.background } : {}),
          ...(typeof candidateProfile.resumeText === 'string' ? { resumeText: candidateProfile.resumeText.slice(0, 1000) } : {}),
        }
      : undefined;

    const safeState = sanitizeState(state);

    const validation = validateInput(
      answer,
      interviewers,
      position || 'frontend',
      severity || 2,
      safeState.round,
      safeCustomInterviewers
    );
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const apiKey = getArkApiKey();
    if (!apiKey) {
      console.error('ARK_API_KEY not configured');
      return res.status(500).json({ error: '服务器配置错误' });
    }

    const safeHistory = sanitizeHistory(history);

    // 1. Analyze answer quality
    const answerAnalysis = analyzeAnswer(answer);
    let newStress = Math.max(0, Math.min(100, safeState.stress + answerAnalysis.stressChange));
    let newConfidence = Math.max(0, Math.min(100, safeState.confidence + answerAnalysis.confidenceChange));
    const newRound = safeState.round + 1;

    // 2. Check stress explosion before AI call
    if (newStress >= 100) {
      const ending = getEnding(newStress, newConfidence, newRound);
      return res.status(200).json({
        responses: [],
        state: { stress: newStress, confidence: newConfidence, round: newRound },
        endResult: ending,
        answerQuality: answerAnalysis.quality,
      });
    }

    // 3. Maybe trigger random event
    let event = null;
    if (Math.random() < 0.15) {
      event = INTERVIEW_EVENTS[Math.floor(Math.random() * INTERVIEW_EVENTS.length)];
      newStress = Math.max(0, Math.min(100, newStress + event.stressChange));
      newConfidence = Math.max(0, Math.min(100, newConfidence + event.confidenceChange));

      if (newStress >= 100) {
        const ending = getEnding(newStress, newConfidence, newRound);
        return res.status(200).json({
          responses: [],
          state: { stress: newStress, confidence: newConfidence, round: newRound },
          event: event.text,
          endResult: ending,
          answerQuality: answerAnalysis.quality,
        });
      }
    }

    // 4. Select interviewers for this round
    const respondents = selectInterviewers(interviewers, newRound, severity || 2);

    // 5. Build context and call AI
    // 将历史消息全部转为 user 角色的叙述格式，避免 AI 混淆角色
    const narrativeHistory = safeHistory.map(m => ({
      role: 'user' as const,
      content: m.role === 'user' ? m.content : `（面试官回复：${m.content}）`,
    }));
    const contextMessages: Array<{ role: string; content: string }> = [
      ...narrativeHistory,
      { role: 'user', content: answer },
    ];

    const responses: Array<{ role: string; name: string; content: string; mood: string }> = [];

    for (const role of respondents) {
      const systemPrompt = buildInterviewPrompt(
        role,
        position || 'frontend',
        severity || 2,
        newRound,
        10,
        newStress,
        interviewers,
        safeCustomInterviewers,
        safeCandidateProfile
      );

      const prevSpeech = responses.map(r => `${r.name}说："${r.content}"`).join('\n');
      const currentContext = [
        ...contextMessages,
        ...(prevSpeech ? [{ role: 'user' as const, content: `（其他面试官的发言：\n${prevSpeech}）` }] : []),
      ];

      try {
        const rawContent = await callArkAPI(apiKey, systemPrompt, currentContext);
        const content = cleanResponse(rawContent, role, safeCustomInterviewers);
        const mood = analyzeInterviewerMood(content);

        // Interviewer mood affects stress
        if (mood === 'sarcastic') newStress = Math.min(100, newStress + 5);
        if (mood === 'pressing') newStress = Math.min(100, newStress + 3);

        responses.push({
          role,
          name: getCustomInterviewerName(role, safeCustomInterviewers),
          content,
          mood,
        });
      } catch (err: any) {
        if (err?.message === 'CONTENT_FILTERED') {
          responses.push({
            role,
            name: getCustomInterviewerName(role, safeCustomInterviewers),
            content: '请注意你的措辞，我们是正式面试。回到正题，你对这个岗位有什么了解？',
            mood: 'cold',
          });
        } else {
          console.error(`Failed to get response for ${role}:`, err);
        }
      }
    }

    if (responses.length === 0) {
      return res.status(500).json({ error: 'AI 服务暂时不可用，请稍后重试' });
    }

    // 6. Check end conditions
    let endResult = null;
    if (newStress >= 100 || newRound >= 10) {
      endResult = getEnding(newStress, newConfidence, newRound);
    }

    return res.status(200).json({
      responses,
      state: { stress: newStress, confidence: newConfidence, round: newRound },
      event: event ? event.text : null,
      endResult,
      answerQuality: answerAnalysis.quality,
    });

  } catch (error) {
    console.error('Interview API error:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
