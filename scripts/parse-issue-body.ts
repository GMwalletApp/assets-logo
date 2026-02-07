import { readFileSync } from 'node:fs';

const TEMPLATE_TYPE = process.argv[2] || 'chain';

const CHAIN_FIELDS: Record<string, string> = {
  'Chain Name': 'chain_name',
  'Reason': 'reason',
  'Terms': 'terms',
};

const TOKEN_FIELDS: Record<string, string> = {
  'How to identify the token?': 'input_type',
  'Token Symbol': 'token_symbol',
  'Token Address': 'token_address',
  'Chain Names': 'chain_names',
  'Reason': 'reason',
  'Terms': 'terms',
};

const FIELD_MAP = TEMPLATE_TYPE === 'token' ? TOKEN_FIELDS : CHAIN_FIELDS;

function parseIssueBody(body: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const sections = body.split(/^### /gm);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) continue;

    const rawTitle = lines[0].trim();
    const title = rawTitle.replace(/\*\*/g, '').trim();

    if (!FIELD_MAP[title]) continue;

    const fieldName = FIELD_MAP[title];
    let value = lines.slice(1).join('\n').trim();

    if (value.startsWith('- [')) {
      const checked: Record<string, boolean> = {};
      const items = value.split('\n').filter((l) => l.trim().startsWith('- ['));
      for (const item of items) {
        const match = item.match(/- \[(x| )] (.+)/);
        if (match) {
          checked[match[2].trim()] = match[1] === 'x';
        }
      }
      result[fieldName] = checked;
    } else {
      result[fieldName] = value;
    }
  }

  return result;
}

function main() {
  const stdin = readFileSync('/dev/stdin', 'utf-8');
  const parsed = parseIssueBody(stdin);

  console.log(JSON.stringify(parsed));
}

main();
