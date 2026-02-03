import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, saveManifest, incrementVersion, generateVersion } from './utils/manifest.js';
import { computeFileHash } from './utils/hash.js';
import { getProvider } from './providers/index.js';
import type { SyncOptions, LogoChange } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOCKCHAINS_DIR = join(__dirname, '../blockchains');

interface SyncResult {
  success: boolean;
  chain: string;
  address: string;
  hash: string;
  type: 'added' | 'updated' | 'skipped';
  reason?: string;
}

function getDestPath(chain: string, address: string, hash: string): string {
  const dir = join(BLOCKCHAINS_DIR, chain, address === 'native' ? 'native' : address);
  return join(dir, `${hash}.png`);
}

async function syncLogos(options: SyncOptions = {}): Promise<SyncResult[]> {
  const manifest = loadManifest() || {
    version: generateVersion(),
    updatedAt: new Date().toISOString(),
    logos: {},
  };
  const results: SyncResult[] = [];

  const provider = getProvider(options.provider);

  if (!provider.initialized()) {
    console.log('Provider not initialized. Syncing...');
    await provider.init();
  }

  console.log(`Syncing logos from ${provider.description}...`);
  if (options.dryRun) {
    console.log('[DRY RUN - No files will be written]');
  }

  // Get all tokens from provider (full sync)
  const tokenList = await provider.listLogos(null);

  const chains = Object.keys(tokenList);

  if (chains.length === 0) {
    console.log('No logos found in provider.');
    return [];
  }

  console.log(`Found ${chains.length} chain(s) with logos.`);

  for (const chain of chains) {
    console.log(`\nSyncing ${chain}...`);

    const tokens = tokenList[chain] || [];

    for (const address of tokens) {
      const key = `${chain}/${address}`;
      const existingHash = manifest.logos[key];

      // Get remote logo
      const logo = await provider.getFile(chain, address);
      if (!logo) {
        continue;
      }

      const remoteHash = await computeFileHash(logo);

      // Skip if already synced with same hash
      if (existingHash === remoteHash) {
        console.log(`  [OK] ${key}`);
        continue;
      }

      const destPath = getDestPath(chain, address, remoteHash);
      const exists = existsSync(destPath);

      if (!options.dryRun) {
        await mkdir(join(destPath, '..'), { recursive: true });
        await writeFile(destPath, logo);
      }

      manifest.logos[key] = remoteHash;

      const result: SyncResult = {
        success: true,
        chain,
        address,
        hash: remoteHash,
        type: exists ? 'updated' : 'added',
      };

      results.push(result);

      const symbol = result.type === 'added' ? '[+]' : '[~]';
      console.log(`  ${symbol} ${key}: ${remoteHash}`);
    }
  }

  if (!options.dryRun && results.length > 0) {
    manifest.version = incrementVersion(manifest);
    manifest.updatedAt = new Date().toISOString();
    saveManifest(manifest);
    console.log(`\nManifest updated: version=${manifest.version}`);
  }

  return results;
}

async function syncFromChanges(changes: LogoChange[], options: SyncOptions = {}): Promise<SyncResult[]> {
  const manifest = loadManifest() || {
    version: generateVersion(),
    updatedAt: new Date().toISOString(),
    logos: {},
  };
  const results: SyncResult[] = [];

  const provider = getProvider(options.provider);

  if (!provider.initialized()) {
    console.log('Provider not initialized. Syncing...');
    await provider.init();
  }

  console.log(`Syncing ${changes.length} changes...`);
  if (options.dryRun) {
    console.log('[DRY RUN - No files will be written]');
  }

  for (const change of changes) {
    if (change.skipReason) {
      console.log(`  [SKIP] ${change.chain}/${change.address}: ${change.skipReason}`);
      continue;
    }

    const logo = await provider.getFile(change.chain, change.address);
    if (!logo) {
      continue;
    }

    const hash = await computeFileHash(logo);
    const destPath = getDestPath(change.chain, change.address, hash);
    const exists = existsSync(destPath);

    if (!options.dryRun) {
      await mkdir(join(destPath, '..'), { recursive: true });
      await writeFile(destPath, logo);
    }

    manifest.logos[`${change.chain}/${change.address}`] = hash;

    const result: SyncResult = {
      success: true,
      chain: change.chain,
      address: change.address,
      hash,
      type: exists ? 'updated' : 'added',
    };

    results.push(result);

    const symbol = result.type === 'added' ? '[+]' : '[~]';
    console.log(`  ${symbol} ${change.chain}/${change.address}: ${hash}`);
  }

  if (!options.dryRun && results.length > 0) {
    manifest.version = incrementVersion(manifest);
    manifest.updatedAt = new Date().toISOString();
    saveManifest(manifest);
    console.log(`\nManifest updated: version=${manifest.version}`);
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    dryRun: args.includes('--dry-run'),
    chains: args.filter(arg => !arg.startsWith('--')),
    provider: process.env.LOGO_PROVIDER,
  };

  let results: SyncResult[];

  if (process.env.CHANGES_FILE) {
    console.log(`Loading changes from ${process.env.CHANGES_FILE}...`);
    const content = await readFile(process.env.CHANGES_FILE, 'utf-8');
    const changes = JSON.parse(content) as LogoChange[];
    results = await syncFromChanges(changes, options);
  } else {
    results = await syncLogos(options);
  }

  console.log(`\n=== Summary ===`);
  const added = results.filter(r => r.type === 'added').length;
  const updated = results.filter(r => r.type === 'updated').length;
  console.log(`Synced: ${added} added, ${updated} updated`);

  return results;
}

main().catch(console.error);
