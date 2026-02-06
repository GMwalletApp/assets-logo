import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GitHubIssueAttachment {
  id: number;
  filename: string;
  size: number;
  url: string;
}

async function downloadIssueAttachment(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/attachments`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.mockingbird-preview+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch attachments: ${response.statusText}`);
  }
  
  const attachments = await response.json() as GitHubIssueAttachment[];
  
  if (attachments.length === 0) {
    throw new Error('No attachments found in issue');
  }
  
  const imageAttachment = attachments.find(a => 
    a.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)
  );
  
  if (!imageAttachment) {
    throw new Error('No image attachment found. Please upload a PNG, JPG, or GIF image.');
  }
  
  const downloadResponse = await fetch(imageAttachment.url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/octet-stream'
    }
  });
  
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download attachment: ${downloadResponse.statusText}`);
  }
  
  const buffer = await downloadResponse.arrayBuffer();
  const destPath = join(__dirname, '../temp_logo.png');
  
  await writeFile(destPath, Buffer.from(buffer));
  
  console.log(`Downloaded attachment to ${destPath}`);
  return destPath;
}

async function main() {
  const repoParts = process.env.GITHUB_REPOSITORY?.split('/') || [];
  const owner = repoParts[0] || '';
  const repo = repoParts[1] || '';
  const issueNumber = parseInt(process.env.ISSUE_NUMBER || '0');
  
  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY is not set correctly');
  }
  
  if (!issueNumber) {
    throw new Error('ISSUE_NUMBER is not set');
  }
  
  await downloadIssueAttachment(owner, repo, issueNumber);
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
