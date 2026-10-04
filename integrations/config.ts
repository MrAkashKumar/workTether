import { existsSync, lstatSync, readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

export const clients = ['codex', 'cursor', 'claude-code', 'claude-desktop'] as const;
export type ClientName = typeof clients[number];
export type Connection = { url: string; token: string; credentialId?: string; deviceId?: string; userId?: string; client?: string; machineName?: string };
export type ConfigPlan = { client: ClientName; path: string; content: string; credentialPath: string };

export function serviceUrl(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('Use a service origin without credentials, query, or path.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('HTTP is allowed only for a loopback service.');
  return url.origin;
}

export function credentialPath(root: string, client: ClientName) { return join(resolve(root), '.worktether', 'connections', `${client}.json`); }

export function machineLabel(value?: string) {
  if (value === undefined) return 'this machine';
  const label = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/.test(label)) throw new Error('Laptop name must be 1–64 characters: letters, numbers, spaces, dots, underscores or hyphens.');
  return label;
}

function rejectSymlinks(path: string) {
  let current = resolve(path);
  while (true) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Configuration and credential paths must not be symbolic links.');
    const parent = dirname(current); if (parent === current) break; current = parent;
  }
}

export function readConnection(path?: string, env: NodeJS.ProcessEnv = process.env): Connection {
  if (path && existsSync(path)) {
    rejectSymlinks(path);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.size > 65_536) throw new Error('Invalid credential file.');
    if (process.platform !== 'win32' && (stat.mode & 0o077)) throw new Error('Credential file must be private (chmod 600).');
    let saved: any;
    try { saved = JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw new Error('Invalid credential file.'); }
    if (!saved || typeof saved.token !== 'string' || !/^wt_[A-Za-z0-9_-]{43}$/.test(saved.token)) throw new Error('Invalid credential file.');
    return { ...saved, url: serviceUrl(saved.url) };
  }
  if (!env.WORKTETHER_MCP_TOKEN || !/^wt_[A-Za-z0-9_-]{43}$/.test(env.WORKTETHER_MCP_TOKEN)) throw new Error('Run npm run setup:mcp to sign in, or provide WORKTETHER_MCP_TOKEN.');
  return { url: serviceUrl(env.WORKTETHER_URL || 'http://127.0.0.1:4318'), token: env.WORKTETHER_MCP_TOKEN };
}

export function saveConnection(path: string, connection: Connection) {
  rejectSymlinks(path);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') { chmodSync(dirname(path), 0o700); chmodSync(dirname(dirname(path)), 0o700); }
  writeFileSync(path, `${JSON.stringify(connection, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export function configPlans(root: string, selected: readonly ClientName[], node = process.execPath): ConfigPlan[] {
  const project = resolve(root), bridge = join(project, 'server', 'stdio.ts');
  const loader = import.meta.resolve('tsx');
  return selected.map(client => {
    const secretPath = credentialPath(project, client);
    const entry = { command: node, args: ['--import', loader, bridge, '--credential-file', secretPath] };
    let path: string, content: string;
    if (client === 'codex') {
      path = join(project, '.codex', 'config.toml');
      rejectSymlinks(path);
      const section = `[mcp_servers.worktether]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\nenv_vars = ["WORKTETHER_MCP_TOKEN", "WORKTETHER_URL"]\n`;
      const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
      if (/^\s*\[\s*mcp_servers\.(?:worktether|"worktether")\s*\]/m.test(existing)) {
        if (!existing.includes(section.trim())) throw new Error('Existing Codex WorkTether config differs; review it before replacing.');
        content = existing;
      } else content = `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${existing ? '\n' : ''}${section}`;
    } else {
      path = client === 'cursor' ? join(project, '.cursor', 'mcp.json') : client === 'claude-code' ? join(project, '.mcp.json') : join(project, '.worktether', 'claude-desktop-config.json');
      rejectSymlinks(path);
      const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
      if (!existing || Array.isArray(existing) || typeof existing !== 'object' || (existing.mcpServers && (Array.isArray(existing.mcpServers) || typeof existing.mcpServers !== 'object'))) throw new Error('Invalid existing client configuration.');
      if (existing.mcpServers?.worktether && JSON.stringify(existing.mcpServers.worktether) !== JSON.stringify(entry)) throw new Error(`Existing ${client} WorkTether config differs; review it before replacing.`);
      content = `${JSON.stringify({ ...existing, mcpServers: { ...existing.mcpServers, worktether: entry } }, null, 2)}\n`;
    }
    rejectSymlinks(path); rejectSymlinks(secretPath);
    return { client, path, content, credentialPath: secretPath };
  });
}

export function writeConfigs(plans: ConfigPlan[]) {
  for (const plan of plans) {
    rejectSymlinks(plan.path);
    mkdirSync(dirname(plan.path), { recursive: true });
    writeFileSync(plan.path, plan.content);
  }
}
