import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApp } from '../server/index';

test('HTTP and real MCP enforce identities, immutable handoffs, origins and live revocation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worktether-http-'));
  const runtime = createApp(join(directory, 'test.sqlite'));
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const origin = 'http://127.0.0.1:5173';
  const clients: Client[] = [];
  const login = async (name: string) => {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: `${name}@worktether.local`, password: 'worktether-local-2026' }) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/);
    return response.headers.get('set-cookie')!.split(';')[0];
  };
  const api = async (cookie: string, action: string, input: any) => {
    const response = await fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin }, body: JSON.stringify({ action, input }) });
    return { status: response.status, body: await response.json() as any };
  };
  const connect = async (token: string, modern = false) => {
    const client = new Client({ name: 'worktether-integration-test', version: '0.1.0' }, modern ? {versionNegotiation: {mode: {pin: '2026-07-28'}}} : {});
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    return client;
  };
  const call = async (client: Client, name: string, args: any) => (await client.callTool({ name, arguments: args })) as any;
  try {
    assert.equal((await fetch(`${base}/api/bootstrap`)).status, 401);
    const akash = await login('akash'), maya = await login('maya');
    const initial = await fetch(`${base}/api/bootstrap`, { headers: { Cookie: akash } }).then(r => r.json()) as any;
    const mayaInitial = await fetch(`${base}/api/bootstrap`, { headers: { Cookie: maya } }).then(r => r.json()) as any;
    const work = (await api(akash, 'create_work', { projectId: initial.project.id, title: 'HTTP private work', objective: 'Test separation' })).body;
    const aCredential = (await api(akash, 'create_credential', { name: 'Integration A' })).body;
    const mCredential = (await api(maya, 'create_credential', { name: 'Integration M' })).body;
    assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { Cookie: akash, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const aClient = await connect(aCredential.token), mClient = await connect(mCredential.token);
    assert.ok((await aClient.listTools()).tools.some(t => t.name === 'get_work_context'));
    const modernClient = await connect(aCredential.token, true);
    const modernOverview = await call(modernClient, 'workspace_overview', {});
    assert.equal(modernOverview.structuredContent.user.id, initial.user.id);
    const conversation = (await call(modernClient, 'create_conversation', {workId: work.id, title: 'HTTP continuation'})).structuredContent;
    assert.match(conversation.id, /^conv_/);
    const denied = await call(mClient, 'get_work_context', { workId: work.id });
    assert.equal(denied.isError, true); assert.equal(denied.structuredContent.error.code, 'NOT_FOUND');
    const source = (await call(aClient, 'record_source', { workId: work.id, kind: 'prompt', title: 'Selected prompt', content: 'Exact selected prompt', conversationId: conversation.id, status: 'accepted' })).structuredContent;
    const context = (await call(aClient, 'get_work_context', { workId: work.id, budgetBytes: 10000 })).structuredContent;
    assert.equal(context.workId, work.id);
    assert.equal((await call(modernClient, 'get_context_snapshot', {contextId: context.id})).structuredContent.snapshot.id, context.id);
    assert.ok(Buffer.byteLength(JSON.stringify(context)) <= 10000);
    const stalePreview = await call(aClient, 'send_handoff', {workId: work.id, recipientId: mayaInitial.user.id, title: 'Stale preview', content: 'Review only', sourceIds: [source.id], expectedRevision: work.revision, idempotencyKey: 'stale-preview'});
    assert.equal(stalePreview.structuredContent.error.code, 'REVISION_CONFLICT');
    const staleSource = await call(aClient, 'send_handoff', {workId: work.id, recipientId: mayaInitial.user.id, title: 'Stale source', content: 'Review only', sourceIds: [source.id], expectedRevision: context.workRevision, expectedSourceRevisions: {[source.id]: source.revision + 1}, idempotencyKey: 'stale-source'});
    assert.equal(staleSource.structuredContent.error.code, 'REVISION_CONFLICT');
    const handoff = (await call(aClient, 'send_handoff', { workId: work.id, recipientId: mayaInitial.user.id, title: 'Selected share', content: 'Review only', sourceIds: [source.id], expectedRevision: context.workRevision, expectedSourceRevisions: {[source.id]: source.revision}, idempotencyKey: 'http-retry-1' })).structuredContent;
    const inbox = (await call(mClient, 'list_inbox', {})).structuredContent;
    assert.ok(inbox.items.some((h: any) => h.id === handoff.id));
    assert.equal((await call(mClient, 'get_work_context', { workId: work.id })).isError, true);
    await call(mClient, 'acknowledge_handoff', { handoffId: handoff.id });
    assert.equal((await call(aClient, 'get_handoff', { handoffId: handoff.id })).structuredContent.state, 'acknowledged');
    const noOrigin = await fetch(`${base}/api/action`, { method: 'POST', headers: { Cookie: akash, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_work', input: { projectId: initial.project.id } }) });
    assert.equal(noOrigin.status, 403);
    assert.equal((await fetch(`${base}/api/health`, { headers: { Origin: 'https://malicious.example' } })).status, 403);
    assert.equal(await new Promise<number>(resolve => { get(`${base}/api/health`, { headers: { Host: 'malicious.example' } }, response => { response.resume(); resolve(response.statusCode!); }); }), 403);
    await api(akash, 'revoke_credential', { credentialId: aCredential.id });
    assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${aCredential.token}`, 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    await api(akash, 'revoke_handoff', { handoffId: handoff.id });
    assert.equal((await call(mClient, 'get_handoff', { handoffId: handoff.id })).structuredContent.error.code, 'NOT_FOUND');
  } finally {
    await Promise.all(clients.map(client => client.close().catch(() => {})));
    await new Promise<void>(resolve => server.close(() => resolve()));
    await runtime.close(); rmSync(directory, { recursive: true, force: true });
  }
});
