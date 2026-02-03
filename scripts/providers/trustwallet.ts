import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogoProvider, InitOptions } from '../interfaces/provider.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRUSTWALLET_DIR = join(__dirname, '../../.trustwallet');
const TRUSTWALLET_REPO = 'https://github.com/trustwallet/assets.git';

/**
 * TrustWallet implementation of LogoProvider
 * Uses local cloned trustwallet/assets repository
 */
export class TrustWalletProvider implements LogoProvider {
  readonly name = 'trustwallet';
  readonly description = 'Trust Wallet Assets Repository';

  initialized(): boolean {
    return existsSync(join(TRUSTWALLET_DIR, '.git'));
  }

  async init(options: InitOptions = {}): Promise<void> {
    if (this.initialized()) {
      console.log('Trust Wallet repository already exists. Updating...');

      if (options.force) {
        console.log('Force mode: removing and re-cloning...');
        execSync(`rm -rf "${TRUSTWALLET_DIR}"`, { stdio: 'inherit' });
        execSync(`git clone --depth 1 ${TRUSTWALLET_REPO} "${TRUSTWALLET_DIR}"`, {
          stdio: 'inherit',
        });
      } else {
        execSync(
          `cd "${TRUSTWALLET_DIR}" && git fetch origin main && git reset --hard origin/main`,
          { stdio: 'inherit' }
        );
      }
    } else {
      console.log('Cloning Trust Wallet repository...');
      execSync(`git clone --depth 1 ${TRUSTWALLET_REPO} "${TRUSTWALLET_DIR}"`, {
        stdio: 'inherit',
      });
    }

    console.log('Trust Wallet repository is up to date.');
  }

  /**
   * Get all available logos, optionally filtered by chains
   * @param filter - Chains to include. null/undefined = all chains, string[] = specific chains
   * @returns Record mapping chain names to arrays of token addresses
   */
  async listLogos(filter?: string[] | null): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    const blockchainsDir = join(TRUSTWALLET_DIR, 'blockchains');

    if (!existsSync(blockchainsDir)) {
      return result;
    }

    // Get chains to scan
    const chains = this.getChainsToScan(filter);

    for (const chain of chains) {
      const chainDir = join(blockchainsDir, chain);
      if (!existsSync(chainDir)) {
        continue;
      }

      const tokens: string[] = [];

      // Add native token if info/logo.png exists
      const nativeLogoPath = join(chainDir, 'info', 'logo.png');
      if (existsSync(nativeLogoPath)) {
        tokens.push('native');
      }

      // Scan assets directory
      const assetsDir = join(chainDir, 'assets');
      if (existsSync(assetsDir)) {
        const entries = await fs.readdir(assetsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const tokenLogoPath = join(assetsDir, entry.name, 'logo.png');
            if (existsSync(tokenLogoPath)) {
              tokens.push(entry.name);
            }
          }
        }
      }

      if (tokens.length > 0) {
        result[chain] = tokens;
      }
    }

    return result;
  }

  /**
   * Get a logo file by chain and address
   * @param chain - The blockchain name
   * @param address - The token address or "native"
   * @returns The logo file content, or null if not found
   */
  async getFile(chain: string, address: string): Promise<Uint8Array | null> {
    const isNative = address.toLowerCase() === 'native';
    const logoPath = isNative
      ? join(TRUSTWALLET_DIR, 'blockchains', chain, 'info', 'logo.png')
      : join(TRUSTWALLET_DIR, 'blockchains', chain, 'assets', address, 'logo.png');

    if (!existsSync(logoPath)) {
      return null;
    }

    return readFileSync(logoPath);
  }

  /**
   * Determine which chains to scan based on filter
   * @param filter - null/undefined = all, string[] = specific chains
   * @returns Array of chain names to scan
   */
  private getChainsToScan(filter?: string[] | null): string[] {
    if (filter === null || filter === undefined) {
      // Return all chains from trustwallet
      const blockchainsDir = join(TRUSTWALLET_DIR, 'blockchains');
      if (!existsSync(blockchainsDir)) {
        return [];
      }
      const entries = readdirSync(blockchainsDir, { withFileTypes: true });
      return entries.filter((e: any) => e.isDirectory()).map(e => e.name);
    }

    // Filter is an array of specific chains
    return filter;
  }
}
