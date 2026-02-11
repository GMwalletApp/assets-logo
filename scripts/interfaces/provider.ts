export interface TokenInfo {
  symbol?: string;
  name?: string;
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

export interface InitOptions {
  force?: boolean;
}

export interface LogoProvider {
  name: string;
  description: string;

  /**
   * Initialize the provider (e.g., git clone/pull)
   * @param options - Options for initialization
   */
  init(options?: InitOptions): Promise<void>;

  /**
   * Check if the provider is initialized
   * @returns true if initialized, false otherwise
   */
  initialized(): boolean;

  /**
   * List all available logos
   * @param filter - Chains to include. null/undefined = all chains, string[] = specific chains
   * @returns Record mapping chain names to arrays of token addresses
   * @example
   * // Get all logos
   * await listLogos();
   * // Returns: { "ethereum": ["native", "0xdAC17..."], "bsc": ["native"] }
   *
   * // Get only specific chains
   * await listLogos(["ethereum", "bsc"]);
   * // Returns: { "ethereum": [...], "bsc": [...] }
   */
  listLogos(filter?: string[] | null): Promise<Record<string, string[]>>;

  /**
   * Get a logo file by chain and address
   * @param chain - The blockchain name (e.g., "ethereum")
   * @param address - The token address or "native" for native tokens
   * @returns The logo file content as Uint8Array, or null if not found
   */
  getFile(chain: string, address: string): Promise<Uint8Array | null>;

  /**
   * Get token metadata (symbol, name)
   * @param chain - The blockchain name
   * @param address - The token address or "native"
   * @returns Token info with symbol and name, or null if not found
   */
  getTokenInfo(chain: string, address: string): Promise<TokenInfo | null>;

  /**
   * Get chain info (symbol, name) from info.json
   */
  getChainInfo(chain: string): Promise<ChainInfo | null>;

  /**
   * Get chain logo as Uint8Array
   */
  getChainLogo(chain: string): Promise<Uint8Array | null>;

  /**
   * Get all logos for a chain (chain logo + native + tokens)
   */
  getChainLogos(chain: string): Promise<ChainLogoData | null>;

  /**
   * List all chains that have logos
   */
  listChains(): Promise<string[]>;
}

export interface ProviderFactory {
  create(name: string): LogoProvider;
  getDefaultProvider(): LogoProvider;
  listProviders(): string[];
}
