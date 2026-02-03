import { fetchWithTimeout } from './hash.js';
import type { LogoChange, GithubPrPayload } from '../types/index.js';

const GITHUB_API = 'https://api.github.com';

interface GithubPrResponse {
  number: number;
  html_url: string;
}

interface GithubRefResponse {
  object: {
    sha: string;
  };
}

interface GithubBlobResponse {
  sha: string;
}

interface GithubTreeResponse {
  sha: string;
}

export interface GithubConfig {
  owner: string;
  repo: string;
  token: string;
}

export function getConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME || process.env.GITHUB_REPO;

  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  return {
    owner: owner || '',
    repo: repo || '',
    token,
  };
}

export async function createPullRequest(payload: GithubPrPayload): Promise<number | null> {
  const config = getConfig();
  const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/pulls`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body,
      head: payload.head,
      base: payload.base,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create PR:', error);
    return null;
  }

  const result = await response.json() as GithubPrResponse;
  console.log(`Created PR #${result.number}: ${result.html_url}`);
  return result.number;
}

export async function createBranch(branchName: string, baseBranch: string = 'main'): Promise<boolean> {
  const config = getConfig();

  const shaResponse = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/refs/heads/${baseBranch}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  if (!shaResponse.ok) {
    console.error('Failed to get base branch SHA');
    return false;
  }

  const baseData = await shaResponse.json() as GithubRefResponse;
  const sha = baseData.object.sha;

  const createResponse = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    }
  );

  return createResponse.ok;
}

export async function commitFiles(
  branch: string,
  files: { path: string; content: string }[]
): Promise<boolean> {
  const config = getConfig();

  const blobPromises = files.map(async (file) => {
    const response = await fetch(
      `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/blobs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create blob for ${file.path}`);
    }

    const blob = await response.json() as GithubBlobResponse;
    return {
      path: file.path,
      sha: blob.sha,
      mode: '100644',
      type: 'blob',
    };
  });

  const blobs = await Promise.all(blobPromises);

  const treeResponse = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: undefined,
        tree: blobs,
      }),
    }
  );

  if (!treeResponse.ok) {
    console.error('Failed to create tree');
    return false;
  }

  const tree = await treeResponse.json() as GithubTreeResponse;

  const commitResponse = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: generateCommitMessage(files.length),
        tree: tree.sha,
      }),
    }
  );

  if (!commitResponse.ok) {
    console.error('Failed to create commit');
    return false;
  }

  const commit = await commitResponse.json();

  return true;
}

function generateCommitMessage(fileCount: number): string {
  const date = new Date().toISOString().split('T')[0];
  return `Update logos - ${date}\n\nUpdated ${fileCount} logo file(s)`;
}

export function formatChangesForPrBody(changes: LogoChange[]): string {
  const added = changes.filter(c => c.type === 'added');
  const updated = changes.filter(c => c.type === 'updated');
  const deleted = changes.filter(c => c.type === 'deleted');

  let body = '## Logo Updates\n\n';

  if (added.length > 0) {
    body += '### Added\n';
    body += added.map(c => `- ${c.chain}/${c.address}`).join('\n');
    body += '\n\n';
  }

  if (updated.length > 0) {
    body += '### Updated\n';
    body += updated.map(c => {
      let line = `- ${c.chain}/${c.address}`;
      if (c.skipReason) {
        line += ` (${c.skipReason})`;
      }
      return line;
    }).join('\n');
    body += '\n\n';
  }

  if (deleted.length > 0) {
    body += '### Deleted\n';
    body += deleted.map(c => `- ${c.chain}/${c.address}`).join('\n');
    body += '\n\n';
  }

  body += `---\n_Generated automatically on ${new Date().toISOString()}_`;

  return body;
}
