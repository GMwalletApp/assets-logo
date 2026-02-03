import { computeFileHash, fetchWithTimeout } from './hash.js';
import type { RemoteLogoResult } from '../types/index.js';

const TRUST_WALLET_RAW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const TRUST_WALLET_API = 'https://api.github.com/repos/trustwallet/assets/contents/blockchains';

const DEFAULT_CHAINS = [
  'ethereum',
  'smartchain',
  'polygon',
  'optimism',
  'arbitrum',
  'base',
  'avalanchec',
  'fantom',
  'avalanche',
] as const;

export function getLogoUrl(chain: string, address: string): string {
  const isNative = address.toLowerCase() === 'native';
  return isNative
    ? `${TRUST_WALLET_RAW}/${chain}/info/logo.png`
    : `${TRUST_WALLET_RAW}/${chain}/assets/${address}/logo.png`;
}

export async function fetchRemoteLogo(
  chain: string,
  address: string
): Promise<RemoteLogoResult> {
  const url = getLogoUrl(chain, address);

  try {
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      return { exists: false, url };
    }

    const content = new Uint8Array(await response.arrayBuffer());
    const hash = await computeFileHash(content);

    return { exists: true, content, hash, url };
  } catch {
    return { exists: false, url };
  }
}

export async function fetchTokenList(chain: string): Promise<string[]> {
  const url = `${TRUST_WALLET_API}/${chain}/assets`;

  try {
    const response = await fetchWithTimeout(url, 30000);

    if (!response.ok) {
      console.error(`Failed to fetch token list for ${chain}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item: any) => item.type === 'dir')
      .map((item: any) => item.name);
  } catch (error) {
    console.error(`Error fetching token list for ${chain}:`, error);
    return [];
  }
}

export function getDefaultChains(): string[] {
  return [...DEFAULT_CHAINS];
}
