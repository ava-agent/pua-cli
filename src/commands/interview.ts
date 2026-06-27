/**
 * 压力面试命令 - 10 轮问答制
 * 用户扮演候选人，面对 2-4 个刁钻面试官
 * 压力值到 100% 游戏结束
 */

import readline from 'readline';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { getProviderBaseUrl, loadConfig } from '../config/settings';
import type { RoleType } from '../prompts/index';
import { ROLE_EMOJIS } from '../prompts/index';
import {
  INTERVIEWER_NAMES,
  INTERVIEWER_TITLES,
  INTERVIEWER_TAGS,
  POSITION_NAMES,
  INTERVIEW_EVENTS,
  getInterviewPrompt,
  getInterviewEnding,
  getInterviewerName,
  getInterviewerTitle,
  analyzeAnswer,
  analyzeInterviewerMood,
  type InterviewerRole,
  type InterviewPosition,
  type InterviewSeverity,
  type CustomInterviewer,
  type CandidateProfile,
} from '../prompts/interview-prompts';
import { logger } from '../utils/logger';
import { parseResumePDF, extractProfileFromResume } from '../utils/resume-parser';

interface InterviewState {
  interviewers: InterviewerRole[];
  position: InterviewPosition;
  severity: InterviewSeverity;
  stress: number;      // 0-100
  confidence: number;  // 0-100
  round: number;       // current round (1-based)
  totalRounds: number; // 10
  messages: Array<{ role: InterviewerRole | 'user'; name: string; content: string }>;
  finished: boolean;
  customInterviewers: CustomInterviewer[];
  candidateProfile?: CandidateProfile;
}

const INTERVIEWER_COLORS: Record<InterviewerRole, (text: string) => string> = {
  techlead: chalk.blue,
  boss: chalk.red,
  hr: chalk.magenta,
  pm: chalk.cyan,
};

const INTERVIEWER_EMOJIS: Record<InterviewerRole, string> = {
  techlead: '💻',
  boss: '👔',
  hr: '💼',
  pm: '📊',
};

const MOOD_EMOJIS: Record<string, string> = {
  sarcastic: '😏',
  pressing: '🤨',
  neutral: '😐',
  cold: '🥶',
};

const QUALITY_LABELS: Record<string, string> = {
  weak: chalk.red('弱'),
  normal: chalk.yellow('一般'),
  strong: chalk.green('强'),
};

const MAX_ANSWER_LENGTH = 500;
const FORBIDDEN_WORDS = ['<script>', 'javascript:', 'onerror=', 'onload=', 'eval(', 'document.cookie'];

/**
 * 分析面试官情绪标签
 */
function getInterviewerMood(content: string): string {
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

/**
 * 验证用户输入
 */
function validateAnswer(input: string): { valid: boolean; error?: string } {
  if (input.length > MAX_ANSWER_LENGTH) {
    return { valid: false, error: `回答太长了（最多 ${MAX_ANSWER_LENGTH} 字）` };
  }
  const lower = input.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lower.includes(word)) {
      return { valid: false, error: '输入包含不安全的内容' };
    }
  }
  return { valid: true };
}

/**
 * 渲染压力条和自信条
 */
