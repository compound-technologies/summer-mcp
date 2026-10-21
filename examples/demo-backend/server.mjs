import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { handleMcp } from '../../src/index.ts';
import { demoBackend, demoConfig } from './backend.mjs';
const backend = demoBackend();
createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, demoConfig.apiOrigin);
    if (url.pathname !== '/mcp') { outgoing.writeHead(404).end(); return; }
    const request = new Request(url, {
      method: incoming.method, headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
    });
    const response = await handleMcp(request, demoConfig, backend);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500).end('Demo request failed.'); }
}).listen(3434, '127.0.0.1', () => {
  console.log('Synthetic MCP demo: http://127.0.0.1:3434/mcp');
  console.log('Demo calls use Authorization: Bearer demo-only. This is not a Summer token.');
});
