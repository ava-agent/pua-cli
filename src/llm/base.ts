export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface LLMOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
}

export abstract class LLMBase {
  protected apiKey: string;
  protected model: string;
  protected baseUrl: string;
  protected timeout: number;

  constructor(options: LLMOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = options.baseUrl || '';
    this.timeout = options.timeout || 60000;
  }

  /**
   * Send a message and get the response
   */
  abstract chat(messages: Message[]): Promise<string>;

  /**
   * Send a message with streaming response
   */
  abstract chatStream(
    messages: Message[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;

  /**
   * Get available models for this provider
   */
  abstract getAvailableModels(): string[];

  /**
   * Check if a model is available
   */
  isModelAvailable(model: string): boolean {
    return this.getAvailableModels().includes(model);
  }
}
