import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { handleDocumentationMcp, SETUP_DOCUMENTS } from '../src/documentation-server.ts';
const base = 'https://api.example.com/mcp/setup';
const request = (method, params = {}, headers = {}) => new Request(base, {
  method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
});
const backend = () => ({ read: topic => ({ title: topic, description: 'Public reference.', body: `Public guide for ${topic}.` }), rateLimit: async () => ({ allowed: true, retryAfter: 0 }) });

test('official modern SDK discovers public-only tools and reads every allowed guide', async () => {
  const client = new Client({ name: 'setup-test', version: '1' });
  const transport = new StreamableHTTPClientTransport(new URL(base), { fetch: (url, init) => handleDocumentationMcp(new Request(url, init), backend()) });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(t => t.name), ['summer_docs_list', 'summer_docs_get']);
    for (const t of listed.tools) { assert.equal(t.annotations.readOnlyHint, true); assert.equal(t.annotations.destructiveHint, false); assert.equal(t.annotations.openWorldHint, false); }
    const index = await client.callTool({ name: 'summer_docs_list', arguments: {} });
    assert.equal(index.structuredContent.guides.length, SETUP_DOCUMENTS.length);
    for (const topic of SETUP_DOCUMENTS) {
      const page = await client.callTool({ name: 'summer_docs_get', arguments: { topic } });
      assert.equal(page.structuredContent.markdown, `Public guide for ${topic}.`);
      assert.equal(page.structuredContent.url, `https://gosummer.ai/docs/${topic}`);
    }
  } finally { await client.close(); }
});

test('legacy JSON-RPC also initializes and calls both tools without authentication', async () => {
  const init = await handleDocumentationMcp(request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'legacy', version: '1' } }), backend());
  assert.equal(init.status, 200); assert.equal((await init.json()).result.protocolVersion, '2025-06-18');
  for (const [name,args] of [['summer_docs_list', {}], ['summer_docs_get', { topic: 'install-messenger' }]]) {
    const response = await handleDocumentationMcp(request('tools/call', { name, arguments: args }), backend());
    assert.ok((await response.json()).result.structuredContent);
  }
});

test('private topics, arbitrary URLs, extra inputs and operational tools never reach the reader', async () => {
  const host = backend(); let reads = 0; host.read = () => { reads++; throw new Error('Must not read'); };
  for (const params of [
    { name: 'summer_docs_get', arguments: { topic: '../../private' } },
    { name: 'summer_docs_get', arguments: { topic: 'https://private.example' } },
    { name: 'summer_docs_get', arguments: { topic: 'install-messenger', company: 'fake' } },
    { name: 'summer_docs_list', arguments: { query: 'private input' } },
    { name: 'summer_cases_get', arguments: {} },
  ]) {
    const response = await handleDocumentationMcp(request('tools/call', params), host);
    assert.ok((await response.json()).error);
  }
  assert.equal(reads, 0);
});

test('credentials, large bodies, rate limits and invalid requests are refused', async () => {
  assert.equal((await handleDocumentationMcp(request('ping', {}, { authorization: 'Bearer synthetic' }), backend())).status, 400);
  const large = new Request(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(16_385) });
  assert.equal((await handleDocumentationMcp(large, backend())).status, 413);
  assert.equal((await handleDocumentationMcp(request('ping'), { ...backend(), rateLimit: async () => ({ allowed: false, retryAfter: 60 }) })).status, 429);
  assert.equal((await handleDocumentationMcp(new Request(base), backend())).status, 405);
  assert.equal((await handleDocumentationMcp(request('ping', {}, { origin: 'null' }), backend())).status, 403);
  assert.equal((await handleDocumentationMcp(request('ping', {}, { origin: 'http://untrusted.example' }), backend())).status, 403);
});
