import { Message } from '../llm/base';

export interface SessionHistory {
  messages: Message[];
  createdAt: Date;
  lastUpdatedAt: Date;
}

export class SessionManager {
  private sessions: Map<string, SessionHistory> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create a new session
   */
  createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      messages: [],
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    });
    this.currentSessionId = sessionId;
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionHistory | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * Add a message to current session
   */
  addMessage(message: Message): void {
    const session = this.getCurrentSession();
    if (session) {
      session.messages.push(message);
      session.lastUpdatedAt = new Date();
    }
  }

  /**
   * Get messages from current session
   */
  getMessages(): Message[] {
    const session = this.getCurrentSession();
    return session ? session.messages : [];
  }

  /**
   * Clear current session messages
   */
  clearCurrentSession(): void {
    const session = this.getCurrentSession();
    if (session) {
      session.messages = [];
      session.lastUpdatedAt = new Date();
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Get session info as string
   */
  getSessionInfo(): string {
    const session = this.getCurrentSession();
    if (!session) {
      return '当前没有活动会话';
    }

    const userMessages = session.messages.filter(m => m.role === 'user').length;
    const assistantMessages = session.messages.filter(m => m.role === 'assistant').length;
    const systemMessages = session.messages.filter(m => m.role === 'system').length;

    return `会话信息:
  创建时间: ${session.createdAt.toLocaleString('zh-CN')}
  最后更新: ${session.lastUpdatedAt.toLocaleString('zh-CN')}
  消息统计:
    - 用户消息: ${userMessages} 条
    - 助手回复: ${assistantMessages} 条
    - 系统消息: ${systemMessages} 条
    - 总计: ${session.messages.length} 条`;
  }

  /**
   * Get formatted history for display
   */
  getFormattedHistory(): string {
    const session = this.getCurrentSession();
    if (!session || session.messages.length === 0) {
      return '会话历史为空';
    }

    const lines: string[] = ['\n━━━━━━━━━━━━━━━━━━ 会话历史 ━━━━━━━━━━━━━━━━━━'];

    for (const msg of session.messages) {
      if (msg.role === 'system') continue; // Skip system messages

      const label = msg.role === 'user' ? '你' : 'AI';
      const prefix = msg.role === 'user' ? '>' : '<';
      lines.push(`\n${prefix} ${label}: ${msg.content}`);
    }

    lines.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return lines.join('');
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
    } else {
      throw new Error(`Session ${sessionId} not found`);
    }
  }

  /**
   * Check if current session has messages
   */
  hasMessages(): boolean {
    const session = this.getCurrentSession();
    return session ? session.messages.length > 0 : false;
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();
