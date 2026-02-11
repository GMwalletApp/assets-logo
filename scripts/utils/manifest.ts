import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogoManifest, ChainManifest } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const METADATA_DIR = join(__dirname, '../../.metadata/manifests');
const MANIFEST_PATH = join(METADATA_DIR, 'latest.json');

export function loadManifest(): LogoManifest | null {
  if (!existsSync(MANIFEST_PATH)) {
    return null;
  }

  try {
    const content = readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(content) as LogoManifest;
  } catch {
    return null;
  }
}

export function saveManifest(manifest: LogoManifest): void {
  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(MANIFEST_PATH, content, 'utf-8');
}

export function createEmptyManifest(): LogoManifest {
  return {
    version: generateVersion(),
    updatedAt: new Date().toISOString(),
    logos: {},
  };
}

export function generateVersion(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const hour = Math.floor(now.getHours() / 6);
  return `${date}-${hour.toString().padStart(2, '0')}`;
}

export function incrementVersion(currentManifest: LogoManifest): string {
  const parts = currentManifest.version.split('-');
  if (parts.length === 2) {
    const [date, hour] = parts;
    const currentHour = parseInt(hour);
    const newHour = currentHour + 1;
    return `${date}-${newHour.toString().padStart(2, '0')}`;
  }
  return generateVersion();
}

export function getLogoHash(chain: string, address: string): string | undefined {
  const manifest = loadManifest();
  if (!manifest) return undefined;
  const chainData = manifest.logos[chain];
  if (!chainData) return undefined;
  return chainData[address];
}

export function setLogoHash(chain: string, address: string, hash: string): void {
  const manifest = loadManifest() || createEmptyManifest();
  
  if (!manifest.logos[chain]) {
    manifest.logos[chain] = {};
  }
  
  manifest.logos[chain][address] = `overrides/${hash}`;
  manifest.updatedAt = new Date().toISOString();
  saveManifest(manifest);
}

export function getChainManifest(chain: string): ChainManifest | undefined {
  const manifest = loadManifest();
  if (!manifest) return undefined;
  return manifest.logos[chain];
}

export function setChainLogo(chain: string, hash: string): void {
  const manifest = loadManifest() || createEmptyManifest();
  
  if (!manifest.logos[chain]) {
    manifest.logos[chain] = {};
  }
  
  manifest.logos[chain].logo = `overrides/${hash}`;
  manifest.updatedAt = new Date().toISOString();
  saveManifest(manifest);
}

export function setNativeLogo(chain: string, hash: string): void {
  const manifest = loadManifest() || createEmptyManifest();
  
  if (!manifest.logos[chain]) {
    manifest.logos[chain] = {};
  }
  
  manifest.logos[chain].native = `overrides/${hash}`;
  manifest.updatedAt = new Date().toISOString();
  saveManifest(manifest);
}

export function removeLogoHash(chain: string, address: string): void {
  const manifest = loadManifest();
  if (!manifest) return;

  const chainData = manifest.logos[chain];
  if (chainData && chainData[address]) {
    delete chainData[address];
    manifest.updatedAt = new Date().toISOString();
    saveManifest(manifest);
  }
}

export function getAllChains(): string[] {
  const manifest = loadManifest();
  if (!manifest) return [];
  return Object.keys(manifest.logos);
}
