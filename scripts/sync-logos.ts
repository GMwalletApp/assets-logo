import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, readFileSync, rmSync } from 'node:fs';
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

function getDestPath(chain: string, hash: string): string {
  return join(BLOCKCHAINS_DIR, chain, `${hash}.png`);
}

async function syncChain(chain: string, provider: any, manifest: any, options: SyncOptions): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const chainLogos = await provider.getChainLogos(chain);
  
  if (!chainLogos) {
    return results;
  }

  console.log(`\nSyncing ${chain}...`);

  if (!manifest.logos[chain]) {
    manifest.logos[chain] = {};
  }

  // Process chain logo (stored as 'logo' in manifest)
  const chainLogoHash = chainLogos.chain.logo ? await computeFileHash(chainLogos.chain.logo) : null;
  if (chainLogoHash) {
    const existingHash = manifest.logos[chain].logo;
    const destPath = getDestPath(chain, chainLogoHash);
    const exists = existsSync(destPath);
    
    if (existingHash !== chainLogoHash) {
      if (!options.dryRun) {
        await mkdir(join(destPath, '..'), { recursive: true });
        await writeFile(destPath, chainLogos.chain.logo);
      }
      manifest.logos[chain].logo = `${chainLogoHash}.png`;
      console.log(`  [${exists ? '~' : '+'}] logo: ${chainLogoHash}.png`);
      results.push({
        success: true,
        chain,
        address: 'logo',
        hash: chainLogoHash,
        type: exists ? 'updated' : 'added',
      });
    }
  }

  // Process native logo (stored as 'native' in manifest)
  if (chainLogos.native) {
    const nativeHash = await computeFileHash(chainLogos.native.logo);
    const existingHash = manifest.logos[chain].native;
    const destPath = getDestPath(chain, nativeHash);
    const exists = existsSync(destPath);
    
    if (existingHash !== nativeHash) {
      if (!options.dryRun) {
        await mkdir(join(destPath, '..'), { recursive: true });
        await writeFile(destPath, chainLogos.native.logo);
      }
      manifest.logos[chain].native = `${nativeHash}.png`;
      console.log(`  [${exists ? '~' : '+'}] native (${chainLogos.native.symbol}): ${nativeHash}.png`);
      results.push({
        success: true,
        chain,
        address: 'native',
        hash: nativeHash,
        type: exists ? 'updated' : 'added',
      });
    }
  }

  // Process token logos
  for (const token of chainLogos.tokens) {
    const tokenHash = await computeFileHash(token.logo);
    const existingHash = manifest.logos[chain][token.address];
    const destPath = getDestPath(chain, tokenHash);
    const exists = existsSync(destPath);
    
    if (existingHash !== tokenHash) {
      if (!options.dryRun) {
        await mkdir(join(destPath, '..'), { recursive: true });
        await writeFile(destPath, token.logo);
      }
      manifest.logos[chain][token.address] = `${tokenHash}.png`;
      const symbol = token.symbol || token.address;
      console.log(`  [${exists ? '~' : '+'}] ${symbol}: ${tokenHash}.png`);
      results.push({
        success: true,
        chain,
        address: token.address,
        hash: tokenHash,
        type: exists ? 'updated' : 'added',
      });
    }
  }

  return results;
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

  const chains = await provider.listChains();

  if (chains.length === 0) {
    console.log('No chains found.');
    return [];
  }

  console.log(`Found ${chains.length} chain(s).`);

  for (const chain of chains) {
    const chainResults = await syncChain(chain, provider, manifest, options);
    results.push(...chainResults);
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
    const destPath = getDestPath(change.chain, hash);
    const exists = existsSync(destPath);

    if (!options.dryRun) {
      await mkdir(join(destPath, '..'), { recursive: true });
      await writeFile(destPath, logo);
    }

    if (!manifest.logos[change.chain]) {
      manifest.logos[change.chain] = {};
    }
    manifest.logos[change.chain][change.address] = `${hash}.png`;

    const result: SyncResult = {
      success: true,
      chain: change.chain,
      address: change.address,
      hash,
      type: exists ? 'updated' : 'added',
    };

    results.push(result);

    const symbol = result.type === 'added' ? '[+]' : '[~]';
    console.log(`  ${symbol} ${change.chain}/${change.address}: ${hash}.png`);
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
