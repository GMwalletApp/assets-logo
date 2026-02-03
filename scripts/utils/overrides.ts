import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OverrideManifest, OverrideLogoInfo } from '../types/index.js';
import { computeFileHash } from './hash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../../.overrides');
const OVERRIDES_PATH = join(OVERRIDES_DIR, 'manifest.json');

export function loadOverridesManifest(): OverrideManifest {
  if (!existsSync(OVERRIDES_PATH)) {
    return { updatedAt: '', logos: {} };
  }

  try {
    const content = readFileSync(OVERRIDES_PATH, 'utf-8');
    return JSON.parse(content) as OverrideManifest;
  } catch {
    return { updatedAt: '', logos: {} };
  }
}

export function saveOverridesManifest(manifest: OverrideManifest): void {
  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(OVERRIDES_PATH, content, 'utf-8');
}

export async function addOverride(
  chain: string,
  address: string,
  source: 'manual' | 'auto-sync' = 'manual',
  description?: string
): Promise<void> {
  const overridesDir = join(__dirname, `../../overrides/${chain}/${address}`);
  const logoPath = join(overridesDir, 'logo.png');

  if (!existsSync(logoPath)) {
    throw new Error(`Override logo not found: ${logoPath}`);
  }

  const hash = await computeFileHash(logoPath);

  const manifest = loadOverridesManifest();
  manifest.logos[`${chain}/${address}`] = {
    chain,
    address,
    hash,
    source,
    description,
    lastModified: new Date().toISOString(),
  };
  manifest.updatedAt = new Date().toISOString();

  saveOverridesManifest(manifest);
  console.log(`Added override: ${chain}/${address} (hash: ${hash})`);
}

export function removeOverride(chain: string, address: string): void {
  const manifest = loadOverridesManifest();
  const key = `${chain}/${address}`;

  if (manifest.logos[key]) {
    delete manifest.logos[key];
    manifest.updatedAt = new Date().toISOString();
    saveOverridesManifest(manifest);
    console.log(`Removed override: ${key}`);
  } else {
    console.log(`No override found for: ${key}`);
  }
}

export function getOverrideHash(chain: string, address: string): string | undefined {
  const manifest = loadOverridesManifest();
  return manifest.logos[`${chain}/${address}`]?.hash;
}

export function checkOverrideUpdate(
  chain: string,
  address: string
): Promise<{ hasUpdate: boolean; oldHash: string; newHash: string } | null> {
  const manifest = loadOverridesManifest();
  const key = `${chain}/${address}`;
  const currentInfo = manifest.logos[key];

  if (!currentInfo) {
    return Promise.resolve(null);
  }

  const logoPath = join(__dirname, `../../overrides/${chain}/${address}/logo.png`);

  if (!existsSync(logoPath)) {
    return Promise.resolve(null);
  }

  return computeFileHash(logoPath).then(newHash => {
    if (newHash !== currentInfo.hash) {
      return {
        hasUpdate: true,
        oldHash: currentInfo.hash,
        newHash,
      };
    }
    return null;
  });
}

export function listOverrides(): Array<{ key: string; info: OverrideLogoInfo }> {
  const manifest = loadOverridesManifest();
  return Object.entries(manifest.logos).map(([key, info]) => ({ key, info }));
}
