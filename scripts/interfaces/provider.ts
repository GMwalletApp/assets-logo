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
}

export interface ProviderFactory {
  create(name: string): LogoProvider;
  getDefaultProvider(): LogoProvider;
  listProviders(): string[];
}
