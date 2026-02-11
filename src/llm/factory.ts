import { LLMBase, LLMOptions } from './base';
import { ZhipuLLM } from './zhipu';
import { OpenAILLM } from './openai';
import { type ProviderType } from '../config/providers';

/**
 * Create an LLM instance based on provider type
 */
export function createLLM(provider: ProviderType, options: LLMOptions): LLMBase {
  switch (provider) {
    case 'zhipu':
      return new ZhipuLLM(options);
    case 'openai':
      return new OpenAILLM(options);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Re-export LLM classes
 */
export { ZhipuLLM } from './zhipu';
export { OpenAILLM } from './openai';
