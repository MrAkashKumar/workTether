import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { readConnection, type Connection } from '../integrations/config';
import { workflowInstructions } from './instructions';

/** Transport bridge; permissions and records remain in the authenticated HTTP service. */
export async function createStdioBridge(connection: Connection) {
  const upstream = new Client({ name: 'worktether-stdio-bridge', version: '0.1.0' });
  try {
    await upstream.connect(new StreamableHTTPClientTransport(new URL(`${connection.url}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${connection.token}` }, redirect: 'error' },
    }));
  } catch {
    await upstream.close().catch(() => {});
    throw new Error('Cannot authenticate to WorkTether. Check the running service and credential in Connections.');
  }
  const server = new Server({ name: 'worktether', version: '0.1.0' }, { capabilities: { tools: {} }, instructions: workflowInstructions });
  server.setRequestHandler('tools/list', async request => {
    try { return await upstream.listTools(request.params); }
    catch { throw new Error('Cannot retrieve WorkTether tools. Check service availability and credential revocation.'); }
  });
  server.setRequestHandler('tools/call', async request => {
    try { return server.projectCallToolResult(await upstream.callTool(request.params), undefined); }
    catch {
      const error = { code: 'UPSTREAM_REQUEST_FAILED', message: 'WorkTether request failed. Check the service and credential. A mutation outcome may be uncertain; reconcile revisions or reuse an identical handoff retry key before retrying.' };
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error }) }], structuredContent: { error } };
    }
  });
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    await server.close().catch(() => {}); await upstream.close().catch(() => {});
  };
  server.onclose = () => { void close(); };
  server.onerror = () => { process.stderr.write('WorkTether MCP protocol error.\n'); };
  return { server, close };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--credential-file')) throw new Error('Usage: mcp:stdio [--credential-file PATH]');
  const connection = readConnection(args[1]);
  const bridges = new Set<Awaited<ReturnType<typeof createStdioBridge>>>();
  const handle = serveStdio(async () => {
    const bridge = await createStdioBridge(connection); bridges.add(bridge); return bridge.server;
  }, { onerror: () => { process.stderr.write('WorkTether bridge request failed. Check service availability and credentials.\n'); } });
  const close = async () => { await handle.close(); await Promise.all([...bridges].map(bridge => bridge.close())); };
  process.stdin.once('end', () => { void close(); });
  process.once('SIGINT', () => { void close(); }); process.once('SIGTERM', () => { void close(); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
