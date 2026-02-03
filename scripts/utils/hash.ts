import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { RemoteLogoResult } from '../types/index.js';

export async function computeFileHash(filePath: string): Promise<string>;
export async function computeFileHash(content: Uint8Array): Promise<string>;
export async function computeFileHash(
  filePathOrContent: string | Uint8Array
): Promise<string> {
  const content = typeof filePathOrContent === 'string'
    ? await readFile(filePathOrContent)
    : filePathOrContent;

  const hash = createHash('sha256').update(content).digest('hex');
  return hash.slice(0, 16);
}

export function validateHash(hash: string): boolean {
  return /^[a-f0-9]{16}$/.test(hash);
}

export async function fetchWithTimeout(
  url: string,
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}
