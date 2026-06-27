import { LLMBase, LLMOptions } from './base';
import { ArkLLM } from './ark';
import { OpenAILLM } from './openai';
import { type ProviderType } from '../config/providers';

/**
 * Create an LLM instance based on provider type
 */
export function createLLM(provider: ProviderType, options: LLMOptions): LLMBase {
  switch (provider) {
    case 'ark':
      return new ArkLLM(options);
    case 'openai':
      return new OpenAILLM(options);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Re-export LLM classes
 */
export { ArkLLM } from './ark';
export { OpenAILLM } from './openai';
