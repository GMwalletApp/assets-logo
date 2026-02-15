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
  chains: string;
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

async function saveLogoFile(hash: string): Promise<string> {
  const logoFile = `${hash}.png`;
  const destDir = join(OVERRIDES_DIR, 'common');
  const destPath = join(destDir, logoFile);

  mkdirSync(destDir, { recursive: true });

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

type ChainScope = 'all' | 'single' | 'multiple';

function parseChainsInput(input: string): { scope: ChainScope, chains: string[] } {
  const trimmed = input.trim().toUpperCase();

  if (trimmed === 'ALL') {
    return { scope: 'all', chains: [] };
  }

  const originalInput = input.trim();
  if (originalInput.includes(',')) {
    const chains = originalInput.split(',').map(s => s.trim()).filter(Boolean);
    return { scope: 'multiple', chains };
  }

  return { scope: 'single', chains: [originalInput] };
}

async function processTokenBySymbol(
  symbol: string,
  chainsInput: string,
  logoFile: string
): Promise<ProcessResult> {
  const symbolsMap = loadSymbolsMap();
  const normalizedSymbol = symbol.toUpperCase().trim();
  const symbolChains = symbolsMap.get(normalizedSymbol);

  if (!symbolChains || symbolChains.length === 0) {
    return {
      success: false,
      hash: '',
      message: `Symbol "${symbol}" not found in symbols.json`,
    };
  }

  console.log(`Found ${symbolChains.length} chains for ${symbol}`);

  const { scope, chains: targetChains } = parseChainsInput(chainsInput);

  let filteredChains: SymbolChainEntry[];

  if (scope === 'all') {
    filteredChains = symbolChains;
    console.log(`Applying to all chains`);
  } else {
    filteredChains = symbolChains.filter(sc => targetChains.includes(sc.chain));
    console.log(`Applying to chains: ${targetChains.join(', ')}`);

    if (filteredChains.length === 0) {
      return {
        success: false,
        hash: '',
        message: `No matching chains found for "${chainsInput}"`,
      };
    }
  }

  const manifest = loadOverrideManifest();

  if (scope === 'all') {
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

    for (const { chain, address } of filteredChains) {
      if (!manifest.blockchains[chain]) {
        manifest.blockchains[chain] = {};
      }
      manifest.blockchains[chain][address] = logoFile;
      console.log(`Added blockchains override for ${chain}/${address}`);
    }
  }

  saveOverrideManifest(manifest);

  return {
    success: true,
    hash: logoFile.replace('.png', ''),
    message: `Token override processed: ${logoFile}`,
  };
}

async function processTokenByAddress(
  chainsInput: string,
  address: string,
  logoFile: string
): Promise<ProcessResult> {
  const { scope, chains: targetChains } = parseChainsInput(chainsInput);

  const manifest = loadOverrideManifest();

  if (!manifest.blockchains) {
    manifest.blockchains = {};
  }

  if (scope === 'all') {
    return {
      success: false,
      hash: '',
      message: 'Cannot use "*" for all chains when using Token Address mode. Use Token Symbol mode instead.',
    };
  }

  for (const chain of targetChains) {
    if (!manifest.blockchains[chain]) {
      manifest.blockchains[chain] = {};
    }
    manifest.blockchains[chain][address.toLowerCase()] = logoFile;
    console.log(`Added blockchains override for ${chain}/${address}`);
  }

  saveOverrideManifest(manifest);

  return {
    success: true,
    hash: logoFile.replace('.png', ''),
    message: `Token override processed: ${logoFile}`,
  };
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

    if (!form.chains) {
      return {
        success: false,
        hash: '',
        message: 'Chain name(s) is required',
      };
    }

    let result: ProcessResult;

    if (form.input_type === 'Token Symbol') {
      if (!form.symbol) {
        return {
          success: false,
          hash: '',
          message: 'Symbol is required for Token Symbol mode',
        };
      }

      await saveLogoFile(hash);
      result = await processTokenBySymbol(form.symbol, form.chains, logoFile);
    } else {
      if (!form.address) {
        return {
          success: false,
          hash: '',
          message: 'Address is required for Token Address mode',
        };
      }

      await saveLogoFile(hash);
      result = await processTokenByAddress(form.chains, form.address, logoFile);
    }

    if (existsSync(TEMP_LOGO)) {
      rmSync(TEMP_LOGO);
    }

    return result;

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
    chains: process.env.CHAINS || '',
    description: process.env.DESCRIPTION || undefined,
    issue_number: process.env.ISSUE_NUMBER || undefined,
  };

  console.log('Processing token override...');
  console.log(`Input Type: ${form.input_type}`);
  console.log(`Chains: ${form.chains}`);

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
