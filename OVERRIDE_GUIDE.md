# Logo Override via GitHub Issue

This repository supports adding custom logo overrides through GitHub Issues.

## Usage

### Creating an Override

1. Go to the repository's Issues page
2. Click "New issue"
3. Select the **Override Logo** template
4. Fill in the required fields:
   - **Type**: Select "Override"
   - **Chain**: Blockchain name (e.g., `ethereum`, `binance-smart-chain`, `solana`)
   - **Token Address**: Contract address (use `native` for native tokens)
   - **Description**: Optional description
   - **Comment**: Additional notes
5. Upload your logo image (PNG, JPG, or GIF)
6. Confirm the checkbox
7. Submit the issue

### Automated Process

When you submit an override issue:

1. GitHub Actions automatically triggers
2. Downloads the uploaded image
3. Calculates the content hash
4. Saves as `{hash}.png` in `overrides/{chain}/{address}/`
5. Updates the manifest at `.overrides/manifest.json`
6. Creates a pull request with the changes
7. Comments on the issue with the PR link

### Example

To add an override for Ethereum USDT:

- **Chain**: `ethereum`
- **Address**: `0xdac17f958d2ee523a2206206994597c13d831ec7`

After processing, the file will be saved as:
```
overrides/ethereum/0xdac17f958d2ee523a2206206994597c13d831ec7/a1b2c3d4e5f6g7h8.png
```

### Guidelines

- Image should be square (recommended 256x256 pixels)
- Use PNG format with transparent background for best results
- Maximum file size: 256KB
- Only submit appropriate logos that follow project guidelines

## Technical Details

### Files Created

- `ISSUE_TEMPLATE/override-logo.yml` - Issue form template
- `.github/workflows/process-override-issue.yml` - Automated workflow
- `scripts/process-issue-override.ts` - Logo processing logic
- `scripts/download-issue-attachment.ts` - Issue attachment downloader

### Hash-Based Naming

Logos are named using SHA256 hash (first 16 characters) for:
- Content-addressable storage
- Unlimited caching
- Duplicate detection
