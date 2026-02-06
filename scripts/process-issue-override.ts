import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { computeFileHash } from './utils/hash.js';
import type { OverrideManifest, SymbolsManifest } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../overrides');
const OVERRIDE_JSON_PATH = join(OVERRIDES_DIR, 'override.json');
const TEMP_LOGO = join(__dirname, '../temp_logo.png');
const SYMBOLS_PATH = join(__dirname, '../symbols.json');

interface IssueForm {
  input_type: string;
  symbol?: string;
  address?: string;
  chain_scope: string;
  chain?: string;
  chains?: string;
  description?: string;
  issue_number?: string;
}

interface ProcessResult {
  success: boolean;
  hash: string;
  message: string;
}

interface SymbolChainEntry {
  chain: string;
  address: string;
}

function loadSymbolsMap(): Map<string, SymbolChainEntry[]> {
  const map = new Map<string, SymbolChainEntry[]>();

  if (!existsSync(SYMBOLS_PATH)) {
    console.warn('symbols.json not found');
    return map;
  }

  try {
    const content = readFileSync(SYMBOLS_PATH, 'utf-8');
    const manifest = JSON.parse(content) as SymbolsManifest;

    for (const entry of manifest.symbols) {
      const normalizedSymbol = entry.symbol.toUpperCase().trim();
      map.set(normalizedSymbol, entry.chains);
    }

    console.log(`Loaded ${map.size} symbols from symbols.json`);
  } catch (error) {
    console.error('Failed to load symbols.json:', error);
  }

  return map;
}

async function saveLogoFile(hash: string, chain?: string, address?: string): Promise<string> {
  const logoFile = `${hash}.png`;
  let destDir: string;

  if (chain && address) {
    destDir = join(OVERRIDES_DIR, 'blockchains', chain, address);
  } else {
    destDir = join(OVERRIDES_DIR, 'common');
  }

  mkdirSync(destDir, { recursive: true });

  const destPath = join(destDir, logoFile);

  if (existsSync(destDir)) {
    const existingFiles = readdirSync(destDir).filter(f => f.endsWith('.png'));
    for (const file of existingFiles) {
      if (file !== logoFile) {
        rmSync(join(destDir, file));
      }
    }
  }

  copyFileSync(TEMP_LOGO, destPath);
  return logoFile;
}

function loadOverrideManifest(): OverrideManifest {
  if (!existsSync(OVERRIDE_JSON_PATH)) {
    return { common: {} };
  }

  try {
    const content = readFileSync(OVERRIDE_JSON_PATH, 'utf-8');
    return JSON.parse(content) as OverrideManifest;
  } catch {
    return { common: {} };
  }
}

function saveOverrideManifest(manifest: OverrideManifest): void {
  const content = JSON.stringify(manifest, null, 2);
  writeFileSync(OVERRIDE_JSON_PATH, content, 'utf-8');
}

function updateOverrideJsonForSymbol(
  symbol: string,
  chainScope: string,
  chains: string[],
  logoFile: string,
  symbolChains: SymbolChainEntry[]
): void {
  const manifest = loadOverrideManifest();

  if (chainScope === 'All Chains') {
    if (!manifest.common.token) {
      manifest.common.token = [];
    }

    manifest.common.token.push({
      symbol,
      chains: ['*'],
      logo: logoFile,
    });

    console.log(`Added common.token override for ${symbol} (all chains)`);
  } else {
    if (!manifest.blockchains) {
      manifest.blockchains = {};
    }

    for (const { chain, address } of symbolChains) {
      if (chainScope === 'Single Chain') {
        if (chains.includes(chain)) {
          if (!manifest.blockchains[chain]) {
            manifest.blockchains[chain] = {};
          }
          manifest.blockchains[chain][address] = logoFile;
          console.log(`Added blockchains override for ${chain}/${address}`);
        }
      } else if (chainScope === 'Multiple Chains') {
        if (chains.includes(chain)) {
          if (!manifest.blockchains[chain]) {
            manifest.blockchains[chain] = {};
          }
          manifest.blockchains[chain][address] = logoFile;
          console.log(`Added blockchains override for ${chain}/${address}`);
        }
      }
    }
  }

  saveOverrideManifest(manifest);
}

