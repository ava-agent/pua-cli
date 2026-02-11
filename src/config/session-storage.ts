import path from 'path';
import fs from 'fs';
import os from 'os';

export interface SessionData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{ role: string; content: string }>;
  metadata?: {
    role?: string;
    severity?: string;
    provider?: string;
    model?: string;
  };
}

export class SessionStorage {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = path.join(os.homedir(), '.pua-cli', 'sessions');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  listSessions(): SessionData[] {
    const files = fs.readdirSync(this.sessionsDir)
      .filter(f => f.endsWith('.json'));

    return files.map(file => {
      const filePath = path.join(this.sessionsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    })
    .sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  loadSession(sessionId: string): SessionData | null {
    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  saveSession(sessionData: SessionData): SessionData {
    const sessionId = sessionData.id || this.generateId();
    const now = new Date().toISOString();

    const fullSession: SessionData = {
      ...sessionData,
      id: sessionId,
      createdAt: sessionData.createdAt || now,
      updatedAt: now
    };

    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(fullSession, null, 2));

    return fullSession;
  }

  deleteSession(sessionId: string): boolean {
    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }

    return false;
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }
}
