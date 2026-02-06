import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { computeFileHash } from './utils/hash.js';
import { loadOverridesManifest, saveOverridesManifest } from './utils/overrides.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../overrides');
const TEMP_LOGO = join(__dirname, '../temp_logo.png');

interface ProcessResult {
  success: boolean;
  chain: string;
  address: string;
  hash: string;
  message: string;
}

async function processIssueLogo(
  chain: string,
  address: string,
  description?: string,
  issueNumber?: string
): Promise<ProcessResult> {
  if (!chain || !address) {
    return {
      success: false,
      chain: chain || '',
      address: address || '',
      hash: '',
      message: 'Missing chain or address'
    };
  }

  if (!existsSync(TEMP_LOGO)) {
    return {
      success: false,
      chain,
      address,
      hash: '',
      message: 'Logo file not found'
    };
  }

  try {
    const hash = await computeFileHash(TEMP_LOGO);
    
    const overrideDir = join(OVERRIDES_DIR, chain, address);
    mkdirSync(overrideDir, { recursive: true });
    
    const destPath = join(overrideDir, `${hash}.png`);
    
    if (existsSync(overrideDir)) {
      const existingFiles = readdirSync(overrideDir).filter(f => f.endsWith('.png'));
      for (const file of existingFiles) {
        if (file !== `${hash}.png`) {
          rmSync(join(overrideDir, file));
        }
      }
    }
    
    renameSync(TEMP_LOGO, destPath);
    
    const manifest = loadOverridesManifest();
    manifest.logos[`${chain}/${address}`] = {
      chain,
      address,
      hash,
      source: 'issue-override',
      description,
      lastModified: new Date().toISOString(),
      issueNumber
    };
    manifest.updatedAt = new Date().toISOString();
    
    saveOverridesManifest(manifest);
    
    if (existsSync(TEMP_LOGO)) {
      rmSync(TEMP_LOGO);
    }
    
    return {
      success: true,
      chain,
      address,
      hash,
      message: `Logo override processed: ${chain}/${address}/${hash}.png`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      chain,
      address,
      hash: '',
      message: `Error processing logo: ${errorMessage}`
    };
  }
}

async function main() {
  const chain = process.env.CHAIN || '';
  const address = process.env.ADDRESS || '';
  const description = process.env.DESCRIPTION || undefined;
  const issueNumber = process.env.ISSUE_NUMBER || undefined;
  
  console.log(`Processing logo override for ${chain}/${address}...`);
  
  const result = await processIssueLogo(chain, address, description, issueNumber);
  
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
