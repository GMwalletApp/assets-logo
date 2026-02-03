import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DeprecationManifest, DeprecationInfo } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPRECATIONS_DIR = join(__dirname, '../../.deprecations');
const DEPRECATIONS_PATH = join(DEPRECATIONS_DIR, 'deprecations.json');

export function loadDeprecations(): DeprecationManifest {
  if (!existsSync(DEPRECATIONS_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(DEPRECATIONS_PATH, 'utf-8');
    return JSON.parse(content) as DeprecationManifest;
  } catch {
    return {};
  }
}

export function saveDeprecations(deprecations: DeprecationManifest): void {
  const content = JSON.stringify(deprecations, null, 2);
  writeFileSync(DEPRECATIONS_PATH, content, 'utf-8');
}

export function addDeprecation(
  chain: string,
  address: string,
  rejectedHash: string,
  reason?: string,
  rejectedBy: string = 'system'
): void {
  const deprecations = loadDeprecations();
  const key = `${chain}/${address}`;

  deprecations[key] = {
    rejectedHash,
    rejectedAt: new Date().toISOString(),
    reason,
    rejectedBy,
  };

  saveDeprecations(deprecations);
  console.log(`Added deprecation: ${key} (hash: ${rejectedHash})`);
}

export function removeDeprecation(chain: string, address: string): void {
  const deprecations = loadDeprecations();
  const key = `${chain}/${address}`;

  if (deprecations[key]) {
    delete deprecations[key];
    saveDeprecations(deprecations);
    console.log(`Removed deprecation: ${key}`);
  } else {
    console.log(`No deprecation found for: ${key}`);
  }
}

export function isDeprecated(chain: string, address: string, hash: string): boolean {
  const deprecations = loadDeprecations();
  const key = `${chain}/${address}`;
  const dep = deprecations[key];

  if (!dep) return false;
  return dep.rejectedHash === hash;
}

export function getDeprecation(chain: string, address: string): DeprecationInfo | null {
  const deprecations = loadDeprecations();
  const key = `${chain}/${address}`;
  return deprecations[key] || null;
}

export function listDeprecations(): Array<{ key: string; info: DeprecationInfo }> {
  const deprecations = loadDeprecations();
  return Object.entries(deprecations).map(([key, info]) => ({ key, info }));
}
