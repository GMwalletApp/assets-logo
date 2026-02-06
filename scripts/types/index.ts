export interface LogoManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, string>;
}

export interface OverrideLogoInfo {
  chain: string;
  address: string;
  hash: string;
  source: 'manual' | 'auto-sync' | 'issue-override';
  description?: string;
  lastModified: string;
  issueNumber?: string;
}

export interface OverrideManifest {
  updatedAt: string;
  logos: Record<string, OverrideLogoInfo>;
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
