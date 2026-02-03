import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest } from './utils/manifest.js';
import { loadDeprecations, isDeprecated } from './utils/deprecations.js';
import { computeFileHash } from './utils/hash.js';
import { getProvider } from './providers/index.js';
import type { LogoChange } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOCKCHAINS_DIR = join(__dirname, '../blockchains');

interface CheckOptions {
  chains?: string[];
  json?: boolean;
  provider?: string;
}

async function checkUpdates(options: CheckOptions = {}): Promise<LogoChange[]> {
  const manifest = loadManifest();
  const deprecations = loadDeprecations();
  const changes: LogoChange[] = [];

  if (!manifest) {
    console.error('No manifest found. Please run sync first.');
    return [];
  }

  const provider = getProvider(options.provider);

  if (!provider.initialized()) {
    console.log('Provider not initialized. Syncing...');
    await provider.init();
  }

  // Get chains from manifest to only check recorded tokens
  const recordedChains = Object.keys(manifest.logos);
  if (recordedChains.length === 0) {
    console.log('No logos recorded in manifest. Run "bun run sync" first.');
    return [];
  }

  const chains = [...new Set(recordedChains.map(k => k.split('/')[0]))];
  console.log(`Checking ${chains.length} chain(s) for updates...`);

  // Get token list for only the recorded chains
  const tokenList = await provider.listLogos(chains);

  for (const chain of chains) {
    console.log(`\nChecking ${chain}...`);

    // Get recorded tokens for this chain
    const chainTokens = recordedChains
      .filter(k => k.startsWith(`${chain}/`))
      .map(k => k.replace(`${chain}/`, ''));

    // Get available tokens from provider
    const availableTokens = tokenList[chain] || [];

    for (const address of chainTokens) {
      const key = `${chain}/${address}`;
      const localHash = manifest.logos[key];

      // Check if token exists in provider
      if (!availableTokens.includes(address)) {
        changes.push({
          chain,
          address,
          type: 'deleted',
          localHash,
        });
        console.log(`  [DELETED] ${key}`);
        continue;
      }

      // Get remote logo and compute hash
      const logo = await provider.getFile(chain, address);
      if (!logo) {
        continue;
      }

      const remoteHash = await computeFileHash(logo);

      if (isDeprecated(chain, address, remoteHash)) {
        changes.push({
          chain,
          address,
          type: 'updated',
          localHash,
          remoteHash,
          skipReason: 'Deprecated',
        });
        console.log(`  [SKIPPED] ${key} (deprecated)`);
        continue;
      }

      if (localHash !== remoteHash) {
        changes.push({
          chain,
          address,
          type: 'updated',
          localHash,
          remoteHash,
        });
        console.log(`  [UPDATED] ${key}: ${localHash} -> ${remoteHash}`);
      } else {
        console.log(`  [OK] ${key}`);
      }
    }
  }

  return changes;
}

async function main() {
  const args = process.argv.slice(2);
  const options: CheckOptions = {
    chains: args.filter(arg => !arg.startsWith('--')),
    json: args.includes('--json'),
    provider: process.env.LOGO_PROVIDER,
  };

  const changes = await checkUpdates(options);

  if (options.json) {
    console.log(JSON.stringify(changes, null, 2));
  } else {
    console.log(`\n=== Summary ===`);
    const updated = changes.filter(c => c.type === 'updated').length;
    const deleted = changes.filter(c => c.type === 'deleted').length;
    const skipped = changes.filter(c => c.skipReason).length;

    console.log(`Total: ${changes.length} changes`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Deleted: ${deleted}`);
    console.log(`  Skipped (deprecated): ${skipped}`);

    if (changes.length > 0) {
      process.exit(1);
    }
  }

  return changes;
}

main().catch(console.error);
