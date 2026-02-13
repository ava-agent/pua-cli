/**
 * 邮件语气转换器
 * 功能：根据不同角色转换邮件语气
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { RoleType } from '../prompts';

export interface EmailOptions {
  from: RoleType;
  to: RoleType;
  tone?: 'polite' | 'urgent' | 'casual' | 'passive';
  template?: 'request' | 'reply' | 'notify' | 'chase';
}

/**
 * 邮件语气转换规则
 */
const EMAIL_TEMPLATES: Record<string, {
  polite: string[];
  urgent: string[];
  casual: string[];
  passive: string[];
}> = {
  // PM -> 开发
  'pm-employee': {
    polite: [
      '辛苦处理一下{content}，谢谢',
      '麻烦处理并跟进，祝好',
      '团队好，请处理{content}'
    ],
    urgent: [
      '【紧急】请立即处理{content}',
      '请尽快处理，这个很紧急',
      '这个今天要处理完，辛苦一下'
    ],
    casual: [
      '{content}，麻烦搞一下',
      '帮我看下{content}，谢啦',
      '{content}搞完跟我说声'
    ],
    passive: [
      '如果方便的话，请处理{content}',
      '不好意思打扰，想处理一下{content}',
      '什么时候有时间处理一下{content}'
    ]
  },
  // 开发 -> PM
  'employee-pm': {
    polite: [
      '{content}已处理，请review',
      '附件已上传，请review',
      '{content}已完成，请确认'
    ],
    urgent: [
      '{content}可能需要支持，请确认',
      '这个{content}有点复杂，需要讨论',
      '时间可能延期，请调整'
    ],
    casual: [
      '{content}OK了，你看看',
      '{content}搞定，你review一下',
      '{content}没问题了'
    ],
    passive: [
      '{content}应该处理完了，请确认',
      '我觉得{content}这样行，团队你觉得呢',
      '{content}暂时这样，有问题讨论'
    ]
  },
  // HR -> 员工
  'hr-employee': {
    polite: [
      '{content}（收到请回复）',
      '请查收{content}，祝好',
      '麻烦处理一下{content}'
    ],
    urgent: [
      '【重要】请及时处理{content}',
      '请务必处理，后果自负',
      '今天下班前请处理'
    ],
    casual: [
      '{content}啊，团队',
      '{content}哈，有空处理一下',
      '{content}~'
    ],
    passive: [
      '如果方便的话请处理{content}',
      '不好意思，想处理一下{content}',
      '请问什么时候方便处理{content}'
    ]
  },
  // 员工 -> HR
  'employee-hr': {
    polite: [
      '好的，我马上处理',
      '收到，我会尽快处理',
      '{content}，我明白了'
    ],
    urgent: [
      '立即处理',
      '马上处理',
      '处理中'
    ],
    casual: [
      'OK',
      '行',
      '好团队'
    ],
    passive: [
      '我看看时间安排处理',
      '应该可以处理吧',
      '我尽量处理'
    ]
  }
};

/**
 * 语气修饰词
 */
const TONE_MODIFIERS = {
  polite: {
    prefix: ['麻烦', '辛苦', '劳烦', '望'],
    suffix: ['谢谢', '为盼', '顺颂商祺', '祝好']
  },
  urgent: {
    prefix: ['请立即', '请尽快', '请务必', '【紧急】', '【重要】'],
    suffix: ['谢谢配合', '辛苦了', '请支持']
  },
  casual: {
    prefix: ['嘿', '哈', '啦', '呗'],
    suffix: ['谢啦', 'OK', '搞定']
  },
  passive: {
    prefix: ['如果方便', '有空的话', '什么时候', '可能的话'],
    suffix: ['你觉得呢', '吧', '看看', '考虑一下']
  }
};

/**
 * 邮件常用短语
 */
const EMAIL_PHRASES = {
  opening: {
    polite: ['{name}您好', '尊敬的{name}', 'Hi {name}'],
    urgent: ['{name}你好', '{name}好'],
    casual: ['{name}', '嘿{name}', '{name}哈'],
    passive: ['{name}您好', 'Hi {name}']
  },
  closing: {
    polite: ['此致 敬礼', '祝工作愉快', '顺颂时祺', '谢谢'],
    urgent: ['请尽快回复', '辛苦支持', '请配合'],
    casual: ['谢了', 'OK', '加油'],
    passive: ['麻烦了', '打扰了', '辛苦了']
  }
};

/**
 * 转换邮件内容
 */
