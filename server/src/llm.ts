import OpenAI from 'openai';
import { env } from './env.js';

// The OpenAI client is used for both the agent and the LLM
export const llm = new OpenAI({
  baseURL: env.llm.baseUrl,
  apiKey: env.llm.apiKey,
});

export const MODEL = env.llm.model;
