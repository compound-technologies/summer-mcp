import test from 'node:test';
import assert from 'node:assert/strict';
import { clientStatus, MCP_VERSION, MINIMUM_CLI_VERSION, CLIENT_STATUS_META } from '../src/client-status.ts';
import { handleMcp, TOOLS } from '../src/index.ts';
import { demoConfig, demoBackend, company, caseId } from '../examples/demo-backend/backend.mjs';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

test('client status distinguishes old versions, changed catalogs and overdue checks', () => {
  const now = Date.now(), week = 7 * 86400_000;
  const current = { cli_version: MINIMUM_CLI_VERSION, mcp_version: MCP_VERSION, last_checked_at: new Date(now - week + 1).toISOString() };
  assert.deepEqual(clientStatus(current, now).warnings, []);
  assert.equal(clientStatus({ ...current, last_checked_at: new Date(now - week).toISOString() }, now).warnings[0].code, 'freshness_check_due');
  assert.deepEqual(clientStatus({ cli_version: '0.1.0', mcp_version: '0.1.0' }, now).warnings.map(w => w.code), ['cli_outdated', 'mcp_catalog_changed', 'freshness_check_due']);
  assert.equal(clientStatus({ ...current, cli_version: '99.0.0' }, now).warnings.length, 0);
  assert.equal(clientStatus({ ...current, last_checked_at: new Date(now + 1000).toISOString() }, now).refresh_required, true);
  const schema = TOOLS.find(t => t.name === 'summer_client_status').schema;
  assert.equal(schema.safeParse({ cli_version: '$(bad)' }).success, false);
  assert.equal(schema.safeParse({ last_checked_at: 'yesterday' }).success, false);
});

test('MCP initialization warns for a known old Summer CLI without misreading other clients', async () => {
  for (const [name, old] of [['summer-cli', true], ['claude', false]]) {
    const request = new Request(demoConfig.apiOrigin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name, version: '0.1.0' } } }) });
    const response = await handleMcp(request, demoConfig, demoBackend());
    assert.equal(response.status, 200);
    const result = (await response.json()).result;
    assert.equal(result.serverInfo.version, MCP_VERSION);
    assert.equal(result.instructions.startsWith('WARNING:'), old);
    assert.match(result.instructions, /seven days/); assert.match(result.instructions, /summer_client_status/);
  }
});

test('ordinary MCP calls from old clients succeed once with original data and update warnings', async () => {
  for (const protocol of ['2025-11-25', '2025-06-18']) {
    const backend = demoBackend(), execute = backend.execute; let calls = 0;
    backend.execute = async args => { calls++; return execute(args); };
    const request = new Request(demoConfig.apiOrigin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer demo-only', 'mcp-protocol-version': protocol },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'summer_cases_get', arguments: { company, environment: 'staging', case: caseId }, _meta: { 'ai.gosummer/client': { cli_version: '0.1.0', mcp_version: '0.1.0', last_checked_at: '2020-01-01T00:00:00Z' } } } }) });
    const response = await handleMcp(request, demoConfig, backend);
    assert.equal(response.status, 200);
    const result = (await response.json()).result;
    assert.equal(calls, 1); assert.notEqual(result.isError, true);
    assert.equal(result.structuredContent.case.demo, true);
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.ok(result._meta[CLIENT_STATUS_META].warnings.some(w => w.code === 'cli_outdated'));
    assert.ok(result.content.some(item => item.type === 'text' && /update warning.*npm install/.test(item.text)));
  }
});

test('the modern SDK receives nonblocking update metadata and readable warnings on a normal tool call', async () => {
  const client = new Client({ name: 'example-agent', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(demoConfig.apiOrigin + '/mcp'), { fetch: (url, init) => {
    const headers = new Headers(init.headers); headers.set('authorization', 'Bearer demo-only'); headers.set('summer-cli-version', '0.1.0');
    return handleMcp(new Request(url, { ...init, headers }), demoConfig, demoBackend());
  } });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'summer_cases_get', arguments: { company, environment: 'staging', case: caseId } });
    assert.equal(result.structuredContent.case.demo, true); assert.notEqual(result.isError, true);
    assert.ok(result._meta[CLIENT_STATUS_META].warnings.some(w => w.code === 'cli_outdated'));
    assert.ok(result.content.some(item => item.type === 'text' && item.text.includes('npm install')));
  } finally { await client.close(); }
});

test('fresh metadata suppresses warnings and malformed diagnostics never block the requested tool', async () => {
  for (const [report, warn] of [[{ cli_version: MINIMUM_CLI_VERSION, mcp_version: MCP_VERSION, last_checked_at: new Date().toISOString() }, false], [{ cli_version: 'invalid', last_checked_at: 'yesterday' }, true]]) {
    const request = new Request(demoConfig.apiOrigin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer demo-only', 'mcp-protocol-version': '2025-11-25' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'summer_cases_get', arguments: { company, environment: 'staging', case: caseId }, _meta: { 'ai.gosummer/client': report } } }) });
    const response = await handleMcp(request, demoConfig, demoBackend()); assert.equal(response.status, 200);
    const result = (await response.json()).result; assert.equal(result.structuredContent.case.demo, true);
    assert.equal(result._meta[CLIENT_STATUS_META].warnings.length > 0, warn);
    assert.equal(result.content.length > 1, warn);
  }
});
