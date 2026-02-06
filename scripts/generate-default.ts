import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFileHash } from './utils/hash.js';
import { generateVersion } from './utils/manifest.js';
import { getProvider } from './providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '../default.json');

interface DefaultManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, Record<string, string>>;
}

async function generateDefaultManifest(): Promise<void> {
  console.log('=== Generating default.json from TrustWallet ===\n');

  const provider = getProvider();

  if (!provider.initialized()) {
    console.log('Initializing provider...');
    await provider.init();
  }

  const chains = await provider.listChains();
  console.log(`Found ${chains.length} chains.\n`);

  const manifest: DefaultManifest = {
    version: generateVersion(),
    updatedAt: new Date().toISOString(),
    logos: {},
  };

  for (const chain of chains) {
    console.log(`Processing ${chain}...`);
    const chainLogos = await provider.getChainLogos(chain);

    if (!chainLogos) {
      continue;
    }

    manifest.logos[chain] = {};

    // Chain logo
    if (chainLogos.chain.logo) {
      const hash = await computeFileHash(chainLogos.chain.logo);
      manifest.logos[chain].logo = `${hash}.png`;
      console.log(`  [+] logo: ${hash}.png`);
    }

    // Native token
    if (chainLogos.native) {
      const hash = await computeFileHash(chainLogos.native.logo);
      manifest.logos[chain].native = `${hash}.png`;
      console.log(`  [+] native (${chainLogos.native.symbol}): ${hash}.png`);
    }

    // Tokens
    for (const token of chainLogos.tokens) {
      const hash = await computeFileHash(token.logo);
      manifest.logos[chain][token.address.toLowerCase()] = `${hash}.png`;
      const symbol = token.symbol || token.address;
      console.log(`  [+] ${symbol}: ${hash}.png`);
    }
  }

  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(DEFAULT_PATH, content, 'utf-8');

  console.log(`\n=== Complete ===`);
  console.log(`Saved to: ${DEFAULT_PATH}`);
  console.log(`Total chains: ${Object.keys(manifest.logos).length}`);
}

generateDefaultManifest().catch(console.error);
