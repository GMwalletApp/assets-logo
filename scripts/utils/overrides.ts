import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { OldOverrideManifest, OldOverrideLogoInfo } from '../types/index.js';
import { computeFileHash } from './hash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../../.overrides');
const OVERRIDES_PATH = join(OVERRIDES_DIR, 'manifest.json');

export function loadOverridesManifest(): OldOverrideManifest {
  if (!existsSync(OVERRIDES_PATH)) {
    return { updatedAt: '', logos: {} };
  }

  try {
    const content = readFileSync(OVERRIDES_PATH, 'utf-8');
    return JSON.parse(content) as OldOverrideManifest;
  } catch {
    return { updatedAt: '', logos: {} };
  }
}

export function saveOverridesManifest(manifest: OldOverrideManifest): void {
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
  mkdirSync(overridesDir, { recursive: true });
  
  const legacyLogoPath = join(overridesDir, 'logo.png');
  let logoPath: string;
  let hash: string;
  
  if (existsSync(legacyLogoPath)) {
    logoPath = legacyLogoPath;
    hash = await computeFileHash(logoPath);
    const hashLogoPath = join(overridesDir, `${hash}.png`);
    
    if (logoPath !== hashLogoPath) {
      renameSync(logoPath, hashLogoPath);
    }
  } else {
    const existingHashLogo = readdirSync(overridesDir)
      .filter(f => f.endsWith('.png') && /^[a-f0-9]{16}\.png$/.test(f))[0];
    
    if (existingHashLogo) {
      logoPath = join(overridesDir, existingHashLogo);
      hash = existingHashLogo.replace('.png', '');
    } else {
      throw new Error(`Override logo not found in: ${overridesDir}`);
    }
  }
  
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

export function getOverrideLogoPath(chain: string, address: string): string | null {
  const hash = getOverrideHash(chain, address);
  if (!hash) {
    return null;
  }
  const logoPath = join(__dirname, `../../overrides/${chain}/${address}/${hash}.png`);
  return existsSync(logoPath) ? logoPath : null;
}

export function readOverrideLogo(chain: string, address: string): Uint8Array | null {
  const logoPath = getOverrideLogoPath(chain, address);
  if (!logoPath) {
    return null;
  }
  try {
    return readFileSync(logoPath);
  } catch {
    return null;
  }
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

  const logoPath = join(__dirname, `../../overrides/${chain}/${address}/${currentInfo.hash}.png`);

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

export function listOverrides(): Array<{ key: string; info: OldOverrideLogoInfo }> {
  const manifest = loadOverridesManifest();
  return Object.entries(manifest.logos).map(([key, info]) => ({ key, info }));
}
