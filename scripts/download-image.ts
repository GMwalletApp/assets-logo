import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function downloadImage(url: string, destPath: string): Promise<void> {
  if (!url) {
    throw new Error('Image URL is required');
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(destPath, Buffer.from(buffer));

  console.log(`Downloaded image to ${destPath}`);
}

async function main() {
  const url = process.env.IMAGE_URL;

  if (!url) {
    throw new Error('IMAGE_URL environment variable is required');
  }

  const destPath = join(__dirname, '../temp_logo.png');
  await downloadImage(url, destPath);
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
