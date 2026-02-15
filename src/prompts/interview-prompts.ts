/**
 * 压力面试专用 Prompt 模块
 * 用户扮演候选人，面对 2-4 个刁钻面试官
 * 10 轮问答制，压力值到 100% 游戏结束
 */

import type { RoleType } from './index';

/**
 * 面试岗位类型
 */
export type InterviewPosition = 'frontend' | 'backend' | 'product' | 'design';

/**
 * PUA 强度
 */
export type InterviewSeverity = 1 | 2 | 3;

/**
 * 面试官角色（复用 RoleType 中的 4 个）
 */
export type InterviewerRole = 'techlead' | 'boss' | 'hr' | 'pm';

/**
 * 面试岗位中文名
 */
export const POSITION_NAMES: Record<InterviewPosition, string> = {
  frontend: '前端开发',
  backend: '后端开发',
  product: '产品经理',
  design: 'UI/UX 设计师',
};

/**
 * 面试官映射到面试场景
 */
export const INTERVIEWER_NAMES: Record<InterviewerRole, string> = {
  techlead: '刘哥',
  boss: '张总',
  hr: '陈姐',
  pm: '李姐',
};

export const INTERVIEWER_TITLES: Record<InterviewerRole, string> = {
  techlead: '技术总监',
  boss: 'CTO',
  hr: 'HR 总监',
  pm: '产品负责人',
};

export const INTERVIEWER_TAGS: Record<InterviewerRole, string> = {
  techlead: '追问细节 / 嫌弃简历',
  boss: '画饼压价 / 质疑能力',
  hr: '套话压薪 / 问敏感问题',
  pm: '脑筋急转弯 / 考察沟通',
};

/**
 * 面试官角色 Prompt
 */
