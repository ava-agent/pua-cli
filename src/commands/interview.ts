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
  analyzeAnswer,
  analyzeInterviewerMood,
  type InterviewerRole,
  type InterviewPosition,
  type InterviewSeverity,
} from '../prompts/interview-prompts';
import { logger } from '../utils/logger';

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
function renderInterviewerMessage(role: InterviewerRole, content: string): void {
  const emoji = INTERVIEWER_EMOJIS[role];
  const name = INTERVIEWER_NAMES[role];
  const title = INTERVIEWER_TITLES[role];
  const colorFn = INTERVIEWER_COLORS[role];

  const header = `${emoji} ${name} (${title})`;
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
function cleanInterviewResponse(raw: string, currentRole: InterviewerRole): string {
  let cleaned = raw.trim();

  const allNames = Object.values(INTERVIEWER_NAMES);

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
  for (const name of allNames) {
    if (name === INTERVIEWER_NAMES[currentRole]) continue;
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
    .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称');

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

      // Step 2: Select interviewers
      const interviewers = await checkbox({
        message: '选择面试官（空格选择，2-4 人）',
        choices: (['techlead', 'boss', 'hr', 'pm'] as InterviewerRole[]).map(role => ({
          name: `${INTERVIEWER_EMOJIS[role]} ${INTERVIEWER_NAMES[role]} (${INTERVIEWER_TITLES[role]}) - ${INTERVIEWER_TAGS[role]}`,
          value: role,
        })),
      }) as InterviewerRole[];

      if (interviewers.length < 2) {
        logger.error('至少需要选择 2 个面试官');
        return;
      }
      if (interviewers.length > 4) {
        logger.error('最多选择 4 个面试官');
        return;
      }

      // Step 3: Select severity
      const severity = await select({
        message: '选择 PUA 强度',
        choices: [
          { name: '🟢 友好 - 偶尔施压，总体友好', value: 1 },
          { name: '🟡 标准 - 刁钻追问，不给喘息', value: 2 },
          { name: '🔴 地狱 - 连珠炮追问，冷嘲热讽', value: 3 },
        ],
      }) as InterviewSeverity;

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
      };

      // Print interview header
      const positionName = POSITION_NAMES[position];
      const interviewerNames = interviewers.map(r => `${INTERVIEWER_EMOJIS[r]} ${INTERVIEWER_NAMES[r]}`).join('  ');
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
        state.round, state.totalRounds, state.stress, interviewers
      );

      try {
        const openingMsg = await llm.chat([
          { role: 'system', content: openingPrompt },
          { role: 'user', content: `（这是面试的第一轮。请向候选人提出第一个问题。候选人面试的是${positionName}岗位。）` },
        ]);
        spinner.stop();

        const cleaned = cleanInterviewResponse(openingMsg, openingInterviewer);
        renderInterviewerMessage(openingInterviewer, cleaned);
        state.messages.push({ role: openingInterviewer, name: INTERVIEWER_NAMES[openingInterviewer], content: cleaned });
      } catch {
        spinner.stop();
        renderInterviewerMessage(openingInterviewer, '请先做个自我介绍吧。');
        state.messages.push({ role: openingInterviewer, name: INTERVIEWER_NAMES[openingInterviewer], content: '请先做个自我介绍吧。' });
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

        // Add user answer
        state.messages.push({ role: 'user', name: '你', content: trimmed });

        // Analyze answer quality
        const analysis = analyzeAnswer(trimmed);
        state.stress = Math.max(0, Math.min(100, state.stress + analysis.stressChange));
        state.confidence = Math.max(0, Math.min(100, state.confidence + analysis.confidenceChange));

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

        const respondentResults: Array<{ role: InterviewerRole; name: string; content: string }> = [];

        for (const role of respondents) {
          const systemPrompt = getInterviewPrompt(
            role, position, severity,
            state.round, state.totalRounds, state.stress, interviewers
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
            const reply = cleanInterviewResponse(rawReply, role);

            // Interviewer mood affects stress
            const moodStress = analyzeInterviewerMood(reply);
            state.stress = Math.max(0, Math.min(100, state.stress + moodStress));

            respondentResults.push({
              role,
              name: INTERVIEWER_NAMES[role],
              content: reply,
            });
          } catch {
            logger.warning(`${INTERVIEWER_NAMES[role]} 回复失败`);
          }
        }

        interviewSpinner.stop();

        if (respondentResults.length === 0) {
          console.log(chalk.red('  面试官暂时没有回应，请检查 API 配置'));
        } else {
          // Show updated status
          renderStatusBar(state);

          for (const result of respondentResults) {
            renderInterviewerMessage(result.role, result.content);
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
