import { addDeprecation, removeDeprecation, listDeprecations, isDeprecated } from './utils/deprecations.js';
import { fetchRemoteLogo } from './utils/trustwallet.js';
import type { DeprecationInfo } from './types/index.js';

interface DeprecateOptions {
  chain: string;
  address: string;
  hash?: string;
  reason?: string;
  revoke?: boolean;
  list?: boolean;
  check?: boolean;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.length === 0) {
    const deprecations = listDeprecations();

    if (deprecations.length === 0) {
      console.log('No deprecations found');
      return;
    }

    console.log(`Found ${deprecations.length} deprecation(s):\n`);

    for (const { key, info } of deprecations) {
      console.log(`${key}`);
      console.log(`  Hash: ${info.rejectedHash}`);
      console.log(`  Rejected: ${info.rejectedAt}`);
      if (info.reason) {
        console.log(`  Reason: ${info.reason}`);
      }
      console.log();
    }
    return;
  }

  const options: DeprecateOptions = {
    chain: args[0] || '',
    address: args[1] || '',
  };

  const hashIndex = args.indexOf('--hash');
  const reasonIndex = args.indexOf('--reason');

  if (hashIndex !== -1 && hashIndex + 1 < args.length) {
    options.hash = args[hashIndex + 1];
  }

  if (reasonIndex !== -1 && reasonIndex + 1 < args.length) {
    options.reason = args[reasonIndex + 1];
  }

  options.revoke = args.includes('--revoke');
  options.check = args.includes('--check');

  if (!options.chain || !options.address) {
    console.error('Usage:');
    console.error('  List: bun run scripts/deprecate.ts --list');
    console.error('  Add:  bun run scripts/deprecate.ts <chain> <address> --hash <hash> [--reason "reason"]');
    console.error('  Revoke: bun run scripts/deprecate.ts <chain> <address> --revoke');
    console.error('  Check: bun run scripts/deprecate.ts <chain> <address> --check [--hash <hash>]');
    process.exit(1);
  }

  if (options.check) {
    if (options.hash) {
      const deprecated = isDeprecated(options.chain, options.address, options.hash);
      console.log(`${options.chain}/${options.address} with hash ${options.hash}: ${deprecated ? 'DEPRECATED' : 'OK'}`);
    } else {
      const remote = await fetchRemoteLogo(options.chain, options.address);
      if (remote.exists && remote.hash) {
        const deprecated = isDeprecated(options.chain, options.address, remote.hash);
        console.log(`${options.chain}/${options.address} current logo: ${deprecated ? 'DEPRECATED' : 'OK'}`);
        console.log(`  Hash: ${remote.hash}`);
      } else {
        console.log(`Logo not found for ${options.chain}/${options.address}`);
      }
    }
    return;
  }

  if (options.revoke) {
    removeDeprecation(options.chain, options.address);
    return;
  }

  if (!options.hash) {
    const remote = await fetchRemoteLogo(options.chain, options.address);
    if (!remote.exists || !remote.hash) {
      console.error('Error: Could not fetch remote logo or hash not provided');
      console.error('Please provide --hash <value> or ensure the logo exists on Trust Wallet');
      process.exit(1);
    }
    options.hash = remote.hash;
  }

  addDeprecation(
    options.chain,
    options.address,
    options.hash,
    options.reason,
    process.env.GITHUB_ACTOR || 'manual'
  );
}

main().catch(console.error);
