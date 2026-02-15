# Override Configuration

This document describes how to configure logo overrides.

## Architecture

```
project/
├── default.json              # Raw data from trustwallet (no overrides)
├── symbols.json             # Symbol → chain+address mapping
├── overrides/
│   ├── common/              # Common logos (shared across chains)
│   ├── blockchains/          # Chain-specific overrides
│   └── override.json         # Override rules
└── .metadata/
    └── manifests/
        └── latest.json      # Final manifest with full paths (for frontend)
```

## Files

| File | Purpose |
|------|---------|
| `default.json` | Raw logo data from trustwallet (hash only, no overrides) |
| `symbols.json` | Symbol → chain+address mapping (9539 symbols) |
| `overrides/override.json` | Your custom override rules |
| `.metadata/manifests/latest.json` | Final result with full paths |

## GitHub Issue Override

You can submit logo overrides via GitHub Issues using the **Logo Override** template.

### Issue Template Fields

| Field | Type | Description |
|-------|------|------------|
| `Input Type` | dropdown | Choose "Token Symbol" or "Token Address" |
| `Token Symbol` | input | Token symbol (e.g., USDT, USDC) - for Symbol mode |
| `Token Address` | input | Contract address - for Address mode |
| `Chain Scope` | dropdown | Single Chain / All Chains / Multiple Chains |
| `Chain Name` | input | Single chain name - for Single Chain scope |
| `Chain Names` | input | Comma-separated chains - for Multiple Chains scope |
| `Description` | textarea | Optional description |

### How It Works

1. **Create Issue** → Fill out the form and upload logo
2. **Auto-Processing** → Workflow downloads image, calculates hash
3. **PR Created** → Pull request is created with override rules
4. **Merge** → When PR is merged, `on-merge-override.yml` triggers
5. **Manifest Updated** → Final manifest is regenerated with overrides

### Input Type Examples

#### Using Token Symbol

```
Input Type: Token Symbol
Token Symbol: USDT
Chain Scope: All Chains
```

This will override USDT logo on **all chains**.

#### Using Token Address

```
Input Type: Token Address
Token Address: 0xdac17f958d2ee523a2206206994597c13d831ec7
Chain Scope: Single Chain
Chain Name: ethereum
```

This will override the specific token on ethereum.

### Workflows

#### 1. process-override-issue.yml

Triggers on new/edited issues with "override" or "logo" label.

- Downloads image from issue
- Calculates hash
- Updates override.json
- Creates PR

#### 2. on-merge-override.yml

Triggers on PR merge when overrides/ or default.json changes.

- Checks TrustWallet for updates
- Updates default.json and symbols.json (if needed)
- Applies overrides
- Updates final manifest

## override.json Format

### Structure

```json
{
  "common": {
    "token": [
      {
        "symbol": "USDT",
        "chains": ["ethereum", "binance"],
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
      "0xaaaffffff": "w3e4r5t6y7u8i9o0.png"
    }
  }
}
```

### Sections

#### 1. common.token

Override logos for tokens across multiple chains using symbol matching.

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Token symbol (e.g., "USDT") |
| `chains` | string[] | List of chains to apply, or `["ALL"]` for all chains |
| `logo` | string | Filename in `overrides/common/` |

**Example**: Override USDT on ethereum and binance chains

```json
{
  "symbol": "USDT",
  "chains": ["ethereum", "binance"],
  "logo": "usdt-custom.png"
}
```

**Example**: Override USDC on all chains

```json
{
  "symbol": "USDC",
  "chains": ["ALL"],
  "logo": "usdc-custom.png"
}
```

#### 2. common.logo

Override the chain's own logo (not native token).

| Field | Description |
|-------|-------------|
| `{chain}` | Chain name, value is filename in `overrides/common/` |

**Example**: Override Ethereum chain logo

```json
{
  "logo": {
    "ethereum": "eth-chain-logo.png"
  }
}
```

#### 3. blockchains

Override specific chain + token combinations.

| Field | Description |
|-------|-------------|
| `{chain}` | Chain name |
| `{address}` | Token address (or "native") |
| `logo` | Filename in `overrides/blockchains/{chain}/` |

**Example**: Override specific tokens

```json
{
  "blockchains": {
    "ethereum": {
      "native": "eth-logo.png",
      "0xdac17f958d2ee523a2206206994597c13d831ec7": "usdt-logo.png"
    }
  }
}
```

## Workflow

1. **Generate symbols.json** (one-time setup)
   ```bash
   bun run generate:symbols
   ```

2. **Add logo files** to overrides directory
   - Common logos: `overrides/common/{hash}.png`
   - Chain-specific: `overrides/blockchains/{chain}/{hash}.png`

3. **Create override.json** with your rules

4. **Apply overrides** to generate final manifest
   ```bash
   bun run apply:overrides
   ```

## Priority Order

When resolving a logo, the system checks in this order:

1. `overrides/common/token` (symbol-based cross-chain)
2. `overrides/common/logo` (chain logo override)
3. `overrides/blockchains` (specific chain+address)
4. `blockchains/` (default logos from trustwallet)

The final manifest in `.metadata/manifests/latest.json` will use full paths pointing to the override files:
- Override paths: `overrides/common/{hash}.png` or `overrides/blockchains/{chain}/{hash}.png`
- Default paths: `blockchains/{chain}/{hash}.png`

## Example: Complete Override Setup

### Step 1: Add custom USDT logo

```bash
# Place custom USDT logo
cp custom-usdt.png overrides/common/usdt-custom.png

# Generate hash for the file
# The hash is the first 16 characters of SHA256 hash
# e.g., a1b2c3d4e5f6g7h8
```

### Step 2: Create override.json

```json
{
  "common": {
    "token": [
      {
        "symbol": "USDT",
        "chains": ["ethereum", "tron", "binance"],
        "logo": "a1b2c3d4e5f6g7h8.png"
      }
    ]
  }
}
```

### Step 3: Apply

```bash
bun run apply:overrides
```

This will replace USDT logos on ethereum, tron, and binance chains with your custom logo.

## Notes

- Logo files must use hash-based naming: `{hash}.png`
- Use `symbols.json` to find token addresses by symbol
- The `chains` array supports `["ALL"]` to match all chains
- All addresses in override.json should be lowercase
