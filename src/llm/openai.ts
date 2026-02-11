import { LLMBase, Message, StreamChunk, LLMOptions } from './base';

export class OpenAILLM extends LLMBase {
  constructor(options: LLMOptions) {
    super(options);
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await this.fetchAPI(messages, false);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    return data.choices[0]?.message?.content || '';
  }

  async chatStream(
    messages: Message[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const response = await this.fetchAPI(messages, true);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    // Read stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') {
              onChunk({ content: '', done: true });
              return;
            }

            try {
              const parsed = JSON.parse(data) as any;
              const content = parsed.choices[0]?.delta?.content || '';

              if (content) {
                onChunk({ content, done: false });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      onChunk({ content: '', done: true });
    } finally {
      reader.releaseLock();
    }
  }

  private async fetchAPI(messages: Message[], stream: boolean): Promise<Response> {
    const baseUrl = this.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        stream,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    return response;
  }

  getAvailableModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ];
  }
}

export function createOpenAILLM(options: LLMOptions): OpenAILLM {
  return new OpenAILLM(options);
}
