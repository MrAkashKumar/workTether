import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync, chmodSync, realpathSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createApp } from '../server/index';
import { clients, configPlans, writeConfigs, readConnection, saveConnection, serviceUrl, machineLabel } from '../integrations/config';
import { setupConnections } from '../scripts/setup-mcp';

const project = resolve(fileURLToPath(new URL('..', import.meta.url)));
const directory = () => realpathSync(mkdtempSync(join(tmpdir(), 'worktether-integration-')));

test('client configs preserve other entries, use absolute paths, reject collisions and keep secrets private', () => {
  const root = directory();
  try {
    mkdirSync(join(root, '.cursor'));
    writeFileSync(join(root, '.cursor', 'mcp.json'), JSON.stringify({ custom: true, mcpServers: { existing: { command: 'keep-me' } } }));
    mkdirSync(join(root, '.codex'));
    writeFileSync(join(root, '.codex', 'config.toml'), 'model = "keep-me"\n[mcp_servers.existing]\ncommand = "keep-me"\n');
    const plans = configPlans(root, clients); writeConfigs(plans);
    const cursor = JSON.parse(readFileSync(join(root, '.cursor', 'mcp.json'), 'utf8'));
    assert.equal(cursor.custom, true); assert.equal(cursor.mcpServers.existing.command, 'keep-me');
    assert.ok(cursor.mcpServers.worktether.args.includes(join(root, 'server', 'stdio.ts')));
    assert.equal(cursor.mcpServers.worktether.command, process.execPath);
    assert.match(readFileSync(plans[0].path, 'utf8'), /model = "keep-me"/);
    assert.deepEqual(configPlans(root, clients), plans);
    const token = `wt_${'x'.repeat(43)}`, saved = { url: 'http://127.0.0.1:4318', token };
    saveConnection(plans[0].credentialPath, saved);
    assert.deepEqual(readConnection(plans[0].credentialPath), saved);
    assert.ok(plans.every(p => !p.content.includes(token)));
    assert.throws(() => saveConnection(plans[0].credentialPath, saved));
    if (process.platform !== 'win32') {
      assert.equal(statSync(plans[0].credentialPath).mode & 0o777, 0o600);
      chmodSync(plans[0].credentialPath, 0o644); assert.throws(() => readConnection(plans[0].credentialPath), /private/);
    }
    cursor.mcpServers.worktether.command = 'another-server';
    writeFileSync(join(root, '.cursor', 'mcp.json'), JSON.stringify(cursor));
    assert.throws(() => configPlans(root, ['cursor']), /differs/);
    assert.throws(() => serviceUrl('http://other-machine.example'), /loopback/);
    assert.throws(() => serviceUrl('https://token@example.com'), /without credentials/);
    assert.throws(() => serviceUrl('https://example.com?token=secret'));
    assert.equal(serviceUrl('http://localhost:9000/'), 'http://localhost:9000');
    assert.equal(machineLabel(' Akash MacBook '), 'Akash MacBook');
    assert.equal(machineLabel(), 'this machine');
    for (const label of ['', 'x'.repeat(65), 'Laptop"; echo secret', 'Laptop$(command)', 'Laptop\ncommand']) assert.throws(() => machineLabel(label), /Laptop name/);
    if (process.platform !== 'win32') {
      mkdirSync(join(root, 'unsafe'));
      rmSync(join(root, '.mcp.json'));
      symlinkSync(join(root, 'unsafe'), join(root, '.mcp.json'));
      assert.throws(() => configPlans(root, ['claude-code']), /symbolic/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setup creates separate personal revocable client credentials without touching global host config', async () => {
  const root = directory(), runtime = createApp(join(root, 'setup.sqlite'));
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const user = runtime.store.login('akash@worktether.local', 'worktether-local-2026').user;
  const starter = runtime.store.execute(user.id, 'create_credential', { name: 'Setup test starter' });
  try {
    const beforeInvalid = runtime.store.execute(user.id, 'bootstrap', {}).devices.length;
    await assert.rejects(() => setupConnections({root: join(root, 'invalid-laptop'), selected: clients, url, token: starter.token, machineName: 'bad"name'}), /Laptop name/);
    assert.equal(runtime.store.execute(user.id, 'bootstrap', {}).devices.length, beforeInvalid);
    const result = await setupConnections({ root, selected: clients, url, token: starter.token, machineName: 'Akash MacBook' });
    assert.equal(result.activated, true);
    const connections = result.plans.map(plan => readConnection(plan.credentialPath));
    assert.equal(new Set(connections.map(c => c.token)).size, 4);
    for (const c of connections) { assert.equal(runtime.store.authenticate(c.token)?.id, user.id); assert.equal(c.url, url); assert.equal(c.machineName, 'Akash MacBook'); }
    assert.ok(runtime.store.execute(user.id, 'bootstrap', {}).devices.filter((d: any) => connections.some(c => c.deviceId === d.id)).every((d: any) => d.name.endsWith('on Akash MacBook')));
    await assert.rejects(() => setupConnections({ root, selected: clients, url, token: starter.token }), /already/);
    const selected = connections[1];
    runtime.store.execute(user.id, 'revoke_device', { deviceId: selected.deviceId });
    assert.equal(runtime.store.authenticate(selected.token), null);
    assert.equal(runtime.store.authenticate(connections[0].token)?.id, user.id);
    const onlyRoot = join(root, 'configuration-only');
    assert.equal((await setupConnections({ root: onlyRoot, selected: ['codex'], url, configureOnly: true })).activated, false);
    const execute = runtime.store.execute.bind(runtime.store);
    runtime.store.execute = (actor, action, input) => {
      if (action === 'create_credential' || action === 'revoke_device') throw new Error('Simulated setup/cleanup interruption');
      return execute(actor, action, input);
    };
    try {
      await assert.rejects(() => setupConnections({ root: join(root, 'failed-setup'), selected: ['cursor'], url, token: starter.token }), /Revoke newly created connections/);
    } finally { runtime.store.execute = execute; }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); await runtime.close(); rmSync(root, { recursive: true, force: true });
  }
});

test('real stdio process forwards all tools, preserves private identity, conversation IDs and live revocation across protocol modes', async () => {
  const root = directory(), runtime = createApp(join(root, 'bridge.sqlite'));
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const akash = runtime.store.login('akash@worktether.local', 'worktether-local-2026').user;
  const maya = runtime.store.login('maya@worktether.local', 'worktether-local-2026').user;
  const overview = runtime.store.execute(akash.id, 'bootstrap', {});
  const work = runtime.store.execute(akash.id, 'create_work', { projectId: overview.project.id, title: 'Private bridge test', objective: 'Continue correctly' });
  const connected: Client[] = [];
  const connect = async (actor: string, modern = false) => {
    const credential = runtime.store.execute(actor, 'create_credential', { name: 'Stdio protocol test' });
    const path = join(root, `.worktether/connections/${credential.id}.json`); saveConnection(path, { url, token: credential.token });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !key.startsWith('WORKTETHER_'))) as Record<string, string>;
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', import.meta.resolve('tsx'), join(project, 'server/stdio.ts'), '--credential-file', path], cwd: root, env, stderr: 'pipe' });
    const client = new Client({ name: 'real-stdio-test', version: '1' }, modern ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {});
    connected.push(client); await client.connect(transport);
    assert.match(client.getInstructions() || '', /stable IDs/);
    return { client, credential };
  };
  try {
    const a = await connect(akash.id), m = await connect(maya.id), modern = await connect(akash.id, true);
    for (const c of [a.client, m.client, modern.client]) assert.equal((await c.listTools()).tools.length, 20);
    const call = (c: Client, name: string, args: any) => c.callTool({ name, arguments: args }) as Promise<any>;
    assert.equal((await call(m.client, 'get_work_context', { workId: work.id })).structuredContent.error.code, 'NOT_FOUND');
    const conversation = (await call(a.client, 'create_conversation', { workId: work.id, title: 'Client continuation', client: 'codex', machineName: 'Test MacBook' })).structuredContent;
    assert.equal(conversation.client, 'codex'); assert.equal(conversation.machineName, 'Test MacBook');
    const prompt = (await call(a.client, 'record_source', { workId: work.id, conversationId: conversation.id, kind: 'prompt', title: 'Selected request', content: 'Preserve requirements.' })).structuredContent;
    const context = (await call(modern.client, 'get_work_context', { workId: work.id })).structuredContent;
    assert.equal(context.sources.find((s: any) => s.id === prompt.id).conversationId, conversation.id);
    const draft = (await call(a.client, 'prepare_prompt', { workId: work.id, originalRequest: ' Explain clearly. No code. ', conversationId: conversation.id })).structuredContent;
    assert.equal(draft.originalRequest, ' Explain clearly. No code. ');
    assert.equal((await call(modern.client, 'get_prepared_prompt', { promptId: draft.id })).structuredContent.preparedText, draft.preparedText);
    assert.equal((await call(m.client, 'get_prepared_prompt', { promptId: draft.id })).structuredContent.error.code, 'NOT_FOUND');
    const conflict = await call(a.client, 'record_progress', { workId: work.id, expectedRevision: 1, nextAction: 'Stale update' });
    assert.equal(conflict.structuredContent.error.code, 'REVISION_CONFLICT');
    runtime.store.execute(akash.id, 'revoke_credential', { credentialId: a.credential.id });
    assert.equal((await call(a.client, 'workspace_overview', {})).structuredContent.error.code, 'UPSTREAM_REQUEST_FAILED');
    assert.equal((await call(modern.client, 'workspace_overview', {})).structuredContent.user.id, akash.id);
  } finally {
    await Promise.all(connected.map(c => c.close()));
    await new Promise<void>(resolve => server.close(() => resolve())); await runtime.close(); rmSync(root, { recursive: true, force: true });
  }
});

test('stdio startup with malformed credential fails without emitting secrets or nonprotocol stdout', async () => {
  const root = directory(), token = 'z'.repeat(43), path = join(root, 'bad.json');
  writeFileSync(path, `{"token":"${token}"`, { mode: 0o600 });
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), join(project, 'server/stdio.ts'), '--credential-file', path], { cwd: root });
  let stdout = '', stderr = ''; child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; }); child.stdin.end();
  try {
    const exit = await new Promise<number | null>(resolve => child.once('exit', resolve));
    assert.equal(exit, 1); assert.equal(stdout, ''); assert.ok(!stderr.includes(token)); assert.match(stderr, /Invalid credential file/);
  } finally { child.kill(); rmSync(root, { recursive: true, force: true }); }
});
