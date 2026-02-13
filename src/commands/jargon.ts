/**
 * 职场黑话生成器
 * 功能：生成各种类型的职场黑话，或将普通文本转换为黑话版本
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { RoleType } from '../prompts';

export interface JargonOptions {
  type?: 'meeting' | 'report' | 'email' | 'chat' | 'all';
  intensity?: 'light' | 'medium' | 'heavy';
  translate?: boolean;
}

/**
 * 职场黑话词典
 */
const JARGON_DICT: Record<string, string[]> = {
  meeting: [
    '对齐', '拉通', '沉淀', '赋能', '闭环', '抓手', '打法',
    '组合拳', '矩阵', '协同', '联动', '共振', '裂变',
    '渗透', '击穿', '落地', '复盘', '迭代', '敏捷',
    '颗粒度', '链路', '痛点', '痒点', '抓手', '底座',
    '中台', '前端', '后端', '全链路', '端到端', '生命周期'
  ],
  report: [
    '复盘', '迭代', '裂变', '矩阵', '组合拳', '深挖',
    '赋能', '加持', '维度', '视角', '赛道', '锚点', '支点', '杠杆', '撬动', '辐射', '覆盖',
    '渗透', '下沉', '上行', '输出', '交付', '闭环',
    '认知', '心智', '感知', '体感', '触点', '路径', '打法', '模型', '范式', '体系', '方法论'
  ],
  email: [
    '望', '谢谢', '辛苦了', '辛苦了', '劳烦', '敬请', '谢谢',
    '妥否', '收到', '请回复', '为盼', '顺颂', '商祺',
    '尽快', '方便', '麻烦', '协助', '支持', '配合',
    '推进', '落实', '完成', '跟进', '反馈', '确认',
    '抄送', '呈报', '汇报', '同步', '对齐', '拉通'
  ],
  chat: [
    '颗粒度', '护城河', '降本增效', '天花板', '瓶颈',
    '赋能', '迭代', '敏捷', '瀑布', 'Scrum', 'Daily',
    'OKR', 'KPI', 'GMV', 'DAU', 'MAU',
    '转化', '留存', '促活', '召回', '裂变', '传播',
    '痛点', '爽点', '场景', '案例', '方法论', '最佳实践'
  ]
};

/**
 * 获取指定类型的黑话列表
 */
function getJargonByType(type: string): string[] {
  if (type === 'all') {
    return [...JARGON_DICT.meeting, ...JARGON_DICT.report, ...JARGON_DICT.email, ...JARGON_DICT.chat];
  }
  return JARGON_DICT[type as keyof typeof JARGON_DICT] || JARGON_DICT.meeting;
}

/**
 * 根据强度过滤黑话
 */
function filterByIntensity(jargon: string[], intensity: string): string[] {
  if (intensity === 'light') {
    return jargon.slice(0, 5);
  } else if (intensity === 'medium') {
    return jargon.slice(0, 10);
  } else {
    return jargon;
  }
}

/**
 * 将普通文本转换为黑话版本
 */
export function translateToJargon(text: string, intensity: string = 'medium'): string {
  let result = text;
  const replacementCount = intensity === 'light' ? 3 : intensity === 'medium' ? 6 : 10;

  // 随机选择并替换 3-10 个词
  const rules = ['做', '想想', '讨论', '连接'];
  const shuffledRules = rules.sort(() => Math.random() - 0.5).slice(0, replacementCount);

  for (const rule of shuffledRules) {
    const regex = new RegExp(`(${rule})`, 'g');
    result = result.replace(regex, '对$1');
  }

  // 添加随机黑话
  const jargonList = JARGON_DICT.chat.sort(() => Math.random() - 0.5);
  result = `${result}，${jargonList[Math.floor(Math.random() * jargonList.length)]}到位`;

  return result as string;
}

/**
 * 生成黑话示例句子
 */
export function generateJargonSentence(type: string, intensity: string): string {
  const templates: Record<string, string[]> = {
    meeting: ['我们来{action}一下{topic}的{aspect}', '需要{action}一下{topic}'],
    report: ['本周{action}了{number}个{topic}', '完成了{number}个{topic}的{action}'],
    email: ['辛苦{action}一下{topic}', '麻烦{action}一下{topic}'],
    chat: ['需要在{topic}方面{action}', '关于{topic}的{aspect}']
  };

  const selectedTemplates = templates[type] || templates.meeting;
  const template = selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];

  return template
    .replace(/{action}/g, () => ['对齐', '拉通', '赋能', '沉淀'][Math.floor(Math.random() * 4)])
    .replace(/{number}/g, () => String(Math.floor(Math.random() * 10) + 1))
    .replace(/{topic}/g, () => ['业务', '产品', '项目', '需求'][Math.floor(Math.random() * 4)])
    .replace(/{aspect}/g, () => ['颗粒度', '护城河', '闭环', '抓手'][Math.floor(Math.random() * 4)]);
}

/**
 * 黑话生成器命令
 */
export function createJargonCommand(): Command {
  const command = new Command('jargon')
    .description('职场黑话生成器 - 生成各种类型的职场黑话')
    .option('-t, --type <type>', '黑话类型: meeting(会议), report(报告), email(邮件), chat(聊天), all(全部)', 'meeting')
    .option('-i, --intensity <level>', '强度: light(轻度), medium(中度), heavy(重度)', 'medium')
    .argument('[text...]', '要翻译的普通文本（输入文本则进入翻译模式）');

  command.action(async (textArgs, options) => {
    const type = options.type || 'meeting';
    const intensity = options.intensity || 'medium';

    // 当用户输入文本时，进入翻译模式
    if (textArgs.length > 0) {
      // 翻译模式
      if (textArgs.length === 0) {
        console.log('❌ 请提供要翻译的文本');
        console.log('\n示例:');
        console.log('  pua jargon "帮我做个功能"');
        console.log('  pua jargon "我们一起讨论这个问题"');
        return;
      }

      const input = textArgs.join(' ');
      const translated = translateToJargon(input, intensity);

      console.log();
      console.log('📝 原文:', input);
      console.log('🎯 黑话:', translated);
      console.log();
    } else {
      // 生成模式
      const jargonList = getJargonByType(type);
      const filteredJargon = filterByIntensity(jargonList, intensity);

      console.log();
      console.log(`🎯 职场黑话生成器 [${type.toUpperCase()} - ${intensity.toUpperCase()}]`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log();
      filteredJargon.forEach((word, index) => {
        console.log(`  ${index + 1}. ${chalk.cyan(word)}`);
      });

      console.log();
      console.log('💡 示例句子:');
      console.log(chalk.gray(generateJargonSentence(type, intensity)));
      console.log();
    }
  });

  return command;
}
