import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(import.meta.dirname, '../../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var ${key}.`);
  }
  return value;
}

export const env = {
  postgres: {
    host: required('POSTGRES_HOST'),
    port: Number(required('POSTGRES_PORT')),
    user: required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
    database: required('POSTGRES_DB'),
  },
  redis: {
    host: required('REDIS_HOST'),
    port: Number(required('REDIS_PORT')),
  },
  llm: {
    baseUrl: required("LLM_BASE_URL"),
    apiKey: required("LLM_API_KEY"),
    model: required("LLM_MODEL"),
  },
  rawPayloadDir: process.env.RAW_PAYLOAD_DIR ?? "./data/raw",
  githubToken: process.env.GITHUB_TOKEN ?? '',
};
