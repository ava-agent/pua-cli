/**
 * 会议室命令 - 多角色同时参会
 * 用户发言后多个角色随机搭话回复
 */

import readline from 'readline';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createLLM } from '../llm/factory';
import { getProviderBaseUrl, loadConfig } from '../config/settings';
import type { RoleType } from '../prompts/index';
import { ROLE_COLORS, ROLE_EMOJIS } from '../prompts/index';
import {
  CHARACTER_NAMES,
  CHARACTER_TITLES,
  CHARACTER_TAGS,
  MEETING_TYPE_NAMES,
  getMeetingPrompt,
  type MeetingType,
  type ChaosLevel,
} from '../prompts/meeting-prompts';
import {
  selectRespondents,
  detectMood,
  generateMeetingEvent,
  generateScoreCard,
  type MoodType,
} from '../utils/meeting-utils';
import { logger } from '../utils/logger';

interface MeetingState {
  participants: RoleType[];
  meetingType: MeetingType;
  chaosLevel: ChaosLevel;
  messages: Array<{ role: RoleType | 'user'; name: string; content: string; mood?: MoodType }>;
  lastRespondents: RoleType[];
}

const CHALK_COLORS: Record<string, (text: string) => string> = {
  red: chalk.red,
  yellow: chalk.yellow,
  cyan: chalk.cyan,
  magenta: chalk.magenta,
  blue: chalk.blue,
  green: chalk.green,
};

function getChalkColor(role: RoleType): (text: string) => string {
  return CHALK_COLORS[ROLE_COLORS[role]] || chalk.white;
}

/**
 * 渲染角色消息框
 */
function renderRoleMessage(role: RoleType, content: string): void {
  const emoji = ROLE_EMOJIS[role];
  const name = CHARACTER_NAMES[role];
  const title = CHARACTER_TITLES[role];
  const colorFn = getChalkColor(role);

  const header = `${emoji} ${name} (${title})`;
  const width = 50;
  const topLine = colorFn(`┌─ ${header} ${'─'.repeat(Math.max(0, width - header.length - 4))}┐`);
  const bottomLine = colorFn(`└${'─'.repeat(width - 1)}┘`);

  // Wrap content to fit box width
  const maxContentWidth = width - 4;
  const lines = wrapText(content, maxContentWidth);

  console.log(topLine);
  for (const line of lines) {
    console.log(colorFn('│') + ` ${line.padEnd(maxContentWidth + 1)}` + colorFn('│'));
  }
  console.log(bottomLine);
  console.log();
}

/**
 * 简单文本换行
 */
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
 * 渲染会议事件
 */
function renderEvent(text: string): void {
  console.log(chalk.gray(`  ── ${text} ──`));
  console.log();
}

/**
 * 渲染评分卡
 */
function renderScoreCard(
  messages: Array<{ role: RoleType | 'user'; name: string; content: string }>,
  participants: RoleType[]
): void {
  const card = generateScoreCard(
    messages.map(m => ({ role: m.role, content: m.content })),
    participants
  );

  const stars = '★'.repeat(card.rating) + '☆'.repeat(5 - card.rating);

  console.log();
  console.log(chalk.yellow.bold('╔════════════════════════════════════╗'));
  console.log(chalk.yellow.bold('║') + '      📊 ' + chalk.white.bold('会议评分卡') + '              ' + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('╠════════════════════════════════════╣'));
  console.log(chalk.yellow.bold('║') + `  总消息数:   ${String(card.totalMessages).padEnd(20)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  画饼次数:   ${chalk.red(String(card.cakePaintCount) + '次').padEnd(29)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  黑话密度:   ${chalk.cyan(card.jargonDensity + '%').padEnd(29)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  有效决策:   ${chalk.green(card.effectiveDecisions + '个').padEnd(29)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  打断次数:   ${String(card.interruptCount + '次').padEnd(20)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  最活跃:     ${card.topContributor.padEnd(20)}` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + '                                    ' + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `         ${stars}              ` + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + '                                    ' + chalk.yellow.bold('║'));
  console.log(chalk.yellow.bold('║') + `  "${chalk.gray(card.summary)}"` + chalk.yellow.bold(''));
  console.log(chalk.yellow.bold('╚════════════════════════════════════╝'));

  if (card.goldQuote) {
    console.log();
    console.log(chalk.yellow('💎 金句: ') + chalk.gray(card.goldQuote));
  }
  console.log();
}

