/**
 * 周报生成器
 * 功能：根据不同角色自动生成职场周报
 */

import { Command } from 'commander';
import chalk from 'chalk';
import type { RoleType } from '../prompts';

/**
 * 获取当前周数
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

export interface WeeklyReportOptions {
  role: RoleType;
  week?: number;
  highlights?: number;
}

/**
 * 周报模板配置
 */
const WEEKLY_TEMPLATES = {
  boss: {
    highlights: [
      '本周{X}个下属的工作进行了指导和监督',
      '与{X}位员工进行了1对1沟通',
      '参加了{X}场管理层会议',
      '对团队工作状态进行了{X}次检查'
    ],
    plans: [
      '下周计划重点关注{X}个项目的推进',
      '计划进行{X}次团队培训',
      '准备与{X}位核心员工进行深入沟通',
      '计划召开{X}场部门协调会'
    ],
    risks: [
      '可能存在{X}个项目进度风险',
      '需要注意{X}位员工的绩效问题',
      '资源可能存在{X}%的缺口',
      '可能面临{X}个外部挑战'
    ],
    data: [
      '本周团队产出提升{X}%',
      '完成{X}个关键里程碑',
      '团队加班时长{X}小时',
      '客户满意度{X}%'
    ]
  },
  employee: {
    highlights: [
      '完成了{X}个分配任务',
      '参与了{X}个项目会议',
      '处理了{X}个工单/问题',
      '学习了{X}项新技术/业务知识'
    ],
    plans: [
      '下周计划完成{X}个待办任务',
      '准备{X}个文档/报告',
      '计划学习{X}项新技能',
      '跟进{X}个问题处理进度'
    ],
    risks: [
      '可能存在{X}个技术难点',
      '{X}个任务可能时间紧张',
      '需要等待{X}个依赖/支持',
      '个人技能可能存在{X}个不足'
    ],
    data: [
      '完成任务{X}个',
      '代码提交{X}次',
      '修复Bug{X}个',
      '参加培训{X}小时'
    ]
  },
  pm: {
    highlights: [
      '完成了{X}个需求的评审和确认',
      '与{X}个干系人对齐了产品方向',
      '进行了{X}场用户调研/数据分析',
      '输出了{X}份产品文档/原型'
    ],
    plans: [
      '下周计划上线{X}个新功能',
      '准备进行{X}场产品宣讲',
      '计划优化{X}个核心流程',
      '准备{X}个版本的迭代规划'
    ],
    risks: [
      '{X}个需求可能存在变更风险',
      '开发资源可能存在{X}%的缺口',
      '{X}个功能可能延期上线',
      '用户反馈可能存在{X}个不确定性'
    ],
    data: [
      '需求完成率{X}%',
      '需求评审{X}场',
      '文档输出{X}份',
      '干系人对齐{X}次'
    ]
  },
  hr: {
    highlights: [
      '组织了{X}场团队建设活动',
      '完成了{X}位员工的入职/离职手续',
      '处理了{X}个员工关系/问题',
      '推进了{X}项企业文化建设工作'
    ],
    plans: [
      '下周计划组织{X}场培训活动',
      '准备进行{X}次员工访谈',
      '计划优化{X}项HR流程制度',
      '准备{X}场团建/文化活动'
    ],
    risks: [
      '员工满意度可能存在{X}%的波动',
      '{X}位核心员工可能存在离职风险',
      '招聘计划可能存在{X}%的缺口',
      '文化建设可能存在{X}个阻力'
    ],
    data: [
      '新入职员工{X}人',
      '离职员工{X}人',
      '培训覆盖率{X}%',
      '员工满意度{X}%'
    ]
  },
  techlead: {
    highlights: [
      '完成了{X}次代码审查',
      '处理了{X}个技术债务',
      '进行了{X}场技术分享会',
      '重构了{X}个核心模块'
    ],
    plans: [
      '下周计划优化{X}个性能瓶颈',
      '准备进行{X}项技术调研',
      '计划重构{X}个遗留模块',
      '准备输出{X}份技术文档'
    ],
    risks: [
      '{X}个系统可能存在稳定性风险',
      '{X}个技术债务可能影响交付',
      '团队技能可能存在{X}个短板',
      '{X}个依赖项可能存在兼容性问题'
    ],
    data: [
      '代码审查{X}次',
      'Bug修复{X}个',
      '性能优化{X}项',
      '技术分享{X}场'
    ]
  },
  intern: {
    highlights: [
      '完成了{X}个分配的学习任务',
      '参与了{X}个项目会议',
      '向{X}位同事请教了问题',
      '学习了{X}项新技能'
    ],
    plans: [
      '下周计划学习{X}项新内容',
      '准备参与{X}个项目',
      '计划请教{X}位资深同事',
      '计划阅读{X}篇技术文档'
    ],
    risks: [
      '可能存在{X}个知识盲区',
      '{X}个任务可能超出能力范围',
      '需要依赖{X}位同事的指导',
      '学习曲线可能存在{X}个挑战'
    ],
    data: [
      '学习时长{X}小时',
      '完成任务{X}个',
      '提问{X}次',
      '文档阅读{X}篇'
    ]
  }
};

/**
 * 生成随机数
 */
function randomCount(min: number = 1, max: number = 5): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 填充模板中的占位符
 */
