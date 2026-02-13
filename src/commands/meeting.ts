/**
 * 会议发言建议生成器
 * 功能：根据不同会议场景和角色生成会议发言
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { RoleType } from '../prompts';

export interface MeetingOptions {
  role: RoleType;
  scenario: 'standup' | 'review' | 'brainstorm' | 'retro' | 'planning';
}

/**
 * 会议场景配置
 */
const MEETING_SCENARIOS = {
  standup: {
    name: '每日站会',
    description: '快速同步工作进展和计划',
    duration: '15分钟'
  },
  review: {
    name: '评审会议',
    description: '方案评审/代码评审/产品评审',
    duration: '30-60分钟'
  },
  brainstorm: {
    name: '头脑风暴',
    description: '创意发散和方案讨论',
    duration: '30-90分钟'
  },
  retro: {
    name: '回顾会议',
    description: '总结经验教训和改进点',
    duration: '60分钟'
  },
  planning: {
    name: '规划会议',
    description: '迭代规划和任务分配',
    duration: '60分钟'
  }
};

/**
 * 角色会议发言模板
 */
const ROLE_MEETING_TEMPLATES = {
  boss: {
    standup: [
      '大家抓紧时间，我简单说几点',
      '{X}，你的进度怎么样？要抓紧啊',
      '这个项目时间很紧，大家要有紧迫感',
      '辛苦辛苦，但结果才是最重要的'
    ],
    review: [
      '这个方案我看了，还需要再完善',
      '我认为可以从以下角度优化',
      '我的建议是{X}，大家参考',
      '这个方向是对的，但执行要到位'
    ],
    brainstorm: [
      '我想听一下大家的想法，不要怕说错',
      '我们要开放心态，多提意见',
      '这个想法不错，可以深入一下',
      '我补充一点'
    ],
    retro: [
      '这个迭代整体还行，但还有改进空间',
      '我觉得{X}做得不错，{Y}需要加强',
      '下次我们要注意{X}',
      '大家可以畅所欲言，不要有顾虑'
    ],
    planning: [
      '这个迭代我们要确保{X}目标的达成',
      '大家要对自己的任务负责',
      '时间节点不能拖延',
      '有问题及时沟通，不要等最后才说'
    ]
  },
  employee: {
    standup: [
      '昨天我完成了{X}',
      '今天计划{X}',
      '目前遇到{X}问题，正在排查',
      '可能需要{support}支持一下'
    ],
    review: [
      '我觉得这个方案可行',
      '技术上应该可以实现',
      '我可能需要{X}天时间',
      '可以参考{X}方案'
    ],
    brainstorm: [
      '我觉得可以从{X}角度考虑',
      '我的想法是{X}',
      '可以尝试{X}方案',
      '我补充一点'
    ],
    retro: [
      '我觉得这次{X}做得不错',
      '{Y}方面可能需要改进',
      '下次可以{X}',
      '我也分享一下我的感受'
    ],
    planning: [
      '我可以负责{X}任务',
      '预计需要{X}天完成',
      '可能需要{support}支持',
      '我会尽力按时完成'
    ]
  },
  pm: {
    standup: [
      '今天对齐{X}个事项',
      '{X}个项目需要{action}',
      '用户反馈需要{review}',
      '下周要上线{X}个功能'
    ],
    review: [
      '从产品角度看{X}',
      '用户价值{X}',
      '建议{action}后再确认',
      '这个方案对齐用户需求了吗'
    ],
    brainstorm: [
      '我们可以从用户场景考虑',
      '核心诉求是{X}',
      '我的想法是{X}',
      '这个思路有创新性'
    ],
    retro: [
      '这次迭代{X}方面做得不错',
      '{Y}需要继续优化',
      '用户反馈{X}',
      '下次可以{X}'
    ],
    planning: [
      '这次迭代聚焦{X}功能',
      '时间节点{X}',
      '资源分配{X}',
      '上线目标{X}'
    ]
  },
  hr: {
    standup: [
      '大家今天状态怎么样',
      '有什么需要支持的',
      '团队氛围{X}',
      '要注意劳逸结合'
    ],
    review: [
      '从团队角度{X}',
      '资源配置{X}',
      '大家觉得呢',
      '有什么困难可以提出来'
    ],
    brainstorm: [
      '我们可以多角度思考',
      '大家畅所欲言',
      '团队的意见很重要',
      '我补充一点企业文化相关'
    ],
    retro: [
      '团队协作{X}',
      '{Y}有待提升',
      '文化建设{X}',
      '下次活动{X}'
    ],
    planning: [
      '团建计划{X}',
      '培训安排{X}',
      '文化建设{X}',
      '团队发展{X}'
    ]
  },
  techlead: {
    standup: [
      '{X}，你的代码需要review',
      '这个模块性能有问题',
      '架构需要优化',
      '技术债务要处理'
    ],
    review: [
      '这个方案{X}有问题',
      '架构上不够清晰',
      '性能考虑不足',
      '需要重构'
    ],
    brainstorm: [
      '从技术角度看{X}',
      '可以用{X}方案',
      '架构层面{X}',
      '技术选型{X}'
    ],
    retro: [
      '代码质量{X}',
      '{Y}需要改进',
      '技术分享{X}',
      '下次重构{X}'
    ],
    planning: [
      '技术预研{X}',
      '重构计划{X}',
      '性能优化{X}',
      '代码审查{X}'
    ]
  },
  intern: {
    standup: [
      '昨天我学习了{X}',
      '今天计划{X}',
      '遇到{X}问题，请教了一下',
      '正在学习中'
    ],
    review: [
      '我学到了{X}',
      '这个方案好像可行',
      '我可能需要指导',
      '可以尝试实现'
    ],
    brainstorm: [
      '我想到了一个想法',
      '可以从{X}角度考虑',
      '请问{X}这样行吗',
      '我补充一下'
    ],
    retro: [
      '我学到了很多',
      '{X}做得很好',
      '{Y}对我来说有点难',
      '下次希望能多学学'
    ],
    planning: [
      '我想参与{X}任务',
      '可能需要指导',
      '我会努力学习',
      '有不懂的及时请教'
    ]
  }
};

