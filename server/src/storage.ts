import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';

const ROOT = path.resolve(import.meta.dirname, '..', env.rawPayloadDir);

export async function saveRawPage(
  owner: string,
  name: string,
  page: number,
  data: unknown,
): Promise<string> {
  const key = `${owner}-${name}/page-${String(page).padStart(4, '0')}.json`;
  const fullPath = path.join(ROOT, key);

  await mkdir(path.dirname(fullPath), { recursive: true });

  await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');

  return key;
}