function renderStatusBar(state: InterviewState): void {
  const stressBar = renderBar(state.stress, 100, 16, 'red');
  const confBar = renderBar(state.confidence, 100, 16, 'green');

  console.log();
  console.log(chalk.cyan.bold('╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║') + chalk.white.bold(`  🎯 压力面试 - 第 ${state.round}/${state.totalRounds} 轮`) + ' '.repeat(Math.max(0, 18 - String(state.round).length - String(state.totalRounds).length)) + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╠══════════════════════════════════════╣'));
  console.log(chalk.cyan.bold('║') + `  压力: ${stressBar} ${String(state.stress).padStart(3)}%` + '       ' + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('║') + `  自信: ${confBar} ${String(state.confidence).padStart(3)}%` + '       ' + chalk.cyan.bold('║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝'));
  console.log();
}

function renderBar(value: number, max: number, width: number, color: string): string {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  const colorFn = color === 'red' ? chalk.red : chalk.green;
  return '[' + colorFn('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ']';
}

/**
 * 渲染面试官消息
 */
function renderInterviewerMessage(role: InterviewerRole, content: string, mood?: string, customInterviewers?: CustomInterviewer[]): void {
  const builtinEmoji = INTERVIEWER_EMOJIS[role as keyof typeof INTERVIEWER_EMOJIS];
  const custom = customInterviewers?.find(c => c.id === role);
  const emoji = builtinEmoji || custom?.emoji || '🎤';
  const name = getInterviewerName(role, customInterviewers);
  const title = getInterviewerTitle(role, customInterviewers);
  const colorFn = INTERVIEWER_COLORS[role as keyof typeof INTERVIEWER_COLORS] || chalk.white;
  const moodEmoji = mood ? (MOOD_EMOJIS[mood] || '') : '';

  const header = `${emoji} ${name} (${title})${moodEmoji ? ' ' + moodEmoji : ''}`;
  const width = 50;
  const topLine = colorFn(`┌─ ${header} ${'─'.repeat(Math.max(0, width - header.length - 4))}┐`);
  const bottomLine = colorFn(`└${'─'.repeat(width - 1)}┘`);

  const maxContentWidth = width - 4;
  const lines = wrapText(content, maxContentWidth);

  console.log(topLine);
  for (const line of lines) {
    console.log(colorFn('│') + ` ${line.padEnd(maxContentWidth + 1)}` + colorFn('│'));
  }
  console.log(bottomLine);
  console.log();
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > maxWidth) {
    let breakIdx = remaining.lastIndexOf(' ', maxWidth);
    if (breakIdx <= 0) breakIdx = maxWidth;
    lines.push(remaining.slice(0, breakIdx));
    remaining = remaining.slice(breakIdx).trimStart();
  }

  if (remaining.length > 0) {
    lines.push(remaining);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * 渲染事件
 */
function renderEvent(text: string): void {
  console.log(chalk.gray(`  ── ${text} ──`));
  console.log();
}

/**
 * 渲染结局
 */
function renderEnding(state: InterviewState): void {
  const ending = getInterviewEnding(state.stress, state.confidence, state.round);

  console.log();
  console.log(chalk.yellow.bold('╔════════════════════════════════════════╗'));
  console.log(chalk.yellow.bold('║') + `      ${ending.emoji} ${chalk.white.bold(ending.title)}` + ' '.repeat(Math.max(0, 28 - ending.title.length)) + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('╠════════════════════════════════════════╣'));
  console.log(chalk.yellow.bold('║') + '                                        ' + chalk.yellow.bold('║'));

  // Wrap description
  const descLines = wrapText(ending.description, 36);
  for (const line of descLines) {
    console.log(chalk.yellow.bold('║') + `  ${line.padEnd(38)}` + chalk.yellow.bold('║'));
  }

  console.log(chalk.yellow.bold('║') + '                                        ' + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  最终压力: ${chalk.red(String(state.stress) + '%')}`.padEnd(49) + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  最终自信: ${chalk.green(String(state.confidence) + '%')}`.padEnd(49) + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  坚持轮次: ${state.round}/${state.totalRounds}`.padEnd(38) + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + '                                        ' + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('╚════════════════════════════════════════╝'));
  console.log();
}

/**
 * 清理 AI 回复 - 去除叙述格式、嵌套引用、角色名前缀
 */
function cleanInterviewResponse(raw: string, currentRole: InterviewerRole, customInterviewers?: CustomInterviewer[]): string {
  let cleaned = raw.trim();

  const builtinNames = Object.values(INTERVIEWER_NAMES);
  const customNames = customInterviewers?.map(c => c.name) || [];
  const allNames = [...builtinNames, ...customNames];

  // 去除嵌套的叙述格式 （名字说："..."） - 循环剥离多层
  for (let i = 0; i < 5; i++) {
    let changed = false;
    for (const name of allNames) {
      const narrativePattern = new RegExp(`[（(]${name}说[：:]\\s*[""\u201C](.+?)[""\u201D][）)]`, 'gs');
      const newCleaned = cleaned.replace(narrativePattern, '$1');
      if (newCleaned !== cleaned) { cleaned = newCleaned; changed = true; }
    }
    const genericPattern = /[（(](?:面试官|其他面试官的发言)[：:]?\s*[""\u201C]?(.+?)[""\u201D]?[）)]/gs;
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
  const currentName = getInterviewerName(currentRole, customInterviewers);
  for (const name of allNames) {
    if (name === currentName) continue;
    cleaned = cleaned.replace(new RegExp(`\\s*\\[${name}\\][:：][^\\n]*`, 'g'), '');
  }

  cleaned = cleaned.replace(/^["「""\u201C](.+)["」""\u201D]$/, '$1');
  cleaned = cleaned.trim();

  if (cleaned.length < 2 || cleaned === '...' || cleaned === '……') {
    return '这个问题你再想想。';
  }

  return cleaned;
}

/**
 * 选择本轮提问的面试官（1-2人）
 */
function selectInterviewers(
  interviewers: InterviewerRole[],
  round: number,
  severity: InterviewSeverity
): InterviewerRole[] {
  // 第一轮：所有面试官轮流自我介绍式提问，取第一个
  if (round === 1) {
    return [interviewers[0]];
  }

  // 高混乱度更可能多人追问
  const count = severity >= 3 ? Math.min(2, interviewers.length) : 1;

  // 轮流 + 随机
  const baseIndex = (round - 1) % interviewers.length;
  const result = [interviewers[baseIndex]];

  if (count > 1 && interviewers.length > 1) {
    const others = interviewers.filter((_, i) => i !== baseIndex);
    result.push(others[Math.floor(Math.random() * others.length)]);
  }

  return result;
}

export function createInterviewCommand(): Command {
  const command = new Command('interview')
    .description('压力面试 - 10轮问答制，挺住压力拿到Offer')
    .option('-p, --provider <ark|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称')
    .option('--resume <path>', '简历PDF路径，解析后定制面试内容');

  command.action(async (options) => {
    try {
      const { checkbox, select } = await import('@inquirer/prompts');

      console.log();
      console.log(chalk.red.bold('🎯 压力面试'));
      console.log(chalk.gray('你是候选人，面对刁钻面试官的连环追问'));
      console.log(chalk.gray('坚持 10 轮，控制压力值，争取拿到 Offer！'));
      console.log();

      // Step 1: Select position
      const position = await select({
        message: '选择面试岗位',
        choices: Object.entries(POSITION_NAMES).map(([value, name]) => ({
          name,
          value,
        })),
      }) as InterviewPosition;

      // Step 2: Ask if user wants custom interviewers
      const customInterviewers: CustomInterviewer[] = [];
      const wantCustom = await select({
        message: '是否添加自定义面试官？',
        choices: [
          { name: '不需要，使用内置面试官', value: 'no' },
          { name: '添加自定义面试官', value: 'yes' },
        ],
      });

      if (wantCustom === 'yes') {
        const { input: inputPrompt } = await import('@inquirer/prompts');
        let addMore = true;
        let customCount = 0;
        while (addMore && customCount < 2) {
          const cName = await inputPrompt({ message: '面试官名字（如：王总）' });
          const cTitle = await inputPrompt({ message: '面试官职位（如：投资总监）' });
          const cPersonality = await inputPrompt({ message: '性格描述（如：质疑商业模式、追问数据、不相信PPT）' });
          const cTags = await inputPrompt({ message: '标签（如：追问数据 / 质疑可行性）' });

          customInterviewers.push({
            id: `custom_${customCount + 1}`,
            name: cName.trim(),
            title: cTitle.trim(),
            personality: cPersonality.trim(),
            tags: cTags.trim(),
            emoji: '🎤',
          });
          customCount++;

          if (customCount < 2) {
            const more = await select({
              message: '继续添加自定义面试官？',
              choices: [
                { name: '不了', value: 'no' },
                { name: '再加一个', value: 'yes' },
              ],
            });
            addMore = more === 'yes';
          }
        }
      }

      // Step 3: Select interviewers (built-in + custom)
      const builtinChoices = (['techlead', 'boss', 'hr', 'pm'] as InterviewerRole[]).map(role => ({
        name: `${INTERVIEWER_EMOJIS[role]} ${INTERVIEWER_NAMES[role]} (${INTERVIEWER_TITLES[role]}) - ${INTERVIEWER_TAGS[role]}`,
        value: role,
      }));
      const customChoices = customInterviewers.map(c => ({
        name: `🎤 ${c.name} (${c.title}) - ${c.tags}`,
        value: c.id,
      }));

      const interviewers = await checkbox({
        message: '选择面试官（空格选择，2-4 人）',
        choices: [...builtinChoices, ...customChoices],
      }) as InterviewerRole[];

      if (interviewers.length < 2) {
        logger.error('至少需要选择 2 个面试官');
        return;
      }
      if (interviewers.length > 4) {
        logger.error('最多选择 4 个面试官');
        return;
      }

      // Step 4: Select severity
      const severity = await select({
        message: '选择 PUA 强度',
        choices: [
          { name: '🟢 友好 - 偶尔施压，总体友好', value: 1 },
          { name: '🟡 标准 - 刁钻追问，不给喘息', value: 2 },
          { name: '🔴 地狱 - 连珠炮追问，冷嘲热讽', value: 3 },
        ],
      }) as InterviewSeverity;

      // Step 5: Optional candidate profile (from resume or manual input)
      let candidateProfile: CandidateProfile | undefined;

      // Check if --resume flag was provided
      if (options.resume) {
        const resumeSpinner = ora({ text: '正在解析简历...', spinner: 'dots' }).start();
        try {
          const resumeText = await parseResumePDF(options.resume);
          candidateProfile = extractProfileFromResume(resumeText);
          resumeSpinner.succeed('简历解析成功！');

          // Show extracted info
          console.log(chalk.gray('  提取到的信息:'));
          if (candidateProfile.name) console.log(chalk.gray(`    姓名: ${candidateProfile.name}`));
          if (candidateProfile.experience) console.log(chalk.gray(`    工作年限: ${candidateProfile.experience} 年`));
          if (candidateProfile.techStack) console.log(chalk.gray(`    技术栈: ${candidateProfile.techStack}`));
          if (candidateProfile.targetSalary) console.log(chalk.gray(`    期望薪资: ${candidateProfile.targetSalary}`));
          if (candidateProfile.background) console.log(chalk.gray(`    背景: ${candidateProfile.background}`));
          console.log();
        } catch (err) {
          resumeSpinner.fail(`简历解析失败: ${err instanceof Error ? err.message : String(err)}`);
          console.log(chalk.gray('  将使用手动输入模式'));
          console.log();
        }
      }

      // If no resume or resume parsing failed, offer manual input
      if (!candidateProfile) {
        const wantProfile = await select({
          message: '是否填写候选人信息？（让面试更有针对性）',
          choices: [
            { name: '跳过，直接开始', value: 'no' },
            { name: '填写我的信息', value: 'yes' },
          ],
        });

        if (wantProfile === 'yes') {
          const { input: inputPrompt } = await import('@inquirer/prompts');
          const pName = await inputPrompt({ message: '你的名字（可选，直接回车跳过）', default: '' });
          const pExp = await inputPrompt({ message: '工作年限（如：3）', default: '' });
          const pStack = await inputPrompt({ message: '技术栈（如：React, TypeScript, Node.js）', default: '' });
          const pSalary = await inputPrompt({ message: '期望薪资（如：25k-30k）', default: '' });
          const pBg = await inputPrompt({ message: '简要背景（如：985本科，3年大厂经验）', default: '' });

          candidateProfile = {
            ...(pName ? { name: pName } : {}),
            ...(pExp ? { experience: parseInt(pExp) || undefined } : {}),
            ...(pStack ? { techStack: pStack } : {}),
            ...(pSalary ? { targetSalary: pSalary } : {}),
            ...(pBg ? { background: pBg } : {}),
          };
          if (Object.keys(candidateProfile).length === 0) {
            candidateProfile = undefined;
          }
        }
      }

      // Load config
      const config = loadConfig(options);
      const llm = createLLM(config.provider, {
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: getProviderBaseUrl(config.provider),
      });

      // Initialize state
      const state: InterviewState = {
        interviewers,
        position,
        severity,
        stress: 20,        // 初始压力
        confidence: 60,    // 初始自信
        round: 1,
        totalRounds: 10,
        messages: [],
        finished: false,
        customInterviewers,
        candidateProfile,
      };

      // Print interview header
      const positionName = POSITION_NAMES[position];
      const interviewerNames = interviewers.map(r => {
        const builtinEmoji = INTERVIEWER_EMOJIS[r as keyof typeof INTERVIEWER_EMOJIS];
        const custom = customInterviewers.find(c => c.id === r);
        const emoji = builtinEmoji || custom?.emoji || '🎤';
        const name = getInterviewerName(r, customInterviewers);
        return `${emoji} ${name}`;
      }).join('  ');
      const severityLabels: Record<number, string> = { 1: '友好', 2: '标准', 3: '地狱' };

      console.log();
      console.log(chalk.red.bold('╔══════════════════════════════════════════════════╗'));
      console.log(chalk.red.bold('║') + chalk.white.bold(`       🎯 ${positionName}岗位 - 压力面试开始！`) + ' '.repeat(Math.max(0, 14 - positionName.length)) + chalk.red.bold('║'));
      console.log(chalk.red.bold('╠══════════════════════════════════════════════════╣'));
      console.log(chalk.red.bold('║') + `  面试官: ${interviewerNames}`);
      console.log(chalk.red.bold('║') + `  强度: ${severityLabels[severity]}  |  回合: 10 轮`);
      console.log(chalk.red.bold('╚══════════════════════════════════════════════════╝'));
      console.log();
      console.log(chalk.gray('输入回答面试官的问题。支持: /quit 放弃 | /status 查看状态'));
      console.log();

      // Show initial status
      renderStatusBar(state);

      // First round: interviewer asks opening question
      const spinner = ora({ text: '面试官正在思考问题...', spinner: 'dots' }).start();

      const openingInterviewer = interviewers[0];
      const openingPrompt = getInterviewPrompt(
        openingInterviewer, position, severity,
        state.round, state.totalRounds, state.stress, interviewers,
        customInterviewers, candidateProfile
      );

      try {
        const openingMsg = await llm.chat([
          { role: 'system', content: openingPrompt },
          { role: 'user', content: `（这是面试的第一轮。请向候选人提出第一个问题。候选人面试的是${positionName}岗位。）` },
        ]);
        spinner.stop();

        const cleaned = cleanInterviewResponse(openingMsg, openingInterviewer, customInterviewers);
        const mood = getInterviewerMood(cleaned);
        renderInterviewerMessage(openingInterviewer, cleaned, mood, customInterviewers);
        state.messages.push({ role: openingInterviewer, name: getInterviewerName(openingInterviewer, customInterviewers), content: cleaned });
      } catch {
        spinner.stop();
        const fallback = '请先做个自我介绍吧。';
        renderInterviewerMessage(openingInterviewer, fallback, 'cold', customInterviewers);
        state.messages.push({ role: openingInterviewer, name: getInterviewerName(openingInterviewer, customInterviewers), content: fallback });
      }

      // Start interactive loop
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('你 ❯ '),
      });

      rl.prompt();

      rl.on('line', async (input) => {
        const trimmed = input.trim();
        if (!trimmed) { rl.prompt(); return; }

        // Handle commands
        if (trimmed === '/quit' || trimmed === '/exit') {
          state.finished = true;
          renderEnding(state);
          rl.close();
          return;
        }
        if (trimmed === '/status') {
          renderStatusBar(state);
          rl.prompt();
          return;
        }
        if (trimmed === '/help') {
          console.log();
          console.log(chalk.bold('面试命令:'));
          console.log(chalk.gray('─').repeat(40));
          console.log('  /status    查看压力/自信状态');
          console.log('  /quit      放弃面试');
          console.log();
          rl.prompt();
          return;
        }

        // Validate input
        const validation = validateAnswer(trimmed);
        if (!validation.valid) {
          console.log(chalk.red(`  ⚠ ${validation.error}`));
          rl.prompt();
          return;
        }

        // Add user answer
        state.messages.push({ role: 'user', name: '你', content: trimmed });

        // Analyze answer quality
        const analysis = analyzeAnswer(trimmed);
        state.stress = Math.max(0, Math.min(100, state.stress + analysis.stressChange));
        state.confidence = Math.max(0, Math.min(100, state.confidence + analysis.confidenceChange));

        // Show answer quality badge
        const qualityLabel = QUALITY_LABELS[analysis.quality] || analysis.quality;
        console.log(chalk.gray(`  回答质量: ${qualityLabel}  |  压力 ${analysis.stressChange >= 0 ? '+' : ''}${analysis.stressChange}  自信 ${analysis.confidenceChange >= 0 ? '+' : ''}${analysis.confidenceChange}`));

        // Check if stress hit 100
        if (state.stress >= 100) {
          state.finished = true;
          renderEnding(state);
          rl.close();
          return;
        }

        // Maybe trigger random event
        if (Math.random() < 0.15) {
          const event = INTERVIEW_EVENTS[Math.floor(Math.random() * INTERVIEW_EVENTS.length)];
          renderEvent(event.text);
          state.stress = Math.max(0, Math.min(100, state.stress + event.stressChange));
          state.confidence = Math.max(0, Math.min(100, state.confidence + event.confidenceChange));

          if (state.stress >= 100) {
            state.finished = true;
            renderEnding(state);
            rl.close();
            return;
          }
        }

        // Select which interviewers respond this round
        state.round++;
        const respondents = selectInterviewers(interviewers, state.round, severity);

        // Build context
        const historyMessages = state.messages.slice(-8).map(m => ({
          role: 'user' as const,
          content: m.role === 'user' ? m.content : `（${m.name}说："${m.content}"）`,
        }));

        const interviewSpinner = ora({ text: '面试官正在思考...', spinner: 'dots' }).start();

        const respondentResults: Array<{ role: InterviewerRole; name: string; content: string; mood?: string }> = [];

        for (const role of respondents) {
          const systemPrompt = getInterviewPrompt(
            role, position, severity,
            state.round, state.totalRounds, state.stress, interviewers,
            state.customInterviewers, state.candidateProfile
          );

          const prevSpeech = respondentResults.map(r => `${r.name}说："${r.content}"`).join('\n');
          const contextWithPrev = [
            ...historyMessages,
            ...(prevSpeech ? [{ role: 'user' as const, content: `（其他面试官的发言：\n${prevSpeech}）` }] : []),
          ];

          const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...contextWithPrev,
          ];

          try {
            const rawReply = await llm.chat(messages);
            const reply = cleanInterviewResponse(rawReply, role, state.customInterviewers);

            // Interviewer mood affects stress
            const mood = getInterviewerMood(reply);
            const moodStress = analyzeInterviewerMood(reply);
            state.stress = Math.max(0, Math.min(100, state.stress + moodStress));

            respondentResults.push({
              role,
              name: getInterviewerName(role, state.customInterviewers),
              content: reply,
              mood,
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            // Content filter fallback
            if (errMsg.includes('sensitive') || errMsg.includes('content') || errMsg.includes('400')) {
              const fallbackContent = '请注意你的措辞，我们是正式面试。回到正题吧。';
              respondentResults.push({
                role,
                name: getInterviewerName(role, state.customInterviewers),
                content: fallbackContent,
                mood: 'cold',
              });
            } else {
              logger.warning(`${INTERVIEWER_NAMES[role]} 回复失败`);
            }
          }
        }

        interviewSpinner.stop();

        if (respondentResults.length === 0) {
          console.log(chalk.red('  面试官暂时没有回应，请检查 API 配置'));
        } else {
          // Show updated status
          renderStatusBar(state);

          for (const result of respondentResults) {
            renderInterviewerMessage(result.role, result.content, result.mood, state.customInterviewers);
            state.messages.push({
              role: result.role,
              name: result.name,
              content: result.content,
            });
          }
        }

        // Check end conditions
        if (state.stress >= 100 || state.round >= state.totalRounds) {
          state.finished = true;
          renderEnding(state);
          rl.close();
          return;
        }

        rl.prompt();
      });

      rl.on('close', () => {
        if (!state.finished) {
          renderEnding(state);
        }
        console.log();
        logger.info('面试结束，再见！');
        process.exit(0);
      });

    } catch (error) {
      if ((error as Error).message?.includes('cancelled') || (error as Error).message?.includes('User force closed')) {
        console.log();
        logger.info('已取消');
        return;
      }
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

  return command;
}