/**
 * 渲染会议纪要
 */
function renderMinutes(
  state: MeetingState
): void {
  const meetingName = MEETING_TYPE_NAMES[state.meetingType];
  const participantNames = state.participants.map(r => `${CHARACTER_NAMES[r]}(${CHARACTER_TITLES[r]})`).join('、');

  console.log();
  console.log(chalk.cyan.bold('══════════════════════════════════════'));
  console.log(chalk.cyan.bold('         📝 会议纪要'));
  console.log(chalk.cyan.bold('══════════════════════════════════════'));
  console.log();
  console.log(chalk.white(`会议类型: ${meetingName}`));
  console.log(chalk.white(`参会人员: ${participantNames}`));
  console.log(chalk.white(`消息总数: ${state.messages.length}`));
  console.log();
  console.log(chalk.gray('── 对话记录 ──'));
  console.log();

  for (const msg of state.messages) {
    if (msg.role === 'user') {
      console.log(chalk.green(`  [你]: ${msg.content}`));
    } else {
      const colorFn = getChalkColor(msg.role as RoleType);
      console.log(colorFn(`  [${msg.name}]: ${msg.content}`));
    }
  }

  console.log();
  console.log(chalk.cyan.bold('══════════════════════════════════════'));
  console.log();
}

/**
 * 清理 AI 回复 - 去除泄漏的上下文格式
 */
function cleanMeetingResponse(raw: string, currentRole: RoleType): string {
  let cleaned = raw.trim();

  // 去除开头的 [角色名]: 或 角色名: 格式
  const allNames = Object.values(CHARACTER_NAMES);
  for (const name of allNames) {
    cleaned = cleaned.replace(new RegExp(`^\\[${name}\\][:：]\\s*`, 'g'), '');
    cleaned = cleaned.replace(new RegExp(`^${name}[:：]\\s*`, 'g'), '');
  }

  // 去除回复中夹带的其他角色发言
  for (const name of allNames) {
    if (name === CHARACTER_NAMES[currentRole]) continue;
    cleaned = cleaned.replace(new RegExp(`\\s*\\[${name}\\][:：][^\\n]*`, 'g'), '');
  }

  // 去除多余的引号包裹
  cleaned = cleaned.replace(/^["「](.+)["」]$/, '$1');
  cleaned = cleaned.trim();

  if (cleaned.length < 2 || cleaned === '...' || cleaned === '……') {
    return '...';
  }

  return cleaned;
}