function fillTemplate(template: string, role: RoleType): string {
  const roleTemplate = WEEKLY_TEMPLATES[role] || WEEKLY_TEMPLATES.boss;

  return template.replace(/{X}/g, () => randomCount().toString());
}

/**
 * 生成完整周报
 */
export function generateWeeklyReport(options: WeeklyReportOptions): string {
  const role = options.role || 'boss';
  const week = options.week || getWeekNumber(new Date());
  const roleTemplate = WEEKLY_TEMPLATES[role];

  // 生成内容
  const highlightsCount = randomCount(3, 5);
  const plansCount = randomCount(2, 4);
  const risksCount = randomCount(1, 2);

  const highlights: string[] = [];
  const plans: string[] = [];
  const risks: string[] = [];
  const data: string[] = [];

  for (let i = 0; i < highlightsCount; i++) {
    const template = roleTemplate.highlights[i % roleTemplate.highlights.length];
    highlights.push(`  ${['一', '二', '三', '四', '五'][i]}、${fillTemplate(template, role)}`);
  }

  for (let i = 0; i < plansCount; i++) {
    const template = roleTemplate.plans[i % roleTemplate.plans.length];
    plans.push(`  ${['一', '二', '三', '四'][i]}、${fillTemplate(template, role)}`);
  }

  for (let i = 0; i < risksCount; i++) {
    const template = roleTemplate.risks[i % roleTemplate.risks.length];
    risks.push(`  ${['一', '二'][i]}、${fillTemplate(template, role)}`);
  }

  // 生成数据部分（如果模板有）
  if (roleTemplate.data) {
    for (let i = 0; i < roleTemplate.data.length; i++) {
      const template = roleTemplate.data[i];
      data.push(`  • ${fillTemplate(template, role)}`);
    }
  }

  // 组装报告
  const roleNames = {
    boss: '老板',
    employee: '员工',
    pm: '产品经理',
    hr: 'HR',
    techlead: '技术主管',
    intern: '实习生'
  };

  const report: string[] = [];
  report.push(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
  report.push(chalk.cyan('║') + chalk.bold.white(`              周报生成器 - ${roleNames[role]}                 `) + chalk.cyan('║'));
  report.push(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
  report.push(chalk.cyan('║') + `  第 ${week} 周                                                  ` + chalk.cyan('║'));
  report.push(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));

  // 本周工作
  report.push(chalk.cyan('║') + '  ' + chalk.bold.green('本周工作:') + '                                               '.padEnd(38) + chalk.cyan('║'));
  report.push(chalk.cyan('║'));
  highlights.forEach(h => report.push(chalk.cyan('║') + h.padEnd(68) + chalk.cyan('║')));
  report.push(chalk.cyan('║'));

  // 下周计划
  report.push(chalk.cyan('║') + '  ' + chalk.bold.yellow('下周计划:') + '                                               '.padEnd(38) + chalk.cyan('║'));
  report.push(chalk.cyan('║'));
  plans.forEach(p => report.push(chalk.cyan('║') + p.padEnd(68) + chalk.cyan('║')));
  report.push(chalk.cyan('║'));

  // 风险与问题
  if (risks.length > 0) {
    report.push(chalk.cyan('║') + '  ' + chalk.bold.red('风险与问题:') + '                                             '.padEnd(38) + chalk.cyan('║'));
    report.push(chalk.cyan('║'));
    risks.forEach(r => report.push(chalk.cyan('║') + r.padEnd(68) + chalk.cyan('║')));
    report.push(chalk.cyan('║'));
  }

  // 数据统计（如果有）
  if (data.length > 0) {
    report.push(chalk.cyan('║') + '  ' + chalk.bold.blue('数据统计:') + '                                               '.padEnd(38) + chalk.cyan('║'));
    report.push(chalk.cyan('║'));
    data.forEach(d => report.push(chalk.cyan('║') + d.padEnd(68) + chalk.cyan('║')));
    report.push(chalk.cyan('║'));
  }

  report.push(chalk.cyan('╚══════════════════════════════════════════════════════════════════╝'));

  return report.join('\n');
}

/**
 * 周报生成器命令
 */
export function createWeeklyCommand(): Command {
  const command = new Command('weekly')
    .description('周报生成器 - 根据角色自动生成职场周报')
    .option('-r, --role <role>', '角色: boss, employee, pm, hr, techlead, intern', 'boss')
    .option('-w, --week <number>', '周数（默认当前周）')
    .option('-H, --highlights <number>', '亮点数量（默认随机3-5个）')
    .option('-o, --output <file>', '输出到文件（可选）');

  command.action(async (options) => {
    const role = options.role || 'boss' as RoleType;
    const week = options.week ? parseInt(options.week) : getWeekNumber(new Date());

    const report = generateWeeklyReport({
      role,
      week,
      highlights: options.highlights
    });

    console.log();
    console.log(report);
    console.log();

    if (options.output) {
      const { writeFile } = require('fs').promises;
      const { join } = require('path');

      const outputPath = join(process.cwd(), options.output);
      await writeFile(outputPath, report.replace(/[\u001b-\u001b-\u001c-\u001d-\u001e-\u001f]/g, ''), 'utf-8');
      console.log(chalk.green('✓') + ' 周报已保存到: ' + outputPath);
    }
  });

  return command;
}
