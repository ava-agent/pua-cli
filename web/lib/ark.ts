export type ArkMessage = {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
};

export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
export const DEFAULT_ARK_CHAT_MODEL = 'doubao-seed-2-0-code-preview-260215';

export function getArkApiKey(): string | undefined {
  return process.env.ARK_API_KEY;
}

export function getArkChatModel(): string {
  return process.env.ARK_CHAT_MODEL || DEFAULT_ARK_CHAT_MODEL;
}

function getArkChatCompletionsUrl(): string {
  const baseUrl = process.env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL;
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

export async function callArkChat(
  apiKey: string,
  messages: ArkMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeoutMs?: number;
    fallback?: string;
  } = {}
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  let response: Response;
  try {
    response = await fetch(getArkChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getArkChatModel(),
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Ark API error:', errorData);
    throw new Error('AI 服务暂时不可用');
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || options.fallback || '';
}
