import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProvider } from './providers/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYMBOLS_PATH = join(__dirname, '../symbols.json');

interface SymbolEntry {
  symbol: string;
  chains: {
    chain: string;
    address: string;
  }[];
}

interface SymbolsManifest {
  updatedAt: string;
  symbols: SymbolEntry[];
}

async function generateSymbolsManifest(): Promise<void> {
  console.log('=== Generating symbols.json ===\n');

  const provider = getProvider();

  if (!provider.initialized()) {
    console.log('Initializing provider...');
    await provider.init();
  }

  const chains = await provider.listChains();
  console.log(`Found ${chains.length} chains.\n`);

  const symbolMap = new Map<string, { chain: string; address: string }[]>();

  for (const chain of chains) {
    console.log(`Processing ${chain}...`);
    const chainLogos = await provider.getChainLogos(chain);

    if (!chainLogos) {
      continue;
    }

    // Native token
    if (chainLogos.native && chainLogos.native.symbol) {
      const symbol = chainLogos.native.symbol.toUpperCase();
      if (!symbolMap.has(symbol)) {
        symbolMap.set(symbol, []);
      }
      symbolMap.get(symbol)!.push({
        chain,
        address: 'native',
      });
      console.log(`  [+] ${symbol} -> ${chain}/native`);
    }

    // Tokens
    for (const token of chainLogos.tokens) {
      if (token.symbol) {
        const symbol = token.symbol.toUpperCase();
        if (!symbolMap.has(symbol)) {
          symbolMap.set(symbol, []);
        }
        symbolMap.get(symbol)!.push({
          chain,
          address: token.address.toLowerCase(),
        });
        console.log(`  [+] ${symbol} -> ${chain}/${token.address.substring(0, 10)}...`);
      }
    }
  }

  const symbols: SymbolEntry[] = [];
  for (const [symbol, chains] of symbolMap) {
    symbols.push({ symbol, chains });
  }

  // Sort by symbol
  symbols.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const manifest: SymbolsManifest = {
    updatedAt: new Date().toISOString(),
    symbols,
  };

  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(SYMBOLS_PATH, content, 'utf-8');

  console.log(`\n=== Complete ===`);
  console.log(`Saved to: ${SYMBOLS_PATH}`);
  console.log(`Total unique symbols: ${symbols.length}`);
}

generateSymbolsManifest().catch(console.error);
