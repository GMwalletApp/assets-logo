export interface LogoManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, ChainManifest>;
}

export interface ChainManifest {
  logo?: string;
  native?: string;
  [address: string]: string | undefined;
}

export interface LogoManifestEntry {
  hash: string;
  symbol?: string;
  name?: string;
}

export interface DefaultManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, ChainManifest>;
}

export interface SymbolMapping {
  symbol: string;
  chains: {
    chain: string;
    address: string;
  }[];
}

export interface SymbolsManifest {
  updatedAt: string;
  symbols: SymbolMapping[];
}

export interface OverrideTokenRule {
  symbol: string;
  chains: string[];
  logo: string;
}

export interface OverrideLogoRule {
  [chain: string]: string;
}

export interface OverrideManifest {
  common: {
    token?: OverrideTokenRule[];
    logo?: OverrideLogoRule;
  };
  blockchains?: Record<string, ChainManifest>;
}

export interface OldOverrideLogoInfo {
  chain: string;
  address: string;
  hash: string;
  source: 'manual' | 'auto-sync' | 'issue-override';
  description?: string;
  lastModified: string;
  issueNumber?: string;
}

export interface OldOverrideManifest {
  updatedAt: string;
  logos: Record<string, OldOverrideLogoInfo>;
}

export interface DeprecationInfo {
  rejectedHash: string;
  rejectedAt: string;
  reason?: string;
  rejectedBy?: string;
}

export interface DeprecationManifest {
  [key: string]: DeprecationInfo;
}

export interface LogoChange {
  chain: string;
  address: string;
  type: 'added' | 'updated' | 'deleted';
  localHash?: string;
  remoteHash?: string;
  skipReason?: string;
}

export interface RemoteLogoResult {
  exists: boolean;
  content?: Uint8Array;
  hash?: string;
  url: string;
}

export interface SyncOptions {
  dryRun?: boolean;
  chains?: string[];
  provider?: string;
}

export interface DeprecateOptions {
  chain: string;
  address: string;
  hash: string;
  reason?: string;
}

export interface GithubPrPayload {
  title: string;
  body: string;
  head: string;
  base: string;
  changes: LogoChange[];
}

export interface EmailNotificationPayload {
  subject: string;
  to: string;
  changes: LogoChange[];
}
