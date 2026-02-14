/**
 * 会议室共享工具函数
 * 回复者选择、情绪检测、随机事件、评分卡
 */

import type { RoleType } from '../prompts/index';
import {
  CHARACTER_NAMES,
  CHARACTER_DYNAMICS,
  KEYWORD_ROLE_SCORES,
  type ChaosLevel,
} from '../prompts/meeting-prompts';

/**
 * 情绪类型
 */
export type MoodType = 'neutral' | 'angry' | 'smug' | 'worried' | 'submissive' | 'excited';

/**
 * 会议事件
 */
export interface MeetingEvent {
  text: string;
  targetRole?: RoleType;
}

/**
 * 评分卡数据
 */
export interface ScoreCard {
  totalMessages: number;
  roleMessageCounts: Partial<Record<RoleType, number>>;
  cakePaintCount: number;         // 画饼次数
  jargonDensity: number;          // 黑话密度 (0-100)
  effectiveDecisions: number;     // 有效决策数
  interruptCount: number;         // 打断次数
  topContributor: string;         // 最活跃参与者
  goldQuote?: string;             // 金句
  rating: number;                 // 1-5星
  summary: string;                // 总评语
}

/**
 * 选择回复者 - 基于 chaosLevel、关键词相关度和上一轮发言者
 */
export function selectRespondents(
  participants: RoleType[],
  message: string,
  chaosLevel: ChaosLevel,
  lastRespondents: RoleType[]
): RoleType[] {
  // 回复人数根据混乱程度决定
  const responseCount = Math.min(chaosLevel + 1, participants.length);

  // 为每个参与者计算得分
  const scores: Record<string, number> = {};
  for (const role of participants) {
    scores[role] = 1; // 基础分

    // 关键词匹配评分
    for (const [keyword, roleScores] of Object.entries(KEYWORD_ROLE_SCORES)) {
      if (message.includes(keyword) && roleScores[role]) {
        scores[role] += roleScores[role]!;
      }
    }

    // 上一轮发言者降分（避免同一人连续发言）
    if (lastRespondents.includes(role)) {
      scores[role] -= 2;
    }

    // 混乱程度加随机因子
    scores[role] += Math.random() * chaosLevel;

    // 确保不低于0
    scores[role] = Math.max(0.1, scores[role]);
  }

  // 按得分排序，取前 N 个
  const sorted = participants
    .slice()
    .sort((a, b) => scores[b] - scores[a]);

  return sorted.slice(0, responseCount);
}

/**
 * 检测回复内容的情绪
 */
export function detectMood(content: string): MoodType {
  const lowerContent = content.toLowerCase();

  const moodKeywords: Record<MoodType, string[]> = {
    angry: ['不行', '什么？', '太差', '怎么回事', '不满意', '差劲', '不够', '太慢', '失望'],
    smug: ['我早就', '看吧', '果然', '就说嘛', '当初', '早就预料', '不出所料'],
    worried: ['担心', '风险', '延期', '来不及', '不确定', '可能会', '万一'],
    submissive: ['好的', '收到', '对不起', '抱歉', '不好意思', '是我的', '我去改'],
    excited: ['太好了', '不错', '可以', '赞', '棒', '厉害', '学到了'],
    neutral: [],
  };

  let bestMood: MoodType = 'neutral';
  let bestScore = 0;

  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (mood === 'neutral') continue;
    let score = 0;
    for (const kw of keywords) {
      if (lowerContent.includes(kw)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood as MoodType;
    }
  }

  return bestMood;
}

/**
 * 生成随机会议事件
 * @returns 事件对象，或 null（大多数时候不触发）
 */
