import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LogoProvider, InitOptions } from '../interfaces/provider.js';

interface TokenInfo {
  symbol?: string;
  name?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRUSTWALLET_DIR = join(__dirname, '../../.trustwallet');
const TRUSTWALLET_REPO = 'https://github.com/trustwallet/assets.git';

interface TokenListEntry {
  chainId?: number;
  asset?: string;
  type?: string;
  address: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
}

interface TokenList {
  name?: string;
  logoURI?: string;
  timestamp?: string;
  tokens: TokenListEntry[];
}

export interface ChainInfo {
  name: string;
  symbol: string;
  logo?: Uint8Array;
}

export interface TokenLogoInfo {
  address: string;
  logo: Uint8Array;
  symbol?: string;
  name?: string;
}

export interface ChainLogoData {
  chain: ChainInfo;
  native: TokenLogoInfo | null;
  tokens: TokenLogoInfo[];
}

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
   * Get token info (symbol, name) from tokenlist.json or info.json
   */
  async getTokenInfo(chain: string, address: string): Promise<TokenInfo | null> {
    if (address.toLowerCase() === 'native') {
      const infoPath = join(TRUSTWALLET_DIR, 'blockchains', chain, 'info', 'info.json');
      if (existsSync(infoPath)) {
        try {
          const content = readFileSync(infoPath, 'utf-8');
          const info = JSON.parse(content);
          return {
            symbol: info.symbol,
            name: info.name,
          };
        } catch {
          return null;
        }
      }
      return null;
    }

    // First try to get from tokenlist.json
    const tokenlistPath = join(TRUSTWALLET_DIR, 'blockchains', chain, 'tokenlist.json');
    if (existsSync(tokenlistPath)) {
      try {
        const content = readFileSync(tokenlistPath, 'utf-8');
        const tokenlist = JSON.parse(content) as TokenList;
        const normalizedAddress = address.toLowerCase();
        const entry = tokenlist.tokens.find(
          (t) => t.address.toLowerCase() === normalizedAddress
        );
        if (entry) {
          return {
            symbol: entry.symbol,
            name: entry.name,
          };
        }
      } catch {
        // Continue to try info.json
      }
    }

    // Fallback to individual info.json
    const infoPath = join(
      TRUSTWALLET_DIR,
      'blockchains',
      chain,
      'assets',
      address,
      'info.json'
    );
    if (existsSync(infoPath)) {
      try {
        const content = readFileSync(infoPath, 'utf-8');
        const info = JSON.parse(content);
        return {
          symbol: info.symbol,
          name: info.name,
        };
      } catch {
        return null;
      }
    }

    return null;
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

  /**
   * Get chain info (symbol, name) from info.json
   */
  async getChainInfo(chain: string): Promise<ChainInfo | null> {
    const infoPath = join(TRUSTWALLET_DIR, 'blockchains', chain, 'info', 'info.json');
    const logoPath = join(TRUSTWALLET_DIR, 'blockchains', chain, 'info', 'logo.png');

    if (!existsSync(infoPath)) {
      return null;
    }

    try {
      const content = readFileSync(infoPath, 'utf-8');
      const info = JSON.parse(content);
      let logo: Uint8Array | undefined;
      
      if (existsSync(logoPath)) {
        logo = readFileSync(logoPath);
      }

      return {
        name: info.name,
        symbol: info.symbol,
        logo,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get chain logo as Uint8Array
   */
  async getChainLogo(chain: string): Promise<Uint8Array | null> {
    const logoPath = join(TRUSTWALLET_DIR, 'blockchains', chain, 'info', 'logo.png');
    
    if (!existsSync(logoPath)) {
      return null;
    }

    return readFileSync(logoPath);
  }

  /**
   * Get all logos for a chain (chain logo + native + tokens)
   * Returns data in flat format for the new manifest structure
   */
  async getChainLogos(chain: string): Promise<ChainLogoData | null> {
    const chainDir = join(TRUSTWALLET_DIR, 'blockchains', chain);
    
    if (!existsSync(chainDir)) {
      return null;
    }

    const chainInfo = await this.getChainInfo(chain);
    if (!chainInfo) {
      return null;
    }

    // Get native token
    const nativeLogoPath = join(chainDir, 'info', 'logo.png');
    let native: TokenLogoInfo | null = null;
    
    if (existsSync(nativeLogoPath)) {
      native = {
        address: 'native',
        logo: readFileSync(nativeLogoPath),
        symbol: chainInfo.symbol,
        name: chainInfo.name,
      };
    }

    // Get all token logos
    const tokens: TokenLogoInfo[] = [];
    const assetsDir = join(chainDir, 'assets');
    
    if (existsSync(assetsDir)) {
      const entries = await fs.readdir(assetsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const tokenLogoPath = join(assetsDir, entry.name, 'logo.png');
          
          if (existsSync(tokenLogoPath)) {
            const tokenInfo = await this.getTokenInfo(chain, entry.name);
            tokens.push({
              address: entry.name.toLowerCase(),
              logo: readFileSync(tokenLogoPath),
              symbol: tokenInfo?.symbol,
              name: tokenInfo?.name,
            });
          }
        }
      }
    }

    return {
      chain: chainInfo,
      native,
      tokens,
    };
  }

  /**
   * List all chains that have logos
   */
  async listChains(): Promise<string[]> {
    const blockchainsDir = join(TRUSTWALLET_DIR, 'blockchains');
    
    if (!existsSync(blockchainsDir)) {
      return [];
    }

    const chains: string[] = [];
    const entries = readdirSync(blockchainsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const chainDir = join(blockchainsDir, entry.name);
        const infoPath = join(chainDir, 'info', 'logo.png');
        const assetsDir = join(chainDir, 'assets');
        
        // Chain has logo if info/logo.png exists or has any tokens
        if (existsSync(infoPath)) {
          chains.push(entry.name);
        } else if (existsSync(assetsDir)) {
          const hasTokens = readdirSync(assetsDir).some(name => {
            return existsSync(join(assetsDir, name, 'logo.png'));
          });
          if (hasTokens) {
            chains.push(entry.name);
          }
        }
      }
    }

    return chains;
  }
}
