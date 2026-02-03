# assets-logo

Cryptocurrency logo repository with hash-based naming for unlimited caching.

## Features

- **Content-hash naming**: Logo files are named by their content hash, enabling unlimited caching
- **Provider abstraction**: Support multiple logo sources (Trust Wallet, custom, etc.)
- **Override support**: Custom logos can override the default ones
- **Deprecation tracking**: Track rejected logo updates to avoid duplicate notifications
- **GitHub Actions**: Automated PR/Issue creation for logo updates

## Architecture

```
scripts/
├── interfaces/
│   └── provider.ts          # LogoProvider interface
├── providers/
│   ├── index.ts             # Provider factory
│   └── trustwallet.ts       # TrustWallet implementation
├── check-updates.ts         # Check for updates (uses provider)
├── sync-logos.ts            # Sync logos (uses provider)
└── deprecate.ts             # Manage deprecations
```

## LogoProvider Interface

```typescript
interface LogoProvider {
  name: string;
  description: string;
  
  initialized(): boolean;
  sync(options?: SyncOptions): Promise<void>;
  getLogoPath(chain: string, address: string): string;
  logoExists(chain: string, address: string): boolean;
  readLogo(chain: string, address: string): Uint8Array | null;
  getLogoHash(chain: string, address: string): Promise<string | null>;
}
```

## Adding a New Provider

1. Create `scripts/providers/custom.ts`:

```typescript
import type { LogoProvider } from '../interfaces/provider.js';

export class CustomProvider implements LogoProvider {
  readonly name = 'custom';
  readonly description = 'Custom logo source';
  
  // Implement all interface methods...
}
```

2. Register in `scripts/providers/index.ts`:

```typescript
class DefaultProviderFactory implements ProviderFactory {
  constructor() {
    this.providers.set('trustwallet', new TrustWalletProvider());
    this.providers.set('custom', new CustomProvider()); // Add this
  }
}
```

3. Use via environment variable:

```bash
LOGO_PROVIDER=custom bun run check
```

## Quick Start

```bash
# Check for updates (automatically syncs provider if needed)
bun run check

# Sync logos (automatically syncs provider if needed)
bun run sync:dry-run  # Preview
bun run sync          # Execute

# Output as JSON
bun run check:json
```

## Commands

### Check for Updates

```bash
bun run check
bun run check ethereum
bun run check:json
```

### Sync Logos

```bash
bun run sync:dry-run  # Preview changes
bun run sync          # Execute sync
bun run sync ethereum # Sync specific chains
```

### Manage Deprecations

```bash
bun run deprecate:list
bun run deprecate ethereum 0x123... --hash abc123 --reason "quality issues"
bun run deprecate ethereum 0x123... --check
bun run deprecate ethereum 0x123... --revoke
```

## Directory Structure

```
assets-logo/
├── .trustwallet/            # Cloned Trust Wallet repository (auto-managed)
│   └── blockchains/
├── .metadata/
│   └── manifests/
│       └── latest.json      # Logo hash manifest
├── .overrides/
│   └── manifest.json        # Override logo manifest
├── .deprecations/
│   └── deprecations.json    # Rejected logo updates
├── overrides/               # Custom override logos
│   └── ethereum/
│       └── native/
│           └── logo.png
└── blockchains/             # Synced logos
    └── ethereum/
        └── native/
            └── a1b2c3d4e5f6g7h8.png
```

## GitHub Actions

### check-updates.yml

Runs weekly (Sunday 00:00) to check for logo updates. Creates a PR if changes are found.

```yaml
# Simply run bun run check - provider is auto-managed
- run: bun run check
```

### sync-notify.yml

Manually triggered workflow to sync logos and send email notifications.

```yaml
- run: bun run sync
```

## Logo URL Format

```
https://raw.githubusercontent.com/<owner>/<repo>/main/blockchains/<chain>/<address>/<hash>.png
```

Example:
```
https://raw.githubusercontent.com/my-org/assets-logo/main/blockchains/ethereum/native/a1b2c3d4e5f6g7h8.png
```

## Frontend Integration

```typescript
const BASE_URL = process.env.LOGO_CDN_URL || 
  'https://raw.githubusercontent.com/my-org/assets-logo/main';

interface LogoManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, string>;
}

async function getLogoUrl(chain: string, address: string): Promise<string | null> {
  const manifest = await fetch(`${BASE_URL}/.metadata/manifests/latest.json`).then(r => r.json());
  const hash = manifest.logos[`${chain}/${address}`];
  return hash ? `${BASE_URL}/blockchains/${chain}/${address}/${hash}.png` : null;
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LOGO_PROVIDER` | Logo provider to use (default: trustwallet) |
| `GITHUB_TOKEN` | GitHub API token for creating PRs |
| `GITHUB_OWNER` | Repository owner (org or username) |
| `GITHUB_REPO` | Repository name |
| `SMTP_*` | Email notification settings (optional) |
| `LOGO_CDN_URL` | Base CDN URL (optional) |

## License

MIT