export function generateMeetingEvent(
  participants: RoleType[],
  triggerChance: number = 0.1
): MeetingEvent | null {
  if (Math.random() > triggerChance) {
    return null;
  }

  const events: MeetingEvent[] = [
    { text: `📱 ${CHARACTER_NAMES.boss}的手机响了，他出去接电话了...`, targetRole: 'boss' },
    { text: `☕ ${CHARACTER_NAMES.intern}打翻了咖啡！"对不起对不起！"`, targetRole: 'intern' },
    { text: `🦗 ...尴尬的沉默...大家互相看着...` },
    { text: `💥 ${CHARACTER_NAMES.pm}突然说："等等，需求变了"`, targetRole: 'pm' },
    { text: `📢 ${CHARACTER_NAMES.boss}开始即兴演讲："想当年我创业的时候..."`, targetRole: 'boss' },
    { text: `💤 ${CHARACTER_NAMES.employee}差点睡着了...`, targetRole: 'employee' },
    { text: `📝 ${CHARACTER_NAMES.intern}疯狂记笔记中...`, targetRole: 'intern' },
    { text: `🔥 ${CHARACTER_NAMES.techlead}和${CHARACTER_NAMES.pm}吵起来了！`, targetRole: 'techlead' },
    { text: `🎂 ${CHARACTER_NAMES.hr}突然提议："要不要团建？"`, targetRole: 'hr' },
    { text: `💻 ${CHARACTER_NAMES.techlead}打开了IDE开始写代码...`, targetRole: 'techlead' },
    { text: `🍜 有人的外卖到了，整个会议室都是味道...` },
    { text: `📊 ${CHARACTER_NAMES.pm}掏出了一个40页的PPT...`, targetRole: 'pm' },
    { text: `🤝 ${CHARACTER_NAMES.hr}开始发起大家一起喊口号："加油！奋斗！"`, targetRole: 'hr' },
    { text: `⏰ 已经超时了，但${CHARACTER_NAMES.boss}还在说...`, targetRole: 'boss' },
  ];

  // 优先选择参会者相关的事件
  const relevantEvents = events.filter(
    e => !e.targetRole || participants.includes(e.targetRole)
  );

  return relevantEvents[Math.floor(Math.random() * relevantEvents.length)];
}

/**
 * 画饼关键词
 */
const CAKE_KEYWORDS = [
  '期权', '股权', '未来', '前景', '发展空间', '上市',
  '大饼', '潜力', '机会', '平台', '成长', '当年',
  '格局', '赋能', '抓手', '闭环', '对齐',
];

/**
 * 黑话关键词
 */
const JARGON_KEYWORDS = [
  '赋能', '对齐', '闭环', '抓手', '颗粒度', '打通',
  '底层逻辑', '顶层设计', '组合拳', '方法论', '链路',
  '漏斗', '触达', '心智', '拉通', '沉淀', '复盘',
  'MVP', 'PMF', 'ROI', 'OKR', 'KPI',
];

/**
 * 生成会议评分卡
 */
export function generateScoreCard(
  messages: Array<{ role: RoleType | 'user'; content: string }>,
  participants: RoleType[]
): ScoreCard {
  const roleMessageCounts: Partial<Record<RoleType, number>> = {};
  let cakePaintCount = 0;
  let jargonCount = 0;
  let totalWords = 0;
  let interruptCount = 0;
  let longestMessage = '';
  let longestRole = '';

  for (const msg of messages) {
    if (msg.role === 'user') continue;

    const role = msg.role as RoleType;
    roleMessageCounts[role] = (roleMessageCounts[role] || 0) + 1;
    totalWords += msg.content.length;

    // 统计画饼关键词
    for (const kw of CAKE_KEYWORDS) {
      if (msg.content.includes(kw)) {
        cakePaintCount++;
      }
    }

    // 统计黑话
    for (const kw of JARGON_KEYWORDS) {
      if (msg.content.includes(kw)) {
        jargonCount++;
      }
    }

    // 检测打断（包含"等等""我说""打断"）
    if (msg.content.includes('等等') || msg.content.includes('我说') || msg.content.includes('打断')) {
      interruptCount++;
    }

    // 找金句（最长的回复通常最搞笑）
    if (msg.content.length > longestMessage.length) {
      longestMessage = msg.content;
      longestRole = CHARACTER_NAMES[role] || role;
    }
  }

  // 找最活跃参与者
  let topRole: RoleType = participants[0];
  let topCount = 0;
  for (const [role, count] of Object.entries(roleMessageCounts)) {
    if (count > topCount) {
      topCount = count;
      topRole = role as RoleType;
    }
  }

  // 黑话密度
  const jargonDensity = totalWords > 0 ? Math.min(100, Math.round((jargonCount / (totalWords / 20)) * 100)) : 0;

  // 评分：越混乱越低分（但更有趣）
  const totalMsgs = messages.filter(m => m.role !== 'user').length;
  const rating = Math.max(1, Math.min(5, 5 - Math.floor(cakePaintCount / 3) - Math.floor(interruptCount / 2)));

  // 总评语
  const summaries = [
    '又一场可以用邮件代替的会议',
    '会议很成功，什么都没决定',
    '时间管理大师们的聚会',
    '黑话浓度超标，请打开窗户',
    '有效信息密度约等于零',
    '一场精彩的职场大戏',
  ];
  const summary = summaries[Math.floor(Math.random() * summaries.length)];

  return {
    totalMessages: totalMsgs,
    roleMessageCounts,
    cakePaintCount,
    jargonDensity,
    effectiveDecisions: 0, // 永远是0，这是个梗
    interruptCount,
    topContributor: `${CHARACTER_NAMES[topRole]}(${topCount}条)`,
    goldQuote: longestMessage ? `${longestRole}: "${longestMessage}"` : undefined,
    rating,
    summary,
  };
}
