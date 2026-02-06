# assets-logo

Cryptocurrency logo repository with hash-based naming for unlimited caching.

## Features

- **Content-hash naming**: Logo files are named by their content hash, enabling unlimited CDN caching
- **TrustWallet integration**: Automatically syncs logos from TrustWallet assets repository
- **Override system**: Custom logos can override default ones via GitHub Issues
- **Symbol mapping**: Complete symbol-to-address mapping for easy token lookup
- **GitHub Actions**: Automated workflows for syncing and override management

## Architecture

```
assets-logo/
├── default.json              # Raw logo data from TrustWallet (no overrides)
├── symbols.json             # Symbol → chain+address mapping (9539 symbols)
├── overrides/              # Custom override rules and files
│   ├── common/            # Common logos (shared across chains)
│   ├── blockchains/       # Chain-specific override logos
│   └── override.json     # Override rules configuration
├── .metadata/
│   └── manifests/
│       └── latest.json   # Final manifest with full paths (for frontend)
├── blockchains/           # Actual logo files (synced from TrustWallet)
│   └── {chain}/
│       └── {hash}.png
└── .trustwallet/         # Cloned Trust Wallet repository (auto-managed)
```

## Core Concepts

### Default Logos

Default logos are synced from the [TrustWallet/assets](https://github.com/trustwallet/assets) repository. These are the source of truth for all token logos.

### Overrides System

The override system allows you to replace default logos with custom ones. There are two types:

| Type | Location | Purpose |
|------|----------|---------|
| **Common** | `overrides/common/` | Shared logos for cross-chain tokens (e.g., USDT on all chains) |
| **Blockchains** | `overrides/blockchains/{chain}/` | Chain-specific overrides |

### Override Resolution Order

When resolving a logo, the system checks in this order:

1. `overrides/common/` (symbol-based cross-chain)
2. `overrides/blockchains/` (specific chain+address)
3. `blockchains/` (default from TrustWallet)

## Files

### default.json

Raw logo data from TrustWallet without any overrides. This file maps chains and token addresses to their logo hashes.

**Format:**
```json
{
  "version": "2026-02-06-03",
  "updatedAt": "2026-02-06T14:36:23.613Z",
  "logos": {
    "ethereum": {
      "logo": "356942065ff36a87.png",
      "native": "356942065ff36a87.png",
      "0xdac17f958d2ee523a2206206994597c13d831ec7": "1c2ecfc8c08a821a.png"
    }
  }
}
```

### symbols.json

Complete mapping from token symbols to their chain+address combinations. Generated from TrustWallet's token lists.

**Format:**
```json
{
  "updatedAt": "2026-02-06T14:36:42.400Z",
  "symbols": [
    {
      "symbol": "USDT",
      "chains": [
        { "chain": "ethereum", "address": "0xdac17f958d2ee523a2206206994597c13d831ec7" },
        { "chain": "tron", "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" }
      ]
    }
  ]
}
```

### override.json

Configuration file that defines override rules. This is where you specify which logos to override.

**Format:**
```json
{
  "common": {
    "token": [
      {
        "symbol": "USDT",
        "chains": ["ethereum", "tron", "binance"],
        "logo": "a1b2c3d4e5f6g7h8.png"
      }
    ],
    "logo": {
      "ethereum": "x1y2z3a4b5c6d7e8.png"
    }
  },
  "blockchains": {
    "ethereum": {
      "native": "p2o3i4u5y6t7r8e9.png",
      "0xdac17f958d2ee523a2206206994597c13d831ec7": "w3e4r5t6y7u8i9o0.png"
    }
  }
}
```

**Sections:**

| Section | Field | Description |
|---------|-------|-------------|
| `common.token` | `symbol` | Token symbol (e.g., "USDT") |
| | `chains` | Array of chains or `["*"]` for all chains |
| | `logo` | Filename in `overrides/common/` |
| `common.logo` | `{chain}` | Chain name → logo filename |
| `blockchains` | `{chain}` | Chain-specific overrides |
| | `{address}` | Token address → logo filename |

### .metadata/manifests/latest.json

The final manifest used by frontends. Contains full paths and combines defaults with overrides.

**Format:**
```json
{
  "version": "2026-02-06-03",
  "updatedAt": "2026-02-06T14:41:25.453Z",
  "logos": {
    "ethereum": {
      "logo": "blockchains/ethereum/356942065ff36a87.png",
      "native": "blockchains/ethereum/356942065ff36a87.png",
      "0xdac17f958d2ee523a2206206994597c13d831ec7": "common/usdt-custom.png"
    }
  }
}
```

## GitHub Issue Override

You can submit logo overrides via GitHub Issues using the **Logo Override** template.

### Issue Template Fields

| Field | Type | Description |
|-------|------|-------------|
| `Input Type` | dropdown | Choose "Token Symbol" or "Token Address" |
| `Token Symbol` | input | Token symbol (e.g., USDT) - for Symbol mode |
| `Token Address` | input | Contract address - for Address mode |
| `Chain Scope` | dropdown | Single Chain / All Chains / Multiple Chains |
| `Chain Name` | input | Single chain name - for Single Chain scope |
| `Chain Names` | input | Comma-separated chains - for Multiple Chains scope |
| `Description` | textarea | Optional description |

### How It Works

1. **Create Issue** → Fill out the form and upload your custom logo
2. **Auto-Processing** → Workflow downloads image, calculates hash
3. **PR Created** → Pull request is created with override rules
4. **Merge** → When PR is merged, `on-merge-override.yml` triggers
5. **Manifest Updated** → Final manifest is regenerated with overrides

### Example: Override USDT on All Chains

```
Input Type: Token Symbol
Token Symbol: USDT
Chain Scope: All Chains
```

This will create a PR that overrides USDT logo on **all chains** where USDT exists.

## Commands

### Generate Default Manifest

Generate `default.json` from TrustWallet data:

```bash
bun run generate:default
```

### Generate Symbol Mapping

Generate `symbols.json` from TrustWallet data:

```bash
bun run generate:symbols
```

### Apply Overrides

Apply override rules and generate final manifest:

```bash
bun run apply:overrides
```

### Sync All

Run all generation steps:

```bash
bun run sync:all
```

### Type Check

Run TypeScript type checking:

```bash
bun run typecheck
```

## GitHub Actions Workflows

### process-override-issue.yml

Triggers when a new/edited Issue has "override" or "logo" label.

**Steps:**
1. Parse issue form data
2. Download attached image
3. Calculate content hash
4. Update `override.json`
5. Create PR

### on-merge-override.yml

Triggers on PR merge when `overrides/`, `default.json`, or `symbols.json` changes.

**Steps:**
1. Check if TrustWallet has updates
2. Regenerate `default.json` and `symbols.json` (if needed)
3. Apply overrides
4. Update final manifest

## CDN Usage

### Base URL

```
https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest/
```

### Logo URL Format

```
{baseUrl}{path}
```

**Examples:**

| Type | URL |
|------|-----|
| Ethereum native | `https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest/blockchains/ethereum/a1b2c3d4e5f6g7h8.png` |
| Ethereum USDT | `https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest/blockchains/ethereum/1c2ecfc8c08a821a.png` |
| Override common | `https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest/common/usdt-custom.png` |

### Frontend Integration

```typescript
const CDN_BASE = 'https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest';

interface ChainManifest {
  logo?: string;
  native?: string;
  [address: string]: string | undefined;
}

interface LogoManifest {
  version: string;
  updatedAt: string;
  logos: Record<string, ChainManifest>;
}

async function getLogoUrl(chain: string, address: string): Promise<string | null> {
  const manifest = await fetch(`${CDN_BASE}/.metadata/manifests/latest.json`)
    .then(r => r.json()) as LogoManifest;
  
  const chainData = manifest.logos[chain];
  if (!chainData) return null;
  
  const path = chainData[address.toLowerCase()] || chainData.native;
  if (!path) return null;
  
  return `${CDN_BASE}/${path}`;
}

// Usage
const url = await getLogoUrl('ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7');
// Returns: "https://cdn.jsdmirror.com/gh/GMwalletApp/assets-logo@latest/blockchains/ethereum/1c2ecfc8c08a821a.png"
```

## Adding a New Override via GitHub Issue

### Step 1: Create Issue

1. Go to repository Issues → New Issue
2. Select **Logo Override** template
3. Fill in the form:
   - **Input Type**: Token Symbol (or Token Address)
   - **Token Symbol**: USDT
   - **Chain Scope**: All Chains (or specific chains)
   - **Upload**: Drag & drop your logo image (PNG, max 256KB)
4. Submit Issue

### Step 2: Review PR

The workflow will:
1. Download your image
2. Calculate SHA256 hash
3. Generate override rules
4. Create a PR

### Step 3: Merge

When the PR is merged, the final manifest will be updated automatically.

## Supported Chains

This repository includes logos for 184+ chains including:

- Ethereum, Arbitrum, Optimism, Base
- BSC, Polygon, Avalanche
- Solana, Tron, Ton
- And many more...

## Environment Variables (GitHub Actions)

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token for creating PRs |
| `GITHUB_OWNER` | Repository owner |
| `GITHUB_REPO` | Repository name |

## License

MIT