export function transformEmailTone(
  content: string,
  options: EmailOptions
): { transformed: string; explanation: string } {
  const from = options.from || 'boss';
  const to = options.to || 'employee';
  const tone = options.tone || 'polite';

  // 确定转换方向
  const direction = `${from}-${to}` as keyof typeof EMAIL_TEMPLATES;
  const templates = EMAIL_TEMPLATES[direction];

  if (!templates) {
    return {
      transformed: content,
      explanation: `暂不支持 ${from} -> ${to} 的邮件转换`
    };
  }

  // 获取对应语气的模板
  const toneTemplates = templates[tone as keyof typeof templates] || templates.polite;

  // 随机选择一个模板
  const template = toneTemplates[Math.floor(Math.random() * toneTemplates.length)];

  // 替换占位符
  const action = '处理';
  const action2 = '跟进';
  const review = 'review';
  const check = '确认';
  const support = '支持';
  const discuss = '讨论';
  const adjust = '调整';
  const delay = '延期';
  const urgency = '紧急';
  const consequence = '后果自负';
  const team = '团队';
  const greeting = '祝好';

  let transformed = template
    .replace(/{action}/g, () => action || '处理')
    .replace(/{action2}/g, () => action2 || '跟进')
    .replace(/{review}/g, () => review || 'review')
    .replace(/{check}/g, () => check || '确认')
    .replace(/{support}/g, () => support || '支持')
    .replace(/{discuss}/g, () => discuss || '讨论')
    .replace(/{adjust}/g, () => adjust || '调整')
    .replace(/{delay}/g, () => delay || '延期')
    .replace(/{urgency}/g, () => urgency || '紧急')
    .replace(/{consequence}/g, () => consequence || '后果自负')
    .replace(/{team}/g, () => team || '团队')
    .replace(/{greeting}/g, () => greeting || '祝好')
    .replace(/{content}/g, () => content);

  // 添加语气修饰词
  const modifier = TONE_MODIFIERS[tone] || TONE_MODIFIERS.polite;
  if (modifier.prefix && modifier.prefix.length > 0) {
    const prefix = modifier.prefix[Math.floor(Math.random() * modifier.prefix.length)];
    transformed = `${prefix}，${transformed}`;
  }
  if (modifier.suffix && modifier.suffix.length > 0) {
    const suffix = modifier.suffix[Math.floor(Math.random() * modifier.suffix.length)];
    transformed = `${transformed}${suffix}`;
  }

  // 生成说明
  const roleNames = {
    boss: '老板',
    employee: '员工',
    pm: '产品经理',
    hr: 'HR',
    techlead: '技术主管',
    intern: '实习生'
  };

  const toneNames = {
    polite: '礼貌',
    urgent: '紧急',
    casual: '随意',
    passive: '委婉'
  };

  const explanation = `
转换说明：
  方向: ${roleNames[from]} -> ${roleNames[to]}
  语气: ${toneNames[tone]}
  原文: ${content}
  转换: ${transformed}
  `.trim();

  return { transformed, explanation };
}

/**
 * 邮件语气转换器命令
 */
export function createEmailCommand(): Command {
  const command = new Command('email')
    .description('邮件语气转换器 - 转换邮件语气和风格')
    .option('-f, --from <role>', '发送者角色: boss, employee, pm, hr, techlead, intern', 'pm')
    .option('-t, --to <role>', '接收者角色: boss, employee, pm, hr, techlead, intern, dev, team', 'employee')
    .option('-T, --tone <tone>', '语气: polite(礼貌), urgent(紧急), casual(随意), passive(委婉)', 'polite')
    .argument('[content...]', '要转换的邮件内容');

  // 角色别名映射
  const roleAliases: Record<string, RoleType> = {
    'dev': 'employee',
    'developer': 'employee',
    'team': 'employee',
    'boss': 'boss',
    'manager': 'pm',
    'hr': 'hr',
    'lead': 'techlead',
    'intern': 'intern'
  };

  command.action(async (contentArgs, options) => {
    const fromRole = options.from || 'pm';
    const toRole = options.to || 'employee';
    const from = roleAliases[fromRole] || fromRole as RoleType;
    const to = roleAliases[toRole] || toRole as RoleType;
    const tone = options.tone || 'polite' as 'polite' | 'urgent' | 'casual' | 'passive';

    if (contentArgs.length === 0) {
      console.log();
      console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║') + chalk.bold.white('                    邮件语气转换器                         ') + chalk.cyan('║'));
      console.log(chalk.cyan('╚═════════════════════════════════════════════════════════════╝'));
      console.log();
      console.log('用法: pua email --from <角色> --to <角色> [内容]');
      console.log();
      console.log('角色说明:');
      console.log('  ' + chalk.red('boss') + '      - 老板');
      console.log('  ' + chalk.yellow('employee') + '  - 员工');
      console.log('  ' + chalk.cyan('pm') + '       - 产品经理');
      console.log('  ' + chalk.magenta('hr') + '       - HR');
      console.log('  ' + chalk.blue('techlead') + '   - 技术主管');
      console.log('  ' + chalk.green('intern') + '    - 实习生');
      console.log('  ' + chalk.gray('dev') + '       - 开发者（通用）');
      console.log();
      console.log('语气说明:');
      console.log('  polite   - 礼貌正式');
      console.log('  urgent   - 紧急催促');
      console.log('  casual   - 随意轻松');
      console.log('  passive  - 委婉含蓄');
      console.log();
      console.log('示例:');
      console.log(chalk.gray('  pua email --from pm --to dev "请查收附件"'));
      console.log(chalk.gray('  pua email --from hr --to employee --tone urgent "今天加班"'));
      console.log();
      return;
    }

    const content = contentArgs.join(' ');
    const result = transformEmailTone(content, { from, to, tone });

    console.log();
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + '  ' + chalk.bold.green('原文:') + '                                                          '.padEnd(53) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + content.substring(0, 60) + '                                              '.padEnd(53) + chalk.cyan('║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + '  ' + chalk.bold.yellow('转换:') + '                                                          '.padEnd(53) + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '  ' + result.transformed.substring(0, 60) + '                                      '.padEnd(53) + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
    console.log();
    console.log(chalk.gray(result.explanation));
    console.log();
  });

  return command;
}
