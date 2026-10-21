import { readFileSync, writeFileSync } from 'node:fs';
import { TOOLS } from '../src/server.ts';
const destination = new URL('../docs/tools.md', import.meta.url);
const rows = TOOLS.map(({ name, op, handoff }) => `| \`${name}\` | ${op.scope ?? 'Personal account'} | ${op.summary.replaceAll('|', '\\|')}${handoff ? ' Secret transfer uses a local CLI handoff.' : ''} |`);
const text = ['# Summer MCP tools', '', 'Generated from the operation catalog. The hosted deployment and your granted permissions determine current availability.', '', '| Tool | Required permission | Purpose |', '| --- | --- | --- |', ...rows, ''].join('\n');
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== text) throw new Error('Run npm run docs to update the tool reference.');
} else writeFileSync(destination, text);