export function createMeetingRoomCommand(): Command {
  const command = new Command('meeting-room')
    .description('会议室 - 多角色同时参会的职场会议模拟')
    .option('-p, --provider <zhipu|openai>', 'AI 服务提供商')
    .option('-m, --model <model>', '模型名称');

  command.action(async (options) => {
    try {
      // Dynamic import for @inquirer/prompts (ESM)
      const { checkbox, select } = await import('@inquirer/prompts');

      // Step 1: Select participants
      console.log();
      console.log(chalk.cyan.bold('🏢 职场会议室'));
      console.log(chalk.gray('选择参会角色，开始一场充满PUA的会议'));
      console.log();

      const participants = await checkbox({
        message: '选择参会角色（空格选择，至少2人）',
        choices: (['boss', 'employee', 'pm', 'hr', 'techlead', 'intern'] as RoleType[]).map(role => ({
          name: `${ROLE_EMOJIS[role]} ${CHARACTER_NAMES[role]} (${CHARACTER_TITLES[role]}) - ${CHARACTER_TAGS[role]}`,
          value: role,
        })),
      }) as RoleType[];

      if (participants.length < 2) {
        logger.error('至少需要选择 2 个参会角色');
        return;
      }

      // Step 2: Select meeting type
      const meetingType = await select({
        message: '选择会议类型',
        choices: Object.entries(MEETING_TYPE_NAMES).map(([value, name]) => ({
          name,
          value,
        })),
      }) as MeetingType;

      // Step 3: Select chaos level
      const chaosLevel = await select({
        message: '选择混乱程度',
        choices: [
          { name: '🧊 有序 - 礼貌发言，点到为止', value: 1 },
          { name: '🔥 标准 - 正常发挥，有些冲突', value: 2 },
          { name: '💥 混乱 - 抢话打断，不留情面', value: 3 },
        ],
      }) as ChaosLevel;

      // Load config
      const config = loadConfig(options);
      const llm = createLLM(config.provider, {
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: getProviderBaseUrl(config.provider),
      });

      // Initialize state
      const state: MeetingState = {
        participants,
        meetingType,
        chaosLevel,
        messages: [],
        lastRespondents: [],
      };

      // Print meeting header
      const meetingName = MEETING_TYPE_NAMES[meetingType];
      const chaosLabels: Record<number, string> = { 1: '有序', 2: '标准', 3: '混乱' };
      const participantNames = participants.map(r => `${ROLE_EMOJIS[r]} ${CHARACTER_NAMES[r]}`).join('  ');

      console.log();
      console.log(chalk.cyan.bold('╔════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan.bold('║') + chalk.white.bold(`         🏢 ${meetingName} 开始了！               `) + chalk.cyan.bold('║'));
      console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════╣'));
      console.log(chalk.cyan.bold('║') + `  参会: ${participantNames}`);
      console.log(chalk.cyan.bold('║') + `  混乱: ${chaosLabels[chaosLevel]}  |  Provider: ${config.provider}`);
      console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════╝'));
      console.log();
      console.log(chalk.gray('输入消息开始讨论。支持: /exit 退出 | /minutes 会议纪要 | /score 评分卡'));
      console.log();

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
        if (trimmed === '/exit' || trimmed === '/quit') {
          renderScoreCard(state.messages, state.participants);
          rl.close();
          return;
        }
        if (trimmed === '/minutes') {
          renderMinutes(state);
          rl.prompt();
          return;
        }
        if (trimmed === '/score') {
          renderScoreCard(state.messages, state.participants);
          rl.prompt();
          return;
        }
        if (trimmed === '/help') {
          console.log();
          console.log(chalk.bold('会议室命令:'));
          console.log(chalk.gray('─').repeat(40));
          console.log('  /score     查看会议评分卡');
          console.log('  /minutes   查看会议纪要');
          console.log('  /exit      结束会议');
          console.log();
          rl.prompt();
          return;
        }

        // Add user message
        state.messages.push({ role: 'user', name: '你', content: trimmed });

        // Maybe trigger a random event
        const event = generateMeetingEvent(participants, 0.1);
        if (event) {
          renderEvent(event.text);
        }

        // Select respondents
        const respondents = selectRespondents(
          participants,
          trimmed,
          chaosLevel,
          state.lastRespondents
        );

        // Build context for LLM calls
        const historyMessages = state.messages.slice(-8).map(m => ({
          role: 'user' as const,
          content: m.role === 'user' ? m.content : `（${m.name}说："${m.content}"）`,
        }));

        const spinner = ora({ text: '角色们在讨论...', spinner: 'dots' }).start();

        const respondentResults: Array<{ role: RoleType; name: string; content: string }> = [];

        for (const role of respondents) {
          const systemPrompt = getMeetingPrompt(role, meetingType, chaosLevel, participants);

          // Include previous respondents' messages in context (narrative format)
          const prevSpeech = respondentResults.map(r => `${r.name}说："${r.content}"`).join('\n');
          const contextWithPrev = [
            ...historyMessages,
            ...(prevSpeech ? [{ role: 'user' as const, content: `（会议中其他人的发言：\n${prevSpeech}）` }] : []),
          ];

          const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...contextWithPrev,
          ];

          try {
            const rawReply = await llm.chat(messages);
            const reply = cleanMeetingResponse(rawReply, role);
            respondentResults.push({
              role,
              name: CHARACTER_NAMES[role],
              content: reply,
            });
          } catch (err) {
            // Skip failed roles
            logger.warning(`${CHARACTER_NAMES[role]} 回复失败`);
          }
        }

        spinner.stop();

        if (respondentResults.length === 0) {
          console.log(chalk.red('  所有角色都没有回复，请检查 API 配置'));
        } else {
          // Render each response
          for (const result of respondentResults) {
            renderRoleMessage(result.role, result.content);

            const mood = detectMood(result.content);
            state.messages.push({
              role: result.role,
              name: result.name,
              content: result.content,
              mood,
            });
          }

          state.lastRespondents = respondentResults.map(r => r.role);
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log();
        logger.info('会议结束，再见！');
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
