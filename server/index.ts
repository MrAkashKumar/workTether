import express, { type Request, type Response, type NextFunction } from 'express';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { Store, DomainError, type User } from './store';
import { mcpAdapter } from './mcp';

type AuthRequest = Request & { user?: User; rawToken?: string; auth?: { token: string; clientId: string; scopes: string[] } };
export function createApp(dbPath: string, options: { seed?: boolean; origins?: string[] } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const store = new Store(dbPath, { seed: options.seed });
  const adapter = mcpAdapter(store);
  const app = express();
  app.disable('x-powered-by');
  const allowed = new Set(options.origins ?? (process.env.WORKTETHER_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4318,http://localhost:4318').split(','));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    const hostname = req.hostname.toLowerCase();
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) return next(new DomainError(403, 'INVALID_HOST', 'Local requests require a loopback host.'));
    if (req.headers.origin && !allowed.has(req.headers.origin)) return next(new DomainError(403, 'INVALID_ORIGIN', 'This origin is not allowed.'));
    next();
  });
  const origin = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.origin || !allowed.has(req.headers.origin)) return next(new DomainError(403, 'ORIGIN_REQUIRED', 'Browser mutations require a trusted Origin header.'));
    next();
  };
  const cookieToken = (req: Request) => {
    const value = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('worktether_session='))?.slice('worktether_session='.length);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
  };
  const authenticate = (bearerOnly: boolean) => (req: AuthRequest, _res: Response, next: NextFunction) => {
    const bearer = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '')?.[1];
    const token = bearer || (bearerOnly ? '' : cookieToken(req));
    const user = store.authenticate(token);
    if (!user) return next(new DomainError(401, 'UNAUTHENTICATED', 'Sign in or provide a valid MCP credential.'));
    req.user = user; req.rawToken = token; req.auth = { token, clientId: user.id, scopes: ['worktether'] };
    next();
  };
  // Authentication precedes transport parsing. Browser cookies cannot authenticate MCP.
  app.all('/mcp', authenticate(true), async (req, res, next) => { try { await adapter.handle(req, res); } catch (cause) { next(cause); } });
  app.use('/api', express.json({ limit: '8mb' }));
  const attempts = new Map<string, { count: number; until: number }>();
  const limitAuth = (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip || 'local', time = Date.now();
    if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until < time) attempts.delete(k);
    const value = attempts.get(key);
    if (!value || value.until < time) attempts.set(key, { count: 1, until: time + 60_000 });
    else if (++value.count > 30) return next(new DomainError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again in a minute.'));
    next();
  };
  const setSession = (res: Response, token: string) => res.cookie('worktether_session', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 86400_000, path: '/' });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'local', version: '0.1.0' }));
  app.post('/api/auth/login', origin, limitAuth, (req, res) => {
    const input = z.object({ email: z.string().max(250), password: z.string().max(1024) }).parse(req.body);
    const result = store.login(input.email, input.password); setSession(res, result.token); res.json({ user: result.user });
  });
  app.post('/api/auth/register', origin, limitAuth, (req, res) => {
    const input = z.object({ name: z.string().max(160), email: z.string().max(250), password: z.string().max(1024) }).parse(req.body);
    const result = store.register(input); setSession(res, result.token); res.status(201).json({ user: result.user });
  });
  app.post('/api/auth/logout', origin, authenticate(false), (req: AuthRequest, res) => { store.logout(req.rawToken!); res.clearCookie('worktether_session', { path: '/', httpOnly: true, sameSite: 'strict' }); res.json({ ok: true }); });
  app.get('/api/bootstrap', authenticate(false), (req: AuthRequest, res) => {
    const input = z.object({ projectId: z.string().optional(), query: z.string().max(200).optional(), sourceOffset: z.coerce.number().int().nonnegative().optional(), revisionOffset: z.coerce.number().int().nonnegative().optional(), handoffOffset: z.coerce.number().int().nonnegative().optional(), offset: z.coerce.number().int().nonnegative().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query);
    res.json(store.execute(req.user!.id, 'bootstrap', input));
  });
  app.post('/api/action', authenticate(false), (req: AuthRequest, res, next) => {
    if (!req.headers.authorization && (!req.headers.origin || !allowed.has(req.headers.origin))) return next(new DomainError(403, 'ORIGIN_REQUIRED', 'Browser mutations require a trusted Origin header.'));
    const input = z.object({ action: z.string().max(100), input: z.record(z.string(), z.unknown()).default({}) }).parse(req.body);
    res.json(store.execute(req.user!.id, input.action, input.input));
  });
  app.get('/api/attachments/:id', authenticate(false), (req: AuthRequest, res) => {
    const file = store.execute(req.user!.id, 'get_attachment', { attachmentId: req.params.id });
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.send(Buffer.from(file.contentBase64, 'base64'));
  });
  app.use('/api', (_req, _res, next) => next(new DomainError(404, 'NOT_FOUND', 'Endpoint not found.')));
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html'))); }
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const failure = error instanceof DomainError ? error : error instanceof z.ZodError ? new DomainError(400, 'INVALID_INPUT', 'Request fields are invalid.', error.flatten()) : error?.type === 'entity.too.large' ? new DomainError(413, 'TOO_LARGE', 'Request exceeds 8 MiB.') : error instanceof SyntaxError ? new DomainError(400, 'INVALID_JSON', 'Request must contain valid JSON.') : new DomainError(500, 'INTERNAL_ERROR', 'The operation failed.');
    res.status(failure.status).json({ error: { code: failure.code, message: failure.message, details: failure.details } });
  });
  return { app, store, close: async () => { await adapter.close(); store.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be from 1 to 65535.');
  const runtime = createApp(process.env.WORKTETHER_DB || 'data/worktether.sqlite', { seed: process.env.WORKTETHER_SEED !== 'false' });
  const server = runtime.app.listen(port, '127.0.0.1', () => process.stdout.write(`WorkTether local server: http://127.0.0.1:${port}\nMCP endpoint: http://127.0.0.1:${port}/mcp\n`));
  const stop = () => server.close(() => { void runtime.close().then(() => process.exit(0)); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
