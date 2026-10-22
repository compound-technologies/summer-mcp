import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { handleMcp, TOOLS, MCP_PROTOCOL_VERSIONS, ApiError } from '../src/index.ts';
import { demoBackend, demoConfig, company, caseId } from '../examples/demo-backend/backend.mjs';
const request = (method, params = {}, headers = {}) => new Request(demoConfig.apiOrigin + '/mcp', {
  method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
});
const authenticated = { authorization: 'Bearer demo-only' };

test('all supported protocol generations initialize through the SDK', async () => {
  for (const version of MCP_PROTOCOL_VERSIONS.filter(v => v.startsWith('2025'))) {
    const result = await handleMcp(request('initialize', { protocolVersion: version, capabilities: {}, clientInfo: { name: 'test-client', version: '1' } }), demoConfig, demoBackend());
    assert.equal(result.status, 200);
    assert.equal((await result.json()).result.protocolVersion, version);
  }
  const client = new Client({ name: 'test-client', version: '1' });
  const transport = new StreamableHTTPClientTransport(new URL(demoConfig.apiOrigin + '/mcp'), {
    fetch: (url, init) => handleMcp(new Request(url, init), demoConfig, demoBackend()),
  });
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, TOOLS.length);
  } finally { await client.close(); }
});

test('anonymous discovery does not read identity or execute operations; invalid tokens never downgrade', async () => {
  const backend = demoBackend(); let reads = 0, effects = 0;
  backend.admit = async () => { reads++; throw new ApiError('invalid_token', 'Invalid synthetic token.'); };
  backend.execute = async () => { effects++; throw new Error('Must not execute'); };
  const result = await handleMcp(request('tools/list'), demoConfig, backend);
  assert.equal(result.status, 200);
  const listed = (await result.json()).result.tools;
  assert.equal(listed.length, TOOLS.length);
  for (const tool of listed) {
    assert.ok(tool.title, `${tool.name} needs a display title`);
    assert.equal(tool.annotations.title, tool.title, `${tool.name} needs the same title for directory clients`);
  }
  assert.equal(reads, 0); assert.equal(effects, 0);
  const bad = await handleMcp(request('tools/list', {}, { authorization: 'Bearer invalid-demo' }), demoConfig, backend);
  assert.equal(bad.status, 401); assert.equal(reads, 1); assert.equal(effects, 0);
  assert.match(bad.headers.get('www-authenticate'), /resource_metadata/);
});

test('tool calls and rendered prompts require admission', async () => {
  for (const [method, params] of [['tools/call', { name: 'summer_account_me' }], ['prompts/get', { name: 'summer_setup' }]]) {
    assert.equal((await handleMcp(request(method, params), demoConfig, demoBackend())).status, 401);
  }
  const cases = await handleMcp(request('tools/call', { name: 'summer_cases_get', arguments: { company, environment: 'staging', case: caseId } }, authenticated), demoConfig, demoBackend());
  assert.equal((await cases.json()).result.structuredContent.case.demo, true);
});

test('secret-moving calls return a local handoff and cannot execute the backend', async () => {
  const backend = demoBackend(); let executed = false;
  backend.execute = async () => { executed = true; throw new Error('Unexpected execution'); };
  const response = await handleMcp(request('tools/call', { name: 'summer_credentials_set', arguments: { company, environment: 'staging', name: 'EXAMPLE_SERVICE_KEY', source: 'local_value', expected_version: 0 } }, authenticated), demoConfig, backend);
  const result = (await response.json()).result.structuredContent;
  assert.equal(result.executed, false); assert.equal(executed, false);
  assert.match(result.handoff.command, /--from-env EXAMPLE_SERVICE_KEY/);
  const schema = TOOLS.find(t => t.name === 'summer_credentials_set').schema;
  assert.equal(schema.safeParse({ company, environment: 'staging', name: 'EXAMPLE_SERVICE_KEY', source: 'local_value', expected_version: 0, value: 'must-be-refused' }).success, false);
});

test('scope challenges and cross-company refusals remain explicit', async () => {
  const backend = demoBackend();
  const denied = await handleMcp(request('tools/call', { name: 'summer_investigations_request', arguments: { company, environment: 'staging', case: caseId, request: { kind: 'investigate' } } }, authenticated), demoConfig, backend);
  assert.equal(denied.status, 403); assert.match(denied.headers.get('www-authenticate'), /investigations.request/);
  const foreign = await handleMcp(request('tools/call', { name: 'summer_cases_list', arguments: { company: '33333333-3333-4333-8333-333333333333', environment: 'staging' } }, authenticated), demoConfig, backend);
  assert.equal((await foreign.json()).result.isError, true);
});

test('host and browser-origin checks, body bounds and disabled state survive extraction', async () => {
  assert.equal((await handleMcp(request('ping', {}, { origin: 'https://foreign.example' }), demoConfig, demoBackend())).status, 403);
  assert.equal((await handleMcp(request('ping', {}, { host: 'foreign.example' }), demoConfig, demoBackend())).status, 403);
  assert.equal((await handleMcp(request('ping'), { ...demoConfig, enabled: false }, demoBackend())).status, 404);
  const huge = new Request(demoConfig.apiOrigin + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: 'x'.repeat(1_200_001) });
  assert.equal((await handleMcp(huge, demoConfig, demoBackend())).status, 413);
});
