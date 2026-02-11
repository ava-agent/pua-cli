import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';
import { LLMBase, Message, StreamChunk, LLMOptions } from './base';

export class ZhipuLLM extends LLMBase {
  private client: ZhipuAI;

  constructor(options: LLMOptions) {
    super(options);
    this.client = new ZhipuAI({
      apiKey: options.apiKey,
    });
  }

  async chat(messages: Message[]): Promise<string> {
    try {
      const response = await this.client.createCompletions({
        model: this.model,
        messages: messages as any[],
        stream: false,
      }) as any;

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(`GLM API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async chatStream(
    messages: Message[],
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    try {
      const response = await this.client.createCompletions({
        model: this.model,
        messages: messages as any[],
        stream: true,
      }) as any;

      // Check if response is a stream (IncomingMessage)
      if (response && typeof response.on === 'function') {
        // Handle streaming response
        let buffer = '';

        response.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter((line: string) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                onChunk({ content: '', done: true });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';

                if (content) {
                  buffer += content;
                  onChunk({ content, done: false });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        });

        response.on('end', () => {
          onChunk({ content: '', done: true });
        });

        response.on('error', (error: Error) => {
          throw new Error(`Stream error: ${error.message}`);
        });

        // Wait for stream to complete
        await new Promise<void>((resolve, reject) => {
          response.on('end', resolve);
          response.on('error', reject);
        });
      } else {
        // Fallback to non-streaming response
        const content = (response as any)?.choices?.[0]?.message?.content || '';
        onChunk({ content, done: true });
      }
    } catch (error) {
      throw new Error(`GLM API streaming error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getAvailableModels(): string[] {
    return ['glm-4.7', 'glm-4.7-flash', 'glm-4.5', 'glm-4-flash', 'glm-4'];
  }
}

export function createZhipuLLM(options: LLMOptions): ZhipuLLM {
  return new ZhipuLLM(options);
}
