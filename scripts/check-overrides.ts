import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { computeFileHash } from './utils/hash.js';
import { loadOverridesManifest, listOverrides } from './utils/overrides.js';

interface OverrideChange {
  chain: string;
  address: string;
  oldHash: string;
  newHash: string;
  source: string;
  hasUpdate: boolean;
}

async function checkOverrides(): Promise<OverrideChange[]> {
  const manifest = loadOverridesManifest();
  const overrides = listOverrides();
  const changes: OverrideChange[] = [];

  console.log(`Checking ${overrides.length} override(s)...`);

  for (const { key, info } of overrides) {
    const logoPath = join(__dirname, `../overrides/${info.chain}/${info.address}/${info.hash}.png`);

    if (!existsSync(logoPath)) {
      console.log(`  [MISSING] ${key}: logo file not found`);
      continue;
    }

    const newHash = await computeFileHash(logoPath);

    if (newHash !== info.hash) {
      changes.push({
        chain: info.chain,
        address: info.address,
        oldHash: info.hash,
        newHash,
        source: info.source,
        hasUpdate: true,
      });
      console.log(`  [UPDATE] ${key}: ${info.hash} -> ${newHash} (${info.source})`);
    } else {
      console.log(`  [OK] ${key}`);
    }
  }

  return changes;
}

async function main() {
  const changes = await checkOverrides();

  console.log(`\n=== Summary ===`);
  if (changes.length > 0) {
    console.log(`Found ${changes.length} override(s) with updates:`);
    for (const change of changes) {
      console.log(`  - ${change.chain}/${change.address}: ${change.oldHash} -> ${change.newHash}`);
    }
    console.log('\nNote: Override updates should be reviewed via GitHub Issue');
  } else {
    console.log('No override updates found');
  }

  return changes;
}

main().catch(console.error);
