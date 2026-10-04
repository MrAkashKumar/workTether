import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveConnection } from '../integrations/config';

const base = process.env.WORKTETHER_URL || 'http://127.0.0.1:4318';
const client = new Client({ name: 'worktether-smoke-check', version: '0.1.0' });
let cookie = '', credentialId = '';
let temporary = '';
const stdio = process.argv.includes('--stdio');
const api = async (action: string, input: unknown) => {
  const response = await fetch(`${base}/api/action`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base }, body: JSON.stringify({ action, input }) });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(data.error?.message || 'Request failed.');
  return data;
};
try {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: process.env.WORKTETHER_EMAIL || 'akash@worktether.local', password: process.env.WORKTETHER_PASSWORD || 'worktether-local-2026' }) });
  if (!login.ok) throw new Error('Sign-in failed. Set WORKTETHER_EMAIL and WORKTETHER_PASSWORD for your account.');
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  const credential = await api('create_credential', { name: 'Temporary MCP smoke check' }); credentialId = credential.id;
  if (stdio) {
    temporary = realpathSync(mkdtempSync(join(tmpdir(), 'worktether-stdio-check-')));
    const credentialPath = join(temporary, '.worktether', 'connections', 'smoke.json');
    saveConnection(credentialPath, { url: base, token: credential.token });
    const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', import.meta.resolve('tsx'), join(project, 'server', 'stdio.ts'), '--credential-file', credentialPath], cwd: temporary, stderr: 'inherit' }));
  } else await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${credential.token}` } } }));
  const catalog = await client.listTools();
  const overview = await client.callTool({ name: 'workspace_overview', arguments: {} });
  if (overview.isError) throw new Error('MCP overview failed.');
  process.stdout.write(`MCP verified over ${stdio ? 'stdio bridge' : 'HTTP'}: ${catalog.tools.length} tools; authenticated workspace retrieval succeeded.\n`);
} finally {
  await client.close().catch(() => {});
  if (temporary) rmSync(temporary, { recursive: true, force: true });
  if (cookie && credentialId) await api('revoke_credential', { credentialId });
  if (cookie) await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: '{}' });
}