function updateOverrideJsonForAddress(
  chain: string,
  address: string,
  logoFile: string
): void {
  const manifest = loadOverrideManifest();

  if (!manifest.blockchains) {
    manifest.blockchains = {};
  }

  if (!manifest.blockchains[chain]) {
    manifest.blockchains[chain] = {};
  }

  manifest.blockchains[chain][address] = logoFile;

  saveOverrideManifest(manifest);

  console.log(`Added blockchains override for ${chain}/${address}`);
}

async function processIssue(form: IssueForm): Promise<ProcessResult> {
  if (!existsSync(TEMP_LOGO)) {
    return {
      success: false,
      hash: '',
      message: 'Logo file not found',
    };
  }

  try {
    const hash = await computeFileHash(TEMP_LOGO);
    const logoFile = `${hash}.png`;

    console.log(`Processing ${form.input_type} override...`);
    console.log(`Logo hash: ${hash}`);

    if (form.input_type === 'Token Symbol') {
      if (!form.symbol) {
        return {
          success: false,
          hash: '',
          message: 'Symbol is required',
        };
      }

      const symbolsMap = loadSymbolsMap();
      const normalizedSymbol = form.symbol.toUpperCase().trim();
      const symbolChains = symbolsMap.get(normalizedSymbol);

      if (!symbolChains || symbolChains.length === 0) {
        return {
          success: false,
          hash: '',
          message: `Symbol "${form.symbol}" not found in symbols.json`,
        };
      }

      console.log(`Found ${symbolChains.length} chains for ${form.symbol}`);

      let targetChains: string[] = [];

      if (form.chain_scope === 'All Chains') {
        targetChains = symbolChains.map(sc => sc.chain);
      } else if (form.chain_scope === 'Single Chain') {
        targetChains = form.chain ? [form.chain.trim()] : [];
      } else if (form.chain_scope === 'Multiple Chains' && form.chains) {
        targetChains = form.chains.split(',').map(s => s.trim()).filter(Boolean);
      }

      const filteredChains = symbolChains.filter(sc => targetChains.includes(sc.chain));

      if (filteredChains.length === 0) {
        return {
          success: false,
          hash: '',
          message: `No matching chains found for symbol "${form.symbol}" with scope "${form.chain_scope}"`,
        };
      }

      await saveLogoFile(hash);

      updateOverrideJsonForSymbol(
        form.symbol,
        form.chain_scope,
        targetChains,
        logoFile,
        filteredChains
      );

    } else {
      if (!form.chain || !form.address) {
        return {
          success: false,
          hash: '',
          message: 'Chain and address are required for Token Address mode',
        };
      }

      await saveLogoFile(hash, form.chain.trim(), form.address.trim());

      updateOverrideJsonForAddress(
        form.chain.trim(),
        form.address.trim(),
        logoFile
      );
    }

    if (existsSync(TEMP_LOGO)) {
      rmSync(TEMP_LOGO);
    }

    return {
      success: true,
      hash,
      message: `Logo override processed: ${logoFile}`,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      hash: '',
      message: `Error processing logo: ${errorMessage}`,
    };
  }
}

async function main() {
  const form: IssueForm = {
    input_type: process.env.INPUT_TYPE || '',
    symbol: process.env.SYMBOL || undefined,
    address: process.env.ADDRESS || undefined,
    chain_scope: process.env.CHAIN_SCOPE || '',
    chain: process.env.CHAIN || undefined,
    chains: process.env.CHAINS || undefined,
    description: process.env.DESCRIPTION || undefined,
    issue_number: process.env.ISSUE_NUMBER || undefined,
  };

  console.log('Processing issue override...');
  console.log(`Input Type: ${form.input_type}`);
  console.log(`Chain Scope: ${form.chain_scope}`);

  const result = await processIssue(form);

  if (result.success) {
    console.log(`✅ ${result.message}`);

    if (process.env.GITHUB_OUTPUT) {
      const output = `hash=${result.hash}\nsuccess=true`;
      require('node:fs').writeFileSync(process.env.GITHUB_OUTPUT, output + '\n');
    }
  } else {
    console.error(`❌ ${result.message}`);

    if (process.env.GITHUB_OUTPUT) {
      const output = `success=false\nmessage=${result.message}`;
      require('node:fs').writeFileSync(process.env.GITHUB_OUTPUT, output + '\n');
    }

    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