/**
 * 获取随机占位符值
 */
function getRandomPlaceholder(): string {
  const placeholders = ['相关需求', '核心功能', '业务问题', '技术方案', '项目进展', '团队协作', '用户体验', '性能优化'];
  return placeholders[Math.floor(Math.random() * placeholders.length)];
}

/**
 * 填充模板
 */
function fillTemplate(template: string): string {
  const actions = ['处理', '跟进', '完善', 'review', '实现', '优化'];
  const supports = ['协助', '指导', '帮助', '支持'];

  return template.replace(/{X}/g, getRandomPlaceholder())
              .replace(/{Y}/g, getRandomPlaceholder())
              .replace(/{review}/g, 'review')
              .replace(/{action}/g, () => actions[Math.floor(Math.random() * actions.length)])
              .replace(/{support}/g, () => supports[Math.floor(Math.random() * supports.length)]);
}

/**
 * 生成会议发言
 */
export function generateMeetingSuggestion(options: MeetingOptions): string {
  const role = options.role || 'boss';
  const scenario = options.scenario || 'standup';
  const roleTemplates = ROLE_MEETING_TEMPLATES[role] || ROLE_MEETING_TEMPLATES.boss;
  const scenarioTemplates = roleTemplates[scenario] || roleTemplates.standup;

  // 随机选择 1-3 个发言
  const count = Math.floor(Math.random() * 3) + 1;
  const suggestions: string[] = [];

  for (let i = 0; i < count; i++) {
    const template = scenarioTemplates[Math.floor(Math.random() * scenarioTemplates.length)];
    suggestions.push(fillTemplate(template));
  }

  // 生成角色和场景名称
  const roleNames = {
    boss: '老板',
    employee: '员工',
    pm: '产品经理',
    hr: 'HR',
    techlead: '技术主管',
    intern: '实习生'
  };

  const scenarioInfo = MEETING_SCENARIOS[scenario] || MEETING_SCENARIOS.standup;

  // 生成输出
  const output: string[] = [];
  output.push(chalk.cyan('╔════════════════════════════════════════════════════════╗'));
  output.push(chalk.cyan('║') + '            ' + chalk.bold.white('会议发言建议生成器') + '                      ' + chalk.cyan('║'));
  output.push(chalk.cyan('╠════════════════════════════════════════════════════╣'));
  output.push(chalk.cyan('║') + '  ' + chalk.bold.yellow('角色: ') + roleNames[role] + '                              ' + chalk.cyan('║'));
  output.push(chalk.cyan('║') + '  ' + chalk.bold.yellow('场景: ') + scenarioInfo.name + ' (' + scenarioInfo.description + ')       ' + chalk.cyan('║'));
  output.push(chalk.cyan('║') + '  ' + chalk.bold.yellow('时长: ') + scenarioInfo.duration + '                              ' + chalk.cyan('║'));
  output.push(chalk.cyan('╠══════════════════════════════════════════════════════╣'));
  output.push(chalk.cyan('║') + '                                                              ' + chalk.cyan('║'));
  output.push(chalk.cyan('║') + '  ' + chalk.bold.green('💡 发言建议:') + '                                               ' + chalk.cyan('║'));
  output.push(chalk.cyan('║') + '                                                              ' + chalk.cyan('║'));

  suggestions.forEach((suggestion, index) => {
    output.push(chalk.cyan('║') + `  ${index + 1}. ${suggestion.padEnd(60)}                                        ` + chalk.cyan('║'));
  });

  output.push(chalk.cyan('║') + '                                                              ' + chalk.cyan('║'));
  output.push(chalk.cyan('╚═══════════════════════════════════════════════════════════╝'));

  return output.join('\n');
}

/**
 * 会议发言建议命令
 */
export function createMeetingCommand(): Command {
  const command = new Command('meeting')
    .description('会议发言建议 - 根据角色和场景生成会议发言建议')
    .option('-r, --role <role>', '角色: boss, employee, pm, hr, techlead, intern', 'boss')
    .option('-s, --scenario <type>', '场景: standup(站会), review(评审), brainstorm(头脑风暴), retro(回顾), planning(规划)', 'standup')
    .option('-n, --number <count>', '建议数量（1-3，默认随机）');

  command.action(async (options) => {
    const role = options.role || 'boss' as RoleType;
    const scenario = options.scenario || 'standup';

    const suggestion = generateMeetingSuggestion({ role, scenario });

    console.log();
    console.log(suggestion);
    console.log();
    console.log(chalk.gray('💡 提示: 在实际会议中，根据情况灵活调整发言内容和时机'));
  });

  return command;
}