const INTERVIEWER_PROMPTS: Record<InterviewerRole, string> = {
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

/**
 * 岗位相关的技术追问方向
 */
const POSITION_FOCUS: Record<InterviewPosition, string> = {
  frontend: '重点追问：框架原理（React/Vue）、CSS布局、性能优化、浏览器原理、TypeScript、前端工程化。',
  backend: '重点追问：数据库设计、分布式系统、API设计、并发处理、缓存策略、系统架构。',
  product: '重点追问：需求分析、用户研究、数据驱动、竞品分析、商业模式、产品思维。',
  design: '重点追问：设计规范、交互逻辑、用户体验、设计系统、可访问性、设计工具。',
};

/**
 * 压力等级修饰
 */
const SEVERITY_MODIFIERS: Record<InterviewSeverity, string> = {
  1: '面试氛围相对友好，但仍会适当施压。偶尔给候选人鼓励。',
  2: '正常压力面试，保持刁钻和质疑。不给候选人喘息机会。',
  3: '极度高压！连珠炮追问、冷嘲热讽、否定一切回答、故意打击信心！',
};

/**
 * 获取面试官系统提示词
 */
export function getInterviewPrompt(
  role: InterviewerRole,
  position: InterviewPosition,
  severity: InterviewSeverity,
  round: number,
  totalRounds: number,
  stress: number,
  otherInterviewers: InterviewerRole[]
): string {
  const rolePrompt = INTERVIEWER_PROMPTS[role];
  const positionFocus = POSITION_FOCUS[position];
  const positionName = POSITION_NAMES[position];
  const severityMod = SEVERITY_MODIFIERS[severity];

  const othersDesc = otherInterviewers
    .filter(r => r !== role)
    .map(r => `${INTERVIEWER_NAMES[r]}(${INTERVIEWER_TITLES[r]})`)
    .join('、');

  // 压力值高时，面试官加大攻击
  const stressHint = stress > 70
    ? '候选人已经很紧张了，继续加大压力！追问更难的问题。'
    : stress > 40
      ? '候选人有些紧张，保持正常面试压力。'
      : '候选人目前还比较从容，可以适当抛出难题。';

  return `${rolePrompt}

【面试信息】正在面试${positionName}岗位候选人。当前第 ${round}/${totalRounds} 轮。
${othersDesc ? `同面面试官：${othersDesc}。` : ''}
${positionFocus}
${severityMod}
${stressHint}

【输出规则 - 必须严格遵守】
1. 每次只问 1 个问题或做 1 个点评
2. 绝对不要用 [名字]: 格式，直接说话
3. 回复 30-60 字，像真正面试官说的话
4. 保持你的面试官性格
5. 不要说"作为AI"或暴露技术身份
6. 根据候选人回答追问或转换话题
7. 如果其他面试官发言了，你可以补刀或追问`;
}

/**
 * 面试随机事件
 */
export interface InterviewEvent {
  text: string;
  stressChange: number;
  confidenceChange: number;
}

export const INTERVIEW_EVENTS: InterviewEvent[] = [
  { text: '📋 面试官翻了翻你的简历，皱了皱眉...', stressChange: 10, confidenceChange: -5 },
  { text: '📱 张总接了个电话，你有 30 秒喘息时间', stressChange: -5, confidenceChange: 5 },
  { text: '🖥️ "来，到白板上写一下代码"', stressChange: 15, confidenceChange: -10 },
  { text: '☕ 陈姐给你倒了杯水，"别紧张，慢慢说"', stressChange: -5, confidenceChange: 5 },
  { text: '📝 刘哥在纸上写了个 "?" 然后划掉了', stressChange: 8, confidenceChange: -5 },
  { text: '🤝 面试官们交换了一下眼神...', stressChange: 10, confidenceChange: -8 },
  { text: '💻 "打开你的 GitHub，让我看看你的代码"', stressChange: 12, confidenceChange: -5 },
  { text: '⏰ "时间差不多了，最后再问一个问题"', stressChange: 5, confidenceChange: 0 },
  { text: '😏 面试官嘴角微微上扬，不知道是好是坏...', stressChange: 5, confidenceChange: -3 },
  { text: '📊 李姐掏出一个产品原型："现场分析一下这个"', stressChange: 12, confidenceChange: -8 },
  { text: '🔇 突然安静了 10 秒钟...压力山大', stressChange: 8, confidenceChange: -5 },
  { text: '👀 你注意到面试官在评分表上画了个叉', stressChange: 15, confidenceChange: -10 },
  { text: '✅ 面试官点了点头，"嗯，这个回答还行"', stressChange: -8, confidenceChange: 10 },
  { text: '🎯 "好的，这个问题你回答得不错，继续"', stressChange: -5, confidenceChange: 8 },
];

/**
 * 面试结局
 */
export interface InterviewEnding {
  title: string;
  description: string;
  emoji: string;
}

export function getInterviewEnding(stress: number, confidence: number, round: number): InterviewEnding {
  // 压力爆表
  if (stress >= 100) {
    return {
      title: '面试 PUA 了！',
      description: '你被面试官的连环暴击击溃了...下次记得提前准备！',
      emoji: '💀',
    };
  }

  // 挺过了所有轮次
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

  // 提前退出
  return {
    title: '面试中断',
    description: '你提前结束了面试。勇气可嘉，但机会也没了。',
    emoji: '🚪',
  };
}

/**
 * 分析回答质量，更新压力值和自信值
 */
export interface AnswerAnalysis {
  stressChange: number;
  confidenceChange: number;
  quality: 'weak' | 'normal' | 'strong';
}

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

export function analyzeAnswer(answer: string): AnswerAnalysis {
  let weakScore = 0;
  let strongScore = 0;

  for (const kw of WEAK_KEYWORDS) {
    if (answer.includes(kw)) weakScore++;
  }
  for (const kw of STRONG_KEYWORDS) {
    if (answer.includes(kw)) strongScore++;
  }

  // 回答太短也是弱回答
  if (answer.length < 10) weakScore += 2;
  // 回答详细加分
  if (answer.length > 80) strongScore += 1;

  if (weakScore > strongScore + 1) {
    return { stressChange: 15, confidenceChange: -10, quality: 'weak' };
  }
  if (strongScore > weakScore + 1) {
    return { stressChange: -5, confidenceChange: 10, quality: 'strong' };
  }
  return { stressChange: 5, confidenceChange: -3, quality: 'normal' };
}

/**
 * 面试官情绪检测（影响压力变化）
 */
export function analyzeInterviewerMood(content: string): number {
  const sarcasmKeywords = ['呵呵', '有意思', '真的吗', '你确定', '就这？', '算了', '下一个'];
  const pressureKeywords = ['追问', '详细说说', '展开讲讲', '底层', '原理', '为什么'];

  let stressBonus = 0;
  for (const kw of sarcasmKeywords) {
    if (content.includes(kw)) stressBonus += 5;
  }
  for (const kw of pressureKeywords) {
    if (content.includes(kw)) stressBonus += 3;
  }
  return stressBonus;
}
