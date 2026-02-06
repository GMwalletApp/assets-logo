import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, readdir, copyFile, unlink } from 'node:fs/promises';
import { generateVersion } from './utils/manifest.js';
import type { DefaultManifest, OverrideManifest, SymbolsManifest, ChainManifest } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, '../default.json');
const SYMBOLS_PATH = join(__dirname, '../symbols.json');
const OVERRIDE_PATH = join(__dirname, '../overrides/override.json');
const OVERRIDES_DIR = join(__dirname, '../overrides');
const COMMON_DIR = join(__dirname, '../overrides/common');
const BLOCKCHAINS_OVERRIDE_DIR = join(__dirname, '../overrides/blockchains');
const OUTPUT_DIR = join(__dirname, '../.metadata/manifests');
const OUTPUT_PATH = join(OUTPUT_DIR, 'latest.json');

interface LogoEntry {
  source: 'default' | 'override';
  path: string;
  originalPath?: string;
}

async function applyOverrides(): Promise<void> {
  console.log('=== Applying Overrides ===\n');

  // Load default.json
  if (!existsSync(DEFAULT_PATH)) {
    console.error('default.json not found. Run "bun run generate:default" first.');
    process.exit(1);
  }
  const defaultManifest = JSON.parse(readFileSync(DEFAULT_PATH, 'utf-8')) as DefaultManifest;
  console.log('Loaded default.json');

  // Load symbols.json
  let symbolsMap: Map<string, { chain: string; address: string }[]> = new Map();
  if (existsSync(SYMBOLS_PATH)) {
    const symbolsManifest = JSON.parse(readFileSync(SYMBOLS_PATH, 'utf-8')) as SymbolsManifest;
    for (const entry of symbolsManifest.symbols) {
      symbolsMap.set(entry.symbol.toUpperCase(), entry.chains);
    }
    console.log(`Loaded symbols.json (${symbolsManifest.symbols.length} symbols)`);
  }

  // Load override.json
  let overrideManifest: OverrideManifest | null = null;
  if (existsSync(OVERRIDE_PATH)) {
    const content = readFileSync(OVERRIDE_PATH, 'utf-8');
    overrideManifest = JSON.parse(content) as OverrideManifest;
    console.log('Loaded override.json');
  } else {
    console.log('No override.json found, skipping overrides');
  }

  // Start building final manifest
  const result = { ...defaultManifest };
  result.version = generateVersion();
  result.updatedAt = new Date().toISOString();

  // Add full paths for default logos
  for (const [chain, chainManifest] of Object.entries(result.logos)) {
    for (const [address, hash] of Object.entries(chainManifest)) {
      if (hash) {
        chainManifest[address] = `blockchains/${chain}/${hash}`;
      }
    }
  }

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Track copied files for cleanup
  const copiedFiles: string[] = [];

  // Apply overrides.common.token (symbol-based cross-chain overrides)
  if (overrideManifest?.common?.token) {
    console.log('\nApplying common.token overrides...');
    for (const rule of overrideManifest.common.token) {
      const symbol = rule.symbol.toUpperCase();
      const chains = rule.chains;
      const logoFile = rule.logo;

      console.log(`  Processing ${symbol} -> chains: ${chains.join(', ')}`);

      // Find all chains that have this symbol
      const symbolChains = symbolsMap.get(symbol) || [];

      for (const { chain, address } of symbolChains) {
        // Check if this chain should be overridden
        if (chains.includes('*') || chains.includes(chain)) {
          console.log(`    Override ${chain}/${address} -> ${logoFile}`);

          // Copy logo file from overrides/common to output
          const srcPath = join(COMMON_DIR, logoFile);
          const destPath = join(OUTPUT_DIR, 'common', logoFile);

          if (existsSync(srcPath)) {
            mkdirSync(join(destPath, '..'), { recursive: true });
            copyFileSync(srcPath, destPath);
            copiedFiles.push(destPath);

            // Update manifest
            if (!result.logos[chain]) {
              result.logos[chain] = {};
            }
            result.logos[chain][address] = `common/${logoFile}`;
          }
        }
      }
    }
  }

  // Apply overrides.common.logo (chain logo overrides)
  if (overrideManifest?.common?.logo) {
    console.log('\nApplying common.logo overrides...');
    for (const [chain, logoFile] of Object.entries(overrideManifest.common.logo)) {
      console.log(`  Override chain ${chain} logo -> ${logoFile}`);

      const srcPath = join(COMMON_DIR, logoFile);
      const destPath = join(OUTPUT_DIR, 'common', logoFile);

      if (existsSync(srcPath)) {
        mkdirSync(join(destPath, '..'), { recursive: true });
        copyFileSync(srcPath, destPath);
        copiedFiles.push(destPath);

        // Update manifest
        if (!result.logos[chain]) {
          result.logos[chain] = {};
        }
        result.logos[chain].logo = `common/${logoFile}`;
      }
    }
  }

  // Apply overrides.blockchains (specific chain+address overrides)
  if (overrideManifest?.blockchains) {
    console.log('\nApplying blockchains overrides...');
    for (const [chain, chainManifest] of Object.entries(overrideManifest.blockchains)) {
      console.log(`  Processing ${chain}...`);

      if (!result.logos[chain]) {
        result.logos[chain] = {};
      }

      for (const [address, logoFile] of Object.entries(chainManifest)) {
        if (!address || !logoFile) continue;
        console.log(`    Override ${chain}/${address} -> ${logoFile}`);

        // Copy logo file from overrides/blockchains to output
        const srcPath = join(BLOCKCHAINS_OVERRIDE_DIR, chain, address, logoFile);
        const destPath = join(OUTPUT_DIR, 'blockchains', chain, logoFile);

        if (existsSync(srcPath)) {
          mkdirSync(join(destPath, '..'), { recursive: true });
          copyFileSync(srcPath, destPath);
          copiedFiles.push(destPath);

          // Update manifest
          result.logos[chain][address] = `blockchains/${chain}/${logoFile}`;
        }
      }
    }
  }

  // Write final manifest
  const content = JSON.stringify(result, null, 2);
  writeFileSync(OUTPUT_PATH, content, 'utf-8');

  console.log(`\n=== Complete ===`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Version: ${result.version}`);
  console.log(`Total chains: ${Object.keys(result.logos).length}`);
}

async function cleanCommonDir(): Promise<void> {
  const commonDir = join(OUTPUT_DIR, 'common');
  if (existsSync(commonDir)) {
    const files = await readdir(commonDir);
    for (const file of files) {
      await unlink(join(commonDir, file));
    }
    console.log(`Cleaned common directory`);
  }
}

async function cleanBlockchainsDir(): Promise<void> {
  const blockchainsDir = join(OUTPUT_DIR, 'blockchains');
  if (existsSync(blockchainsDir)) {
    const files = await readdir(blockchainsDir);
    for (const file of files) {
      await unlink(join(blockchainsDir, file));
    }
    console.log(`Cleaned blockchains directory`);
  }
}

applyOverrides().catch(console.error);
