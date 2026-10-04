import { existsSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clients, configPlans, writeConfigs, saveConnection, serviceUrl, type ClientName } from '../integrations/config';

type SetupOptions = { root: string; selected: readonly ClientName[]; url: string; token?: string; configureOnly?: boolean };
class SetupCleanupError extends Error {
  constructor() { super('Setup failed and some cleanup requests failed. Revoke newly created connections in the dashboard and review local credential files before retrying.'); }
}

/** Explicit setup provisions separate revocable credentials, never writing a token to client configuration. */
export async function setupConnections(options: SetupOptions) {
  const base = serviceUrl(options.url), plans = configPlans(options.root, options.selected);
  if (options.configureOnly) { writeConfigs(plans); return { plans, activated: false }; }
  if (!options.token || !/^wt_[A-Za-z0-9_-]{43}$/.test(options.token)) throw new Error('Provide a WorkTether credential from Connections.');
  if (plans.some(plan => existsSync(plan.credentialPath))) throw new Error('A selected client already has a credential file. Review/revoke its connection before configuring it again.');
  const api = async (action?: string, input?: unknown) => {
    const response = await fetch(`${base}/api/${action ? 'action' : 'bootstrap'}`, {
      method: action ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${options.token}`, ...(action ? { 'Content-Type': 'application/json' } : {}) },
      ...(action ? { body: JSON.stringify({ action, input }) } : {}),
    });
    if (!response.ok) throw new Error('WorkTether setup request failed. Check service availability and your credential.');
    return await response.json() as any;
  };
  const overview = await api();
  const created: { deviceId: string; credentialId?: string; path?: string }[] = [];
  try {
    for (const plan of plans) {
      const device = await api('register_device', { name: `${plan.client} on this machine`, client: plan.client, platform: process.platform });
      const record: typeof created[number] = { deviceId: device.id }; created.push(record);
      const credential = await api('create_credential', { name: `${plan.client} local MCP`, deviceId: device.id });
      record.credentialId = credential.id;
      saveConnection(plan.credentialPath, { url: base, token: credential.token, credentialId: credential.id, deviceId: device.id, userId: overview.user.id, client: plan.client });
      record.path = plan.credentialPath;
    }
    writeConfigs(plans);
    return { plans, activated: true };
  } catch (error) {
    let cleanupFailed = false;
    for (const record of created.reverse()) {
      if (record.credentialId) await api('revoke_credential', { credentialId: record.credentialId }).catch(() => { cleanupFailed = true; });
      await api('revoke_device', { deviceId: record.deviceId }).catch(() => { cleanupFailed = true; });
      if (record.path) { try { unlinkSync(record.path); } catch { cleanupFailed = true; } }
    }
    if (cleanupFailed) throw new SetupCleanupError();
    throw error;
  }
}

async function hiddenToken() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Provide WORKTETHER_MCP_TOKEN or run setup in an interactive terminal.');
  process.stdout.write('Paste your WorkTether MCP credential (hidden): ');
  return await new Promise<string>((resolveToken, reject) => {
    let value = '';
    process.stdin.setRawMode(true); process.stdin.resume();
    const finish = (error?: Error) => {
      process.stdin.off('data', input); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else resolveToken(value.trim());
    };
    const input = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { finish(new Error('Setup canceled.')); return; }
        if (char === '\r' || char === '\n') { finish(); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (/^[A-Za-z0-9_-]$/.test(char)) value += char;
        if (value.length > 1000) { finish(new Error('Invalid credential.')); return; }
      }
    };
    process.stdin.on('data', input);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let client = 'all', url = process.env.WORKTETHER_URL || 'http://127.0.0.1:4318', configureOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--configure-only') configureOnly = true;
    else if (args[i] === '--client' && args[i + 1]) client = args[++i];
    else if (args[i] === '--url' && args[i + 1]) url = args[++i];
    else throw new Error('Usage: setup:mcp [--client all|codex|cursor|claude-code|claude-desktop] [--url SERVICE_ORIGIN] [--configure-only]');
  }
  const selected = client === 'all' ? clients : clients.filter(item => item === client);
  if (!selected.length) throw new Error('Unknown client. Choose codex, cursor, claude-code, claude-desktop, or all.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const token = configureOnly ? undefined : process.env.WORKTETHER_MCP_TOKEN || await hiddenToken();
  const result = await setupConnections({ root, selected, url, token, configureOnly });
  process.stdout.write(`${result.activated ? 'Personal connections activated' : 'Configuration generated; sign-in/credential setup still required'}.\n`);
  for (const plan of result.plans) process.stdout.write(`${plan.client}: ${plan.path}\n`);
  process.stdout.write('Open/trust this WorkTether folder in Codex, Cursor or Claude Code and reconnect MCP. Merge the generated Claude Desktop entry into its local server configuration, then restart Desktop.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(error instanceof SetupCleanupError ? `${error.message}\n` : 'WorkTether setup failed. Check the service, credential, selected client and existing config files. Run from an interactive terminal; secrets are never printed.\n');
    process.exitCode = 1;
  });
}
