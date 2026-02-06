import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { computeFileHash } from './utils/hash.js';
import type { OverrideManifest } from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../overrides');
const OVERRIDE_JSON_PATH = join(OVERRIDES_DIR, 'override.json');
const TEMP_LOGO = join(__dirname, '../temp_logo.png');

interface ChainIssueForm {
  chain_name: string;
  description?: string;
  issue_number?: string;
}

interface ProcessResult {
  success: boolean;
  hash: string;
  message: string;
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

async function processChain(
  chainName: string,
  logoFile: string
): Promise<ProcessResult> {
  const manifest = loadOverrideManifest();

  if (!manifest.common.logo) {
    manifest.common.logo = {};
  }

  const normalizedChain = chainName.toLowerCase().trim();
  manifest.common.logo[normalizedChain] = logoFile;

  console.log(`Added common.logo override for chain: ${normalizedChain}`);

  saveOverrideManifest(manifest);

  return {
    success: true,
    hash: logoFile.replace('.png', ''),
    message: `Chain logo override processed: ${logoFile} for ${chainName}`,
  };
}

async function processIssue(form: ChainIssueForm): Promise<ProcessResult> {
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

    console.log(`Processing chain logo override...`);
    console.log(`Logo hash: ${hash}`);

    if (!form.chain_name) {
      return {
        success: false,
        hash: '',
        message: 'Chain name is required',
      };
    }

    await saveLogoFile(hash);
    const result = await processChain(form.chain_name, logoFile);

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
  const form: ChainIssueForm = {
    chain_name: process.env.CHAIN_NAME || '',
    description: process.env.DESCRIPTION || undefined,
    issue_number: process.env.ISSUE_NUMBER || undefined,
  };

  console.log('Processing chain logo override...');
  console.log(`Chain Name: ${form.chain_name}`);

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
