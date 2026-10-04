import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { compactPromptContext, composePrompt, promptFormats, promptMethod } from './prompts';

export class DomainError extends Error {
  constructor(public status: number, public code: string, message: string, public details: any = undefined) {
    super(message); this.name = 'DomainError';
  }
}

type RecordData = Record<string, any>;
export type User = { id: string; name: string; email: string; sample?: boolean };
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${randomUUID()}`;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = (status: number, code: string, message: string, details?: any): never => { throw new DomainError(status, code, message, details); };
const cleanUser = (user: RecordData): User => ({ id: user.id, name: user.name, email: user.email, ...(user.sample ? { sample: true } : {}) });
const string = (value: any, field: string, max = 100_000, allowEmpty = false): string => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) fail(400, 'INVALID_INPUT', `${field} must be ${allowEmpty ? 'a' : 'a nonempty'} string of at most ${max} characters.`);
  return value;
};
const actions = new Set(['prepare_prompt', 'get_prepared_prompt', 'list_prepared_prompts', 'save_prepared_prompt', 'bootstrap', 'list_works', 'list_sources', 'create_project', 'update_project', 'add_member', 'create_work', 'update_work', 'create_conversation', 'list_conversations', 'add_source', 'correct_source', 'resolve_review', 'set_source_active', 'get_context', 'get_context_snapshot', 'get_graph', 'share_work', 'revoke_grant', 'reassign_work', 'send_handoff', 'list_inbox', 'get_handoff', 'acknowledge_handoff', 'mark_handoff_read', 'revoke_handoff', 'register_device', 'revoke_device', 'create_credential', 'revoke_credential', 'get_attachment', 'add_attachment']);
const mimeTypes = new Set(['text/plain', 'text/markdown', 'application/pdf', 'image/png', 'image/jpeg']);

/** Durable local domain store. Every exposed operation checks the authenticated actor. */
export class Store {
  private db: DatabaseSync;
  constructor(dbPath: string, options: { seed?: boolean } = {}) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(entity,id));');
    if (options.seed !== false && this.all('user').length === 0) this.seed();
  }
  close() { this.db.close(); }
  private all(entity: string): RecordData[] { return this.db.prepare('SELECT body FROM records WHERE entity=? ORDER BY rowid').all(entity).map(row => JSON.parse(row.body as string)); }
  private get(entity: string, recordId: string): RecordData | undefined {
    if (typeof recordId !== 'string' || !recordId || recordId.length > 200) fail(400, 'INVALID_INPUT', 'Provide a valid record ID.');
    const row = this.db.prepare('SELECT body FROM records WHERE entity=? AND id=?').get(entity, recordId); return row ? JSON.parse(row.body as string) : undefined;
  }
  private put(entity: string, value: RecordData) {
    if (entity === 'source') value = { ...value, updatedAt: now() };
    this.db.prepare('INSERT INTO records(entity,id,body) VALUES(?,?,?) ON CONFLICT(entity,id) DO UPDATE SET body=excluded.body').run(entity, value.id, JSON.stringify(value));
    if (['work', 'project', 'source'].includes(entity) && Number.isInteger(value.revision)) {
      const history = { id: `${entity}:${value.id}:${value.revision}`, type: entity, recordId: value.id, revision: value.revision, snapshot: value, createdAt: now() };
      this.db.prepare('INSERT OR IGNORE INTO records(entity,id,body) VALUES(?,?,?)').run('revision', history.id, JSON.stringify(history));
    }
    return value;
  }
  private remove(entity: string, recordId: string) { this.db.prepare('DELETE FROM records WHERE entity=? AND id=?').run(entity, recordId); }
  private transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  private user(userId: string) { return this.get('user', userId) ?? fail(401, 'UNAUTHENTICATED', 'Sign in to continue.'); }
  private isMember(userId: string, projectId: string) { return this.all('membership').some(m => m.userId === userId && m.projectId === projectId); }
  private project(userId: string, projectId: string) {
    const p = this.get('project', projectId);
    if (!p || !this.isMember(userId, projectId)) fail(404, 'NOT_FOUND', 'Project not found.');
    return p!;
  }
  private projectOwner(userId: string, projectId: string) { const p = this.project(userId, projectId); if (p.ownerId !== userId) fail(403, 'FORBIDDEN', 'Only the project owner can perform this action.'); return p; }
  private permission(userId: string, work: RecordData): 'owner' | 'edit' | 'read' | null {
    if (!this.isMember(userId, work.projectId)) return null;
    if (work.ownerId === userId) return 'owner';
    const grant = this.all('grant').find(g => g.workId === work.id && g.userId === userId);
    return grant?.permission ?? (work.visibility === 'project' ? 'read' : null);
  }
  private work(userId: string, workId: string, operation: 'read' | 'edit' | 'owner' = 'read') {
    const w = this.get('work', workId);
    const permission = w && this.permission(userId, w);
    if (!w || !permission) fail(404, 'NOT_FOUND', 'Work not found.');
    if (operation === 'owner' && permission !== 'owner') fail(403, 'FORBIDDEN', 'Only the work owner can share or assign this work.');
    if (operation === 'edit' && permission === 'read') fail(403, 'FORBIDDEN', 'Edit access is required.');
    return w!;
  }
  private source(userId: string, sourceId: string, operation: 'read' | 'edit' = 'read') {
    const s = this.get('source', sourceId); if (!s) fail(404, 'NOT_FOUND', 'Source not found.');
    try { this.work(userId, s!.workId, operation); } catch (error) { if (error instanceof DomainError && error.status === 404) fail(404, 'NOT_FOUND', 'Source not found.'); throw error; }
    return s!;
  }
  private expected(record: RecordData, revision: any) { if (!Number.isInteger(revision) || revision !== record.revision) fail(409, 'REVISION_CONFLICT', 'The record changed. Review the current revision before updating.', { currentRevision: record.revision }); }
  private audit(userId: string, action: string, data: RecordData = {}) { return this.put('event', { id: id('evt'), actorId: userId, action, createdAt: now(), ...data }); }
  private touch(work: RecordData) { return this.put('work', { ...work, revision: work.revision + 1, updatedAt: now() }); }
  private member(userId: string, projectId: string) { if (!this.isMember(userId, projectId)) fail(400, 'INVALID_RECIPIENT', 'The recipient must be a member of this project.'); return this.user(userId); }
  private accessibleWorks(userId: string, projectId?: string) { return this.all('work').filter(w => (!projectId || w.projectId === projectId) && this.permission(userId, w)).map(w => this.workView(userId, w)); }
  private workView(userId: string, w: RecordData): RecordData {
    const permission = this.permission(userId, w);
    return { ...w, canEdit: permission === 'owner' || permission === 'edit', canShare: permission === 'owner', grants: permission === 'owner' ? this.all('grant').filter(g => g.workId === w.id).map(g => ({ userId: g.userId, name: this.user(g.userId).name, permission: g.permission })) : [] };
  }
  private page<T>(items: T[], offsetInput?: number, limitInput?: number, defaultLimit = 40, maximumLimit = 100) {
    const offset = offsetInput ?? 0, limit = limitInput ?? defaultLimit;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > maximumLimit) fail(400, 'INVALID_PAGINATION', `offset must be a nonnegative integer and limit must be from 1 to ${maximumLimit}.`);
    return { items: items.slice(offset, offset + limit), total: items.length, offset, limit, nextOffset: offset + limit < items.length ? offset + limit : null };
  }
  private workPage(userId: string, projectId: string, p: RecordData) {
    this.project(userId, projectId);
    const query = p.query === undefined ? '' : string(p.query, 'query', 200, true).trim().toLowerCase();
    const works = this.accessibleWorks(userId, projectId).filter(w => !query || `${w.id} ${w.title} ${w.objective} ${w.nextAction}`.toLowerCase().includes(query)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return this.page(works, p.offset, p.limit);
  }
  private sourcePage(userId: string, workId: string, p: RecordData) {
    this.work(userId, workId);
    if (p.includeHistory !== undefined && typeof p.includeHistory !== 'boolean') fail(400, 'INVALID_INPUT', 'includeHistory must be a boolean.');
    const sources = this.all('source').filter(s => s.workId === workId && (p.includeHistory || (s.status !== 'superseded' && s.active !== false))).reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return this.page(sources, p.offset, p.limit, 200, 200);
  }
  private handoff(userId: string, handoffId: string) {
    const h = this.get('handoff', handoffId);
    if (!h || h.revoked || !this.isMember(userId, h.projectId) || (h.senderId !== userId && h.recipientId !== userId)) fail(404, 'NOT_FOUND', 'Handoff not found.');
    return h!;
  }
  private publicCredential(value: RecordData) { const { tokenHash: _hash, ...metadata } = value; return metadata; }
  private handoffMetadata(value: RecordData) {
    const { content: _content, sourceSnapshots, attachmentIds, idempotencyKey: _key, fingerprint: _fingerprint, ...metadata } = value;
    return { ...metadata, sourceCount: sourceSnapshots.length, attachmentCount: attachmentIds.length };
  }
  private dependentIds(sourceId: string) {
    const adjacency = new Map<string, string[]>();
    for (const e of this.all('edge').filter(e => e.kind === 'depends_on')) adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
    const affected = new Set<string>([sourceId]), queue = [sourceId];
    for (let cursor = 0; cursor < queue.length; cursor++) for (const dependentId of adjacency.get(queue[cursor]) ?? []) if (!affected.has(dependentId)) { affected.add(dependentId); queue.push(dependentId); }
    return affected;
  }

  /** Local account registration only; public hosted deployment must configure reviewed identity. */
  register(input: { name: string; email: string; password: string }): { token: string; user: User } {
    const name = string(input.name, 'name', 160), email = string(input.email, 'email', 250).trim().toLowerCase();
    const password = string(input.password, 'password', 1024);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) fail(400, 'INVALID_INPUT', 'Use a valid email and a password of at least 12 characters.');
    this.transaction(() => {
      if (this.all('user').some(u => u.email === email)) fail(409, 'ACCOUNT_EXISTS', 'An account already uses that email.');
      const salt = randomBytes(16).toString('hex');
      this.put('user', { id: id('usr'), name, email, salt, passwordHash: scryptSync(password, salt, 64).toString('hex'), createdAt: now() });
    });
    return this.login(email, password);
  }

  login(email: string, password: string): { token: string; user: User } {
    const u = this.all('user').find(v => v.email === String(email).trim().toLowerCase());
    // The same work is performed for missing accounts to reduce account enumeration.
    const salt = u?.salt ?? '00000000000000000000000000000000';
    const candidate = scryptSync(String(password), salt, 64);
    const expected = Buffer.from(u?.passwordHash ?? '00'.repeat(64), 'hex');
    if (!u || !timingSafeEqual(candidate, expected)) fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = randomBytes(32).toString('base64url');
    this.put('session', { id: id('ses'), userId: u!.id, tokenHash: hash(token), createdAt: now(), expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(), revoked: false });
    return { token, user: cleanUser(u!) };
  }
  authenticate(rawToken: string): User | null {
    if (!rawToken) return null;
    const digest = hash(rawToken);
    const session = this.all('session').find(s => s.tokenHash === digest && !s.revoked && s.expiresAt > now());
    const credential = this.all('credential').find(c => c.tokenHash === digest && !c.revoked);
    const auth = session ?? credential;
    if (!auth) return null;
    if (credential?.deviceId) {
      const device = this.get('device', credential.deviceId);
      if (!device || device.revoked || device.userId !== credential.userId) return null;
      this.put('device', { ...device, lastObservedAt: now(), lastSeenAt: now() });
    }
    const u = this.get('user', auth.userId);
    return u ? cleanUser(u) : null;
  }
  logout(rawToken: string) {
    const digest = hash(rawToken);
    for (const entity of ['session', 'credential']) for (const row of this.all(entity)) if (row.tokenHash === digest) this.put(entity, { ...row, revoked: true });
  }

  execute(userId: string, action: string, input: RecordData = {}): any {
    this.user(userId);
    if (!actions.has(action)) fail(400, 'UNKNOWN_ACTION', 'Unknown operation.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'INVALID_INPUT', 'Input must be an object.');
    return this.transaction(() => this.dispatch(userId, action, input));
  }
  private dispatch(userId: string, action: string, p: RecordData): any {
    switch (action) {
      case 'bootstrap': {
        const projects = this.all('project').filter(x => this.isMember(userId, x.id));
        const project = p.projectId ? this.project(userId, p.projectId) : projects[0] ?? null;
        const workPage = project ? this.workPage(userId, project.id, p) : this.page([], p.offset, p.limit);
        const { items: works, ...workPageMetadata } = workPage;
        const workIds = new Set(works.map(w => w.id));
        const allProjectWorks = project ? this.accessibleWorks(userId, project.id) : [];
        const allProjectWorkIds = new Set(allProjectWorks.map(w => w.id));
        const allSources = this.all('source');
        const evidence = allSources.filter(s => allProjectWorkIds.has(s.workId) && s.kind === 'evidence' && s.status !== 'superseded' && s.active !== false);
        const evidenceCounts = { verified: evidence.filter(s => s.status === 'verified').length, needs_review: evidence.filter(s => s.status === 'needs_review').length, unverified: evidence.filter(s => !['verified', 'needs_review'].includes(s.status)).length, total: evidence.length };
        const { items: sources, ...sourcePageMetadata } = this.page(allSources.filter(s => workIds.has(s.workId)).reverse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), p.sourceOffset, 200, 200, 200);
        const sourceIds = new Set(sources.map(s => s.id));
        const { items: attachments, ...attachmentPage } = this.page(this.all('attachment').filter(a => workIds.has(a.workId)).reverse().map(({ contentBase64: _content, ...metadata }) => metadata), 0, 200, 200, 200);
        const relevantHandoffs = this.all('handoff').filter(h => !h.revoked && (!project || h.projectId === project.id) && this.isMember(userId, h.projectId) && (h.senderId === userId || h.recipientId === userId)).reverse();
        const { items: handoffs, ...handoffPage } = this.page(relevantHandoffs.map(h => this.handoffMetadata(h)), p.handoffOffset, 100, 100, 100);
        const handoffIds = new Set(relevantHandoffs.map(h => h.id));
        const { items: revisions, ...revisionPage } = this.page(this.all('revision').filter(r => r.type === 'project' ? project?.id === r.recordId : r.type === 'work' ? workIds.has(r.recordId) : sourceIds.has(r.recordId)).reverse(), p.revisionOffset, 200, 200, 200);
        const { items: conversations, ...conversationPage } = this.page(this.all('conversation').filter(c => workIds.has(c.workId)).reverse(), p.conversationOffset, 100, 100, 200);
        return { user: cleanUser(this.user(userId)), projects, project, members: project ? this.all('membership').filter(m => m.projectId === project.id).map(m => cleanUser(this.user(m.userId))) : [], works, workPage: workPageMetadata, sources, sourcePage: sourcePageMetadata, evidenceCounts, revisions, revisionPage, attachments, attachmentPage, conversations, conversationPage, edges: this.all('edge').filter(e => sourceIds.has(e.from) && sourceIds.has(e.to)), handoffs, handoffPage,
          devices: this.all('device').filter(d => d.userId === userId), credentials: this.all('credential').filter(c => c.userId === userId).map(c => this.publicCredential(c)),
          events: this.all('event').filter(e => (!project || e.projectId === project.id || !e.projectId) && (e.handoffId ? handoffIds.has(e.handoffId) || e.actorId === userId : e.workId ? workIds.has(e.workId) : e.projectId ? this.isMember(userId, e.projectId) : e.actorId === userId)).slice(-100).reverse() };
      }
      case 'prepare_prompt': {
        const w = this.work(userId, p.workId);
        const originalRequest = string(p.originalRequest, 'originalRequest', 20000);
        const format = p.format ?? 'request';
        if (!Object.hasOwn(promptFormats, format)) fail(400, 'INVALID_INPUT', 'Choose a supported response format.');
        if (p.conversationId !== undefined) {
          const conversation = this.get('conversation', p.conversationId);
          if (!conversation || conversation.workId !== w.id || conversation.ownerId !== userId) fail(400, 'INVALID_CONVERSATION', 'Choose one of your conversations associated with this work.');
        }
        const snapshot = this.context(userId, w.id, p.budgetBytes);
        const addedContext = compactPromptContext(snapshot);
        const preparedText = composePrompt(originalRequest, format as keyof typeof promptFormats, addedContext);
        const draft = this.put('prepared_prompt', { id: id('pmt'), actorId: userId, workId: w.id, projectId: w.projectId, conversationId: p.conversationId ?? null, originalRequest, format, method: promptMethod, preparedText, preparedBytes: Buffer.byteLength(preparedText, 'utf8'), contextId: snapshot.id, context: snapshot, addedContext, workRevision: w.revision, projectRevision: snapshot.projectRevision, sourceRevisions: Object.fromEntries([...snapshot.sources, ...snapshot.corrections].map((source: RecordData) => [source.id, source.revision])), createdAt: now(), savedSourceId: null });
        return { ...draft, stale: false };
      }
      case 'get_prepared_prompt': return this.preparedPrompt(userId, p.promptId);
      case 'list_prepared_prompts': {
        this.work(userId, p.workId);
        const items = this.all('prepared_prompt').filter(draft => draft.actorId === userId && draft.workId === p.workId).reverse().map(draft => ({ id: draft.id, workId: draft.workId, createdAt: draft.createdAt, format: draft.format, savedSourceId: draft.savedSourceId }));
        return this.page(items, p.offset, p.limit, 10, 100);
      }
      case 'save_prepared_prompt': {
        const draft = this.preparedPrompt(userId, p.promptId);
        const w = this.work(userId, draft.workId, 'edit');
        const title = string(p.title, 'title', 200);
        if (p.reviewed !== true) fail(400, 'REVIEW_REQUIRED', 'Review the original request, added context, and warnings before saving.');
        if (draft.savedSourceId) {
          if (draft.savedTitle !== title) fail(409, 'IDEMPOTENCY_CONFLICT', 'This draft was already saved with a different title.');
          return this.source(userId, draft.savedSourceId);
        }
        this.expected(w, p.expectedRevision);
        if (draft.stale) fail(409, 'STALE_CONTEXT', 'The work or requirements changed. Prepare a new draft before saving.');
        const source = this.addSource(userId, { workId: w.id, kind: 'prompt', title, content: draft.originalRequest, status: 'proposed', dependsOn: Object.keys(draft.sourceRevisions), ...(draft.conversationId ? { conversationId: draft.conversationId } : {}) }, { promptId: draft.id, method: draft.method, format: draft.format, contextId: draft.contextId, workRevision: draft.workRevision, projectRevision: draft.projectRevision, sourceRevisions: draft.sourceRevisions, reviewedBy: userId, reviewedAt: now() });
        this.put('prepared_prompt', { ...draft, savedSourceId: source.id, savedTitle: title });
        return source;
      }
      case 'list_works': return this.workPage(userId, p.projectId, p);
      case 'list_sources': return this.sourcePage(userId, p.workId, p);
      case 'create_project': {
        const project = this.put('project', { id: id('prj'), name: string(p.name, 'name', 160), objective: string(p.objective, 'objective'), requirements: '', revision: 1, ownerId: userId, createdAt: now() });
        this.put('membership', { id: `${project.id}:${userId}`, userId, projectId: project.id });
        this.audit(userId, action, { projectId: project.id }); return project;
      }
      case 'update_project': {
        const project = this.projectOwner(userId, p.projectId); this.expected(project, p.expectedRevision);
        const updated = this.put('project', { ...project, objective: string(p.objective ?? project.objective, 'objective'), requirements: string(p.requirements ?? project.requirements, 'requirements', 100_000, true), revision: project.revision + 1 });
        if (updated.objective !== project.objective || updated.requirements !== project.requirements) {
          const projectWorks = this.all('work').filter(w => w.projectId === project.id), affectedWorkIds = new Set(projectWorks.map(w => w.id));
          for (const w of projectWorks) this.touch({ ...w, needsReview: true });
          for (const h of this.all('handoff').filter(h => affectedWorkIds.has(h.workId) && !h.revoked)) this.put('handoff', { ...h, stale: true, staleReason: 'The shared project requirements changed after this snapshot.' });
          for (const s of this.all('source').filter(s => affectedWorkIds.has(s.workId) && s.status !== 'superseded')) this.put('source', { ...s, status: 'needs_review', revision: s.revision + 1, reviewReason: 'The shared project requirements changed.' });
        }
        this.audit(userId, action, { projectId: project.id }); return updated;
      }
      case 'add_member': {
        const project = this.projectOwner(userId, p.projectId); const email = string(p.email, 'email', 250).trim().toLowerCase();
        const u = this.all('user').find(u => u.email === email) ?? fail(404, 'NOT_FOUND', 'No local account has that email.');
        this.put('membership', { id: `${project.id}:${u.id}`, userId: u.id, projectId: project.id });
        this.audit(userId, action, { projectId: project.id }); return cleanUser(u);
      }
      case 'create_work': {
        const project = this.project(userId, p.projectId); const visibility = p.visibility ?? 'private';
        if (!['private', 'project'].includes(visibility)) fail(400, 'INVALID_INPUT', 'Unknown visibility.');
        const work = this.put('work', { id: id('wrk'), projectId: p.projectId, ownerId: userId, title: string(p.title, 'title', 200), objective: string(p.objective, 'objective'), nextAction: string(p.nextAction ?? '', 'nextAction', 100_000, true), status: 'active', visibility, revision: 1, reviewedProjectRevision: project.revision, needsReview: false, updatedAt: now() });
        this.audit(userId, action, { workId: work.id, projectId: work.projectId }); return work;
      }
      case 'update_work': {
        const w = this.work(userId, p.workId, 'edit'); this.expected(w, p.expectedRevision);
        const updated = { ...w };
        for (const field of ['title', 'objective', 'nextAction']) if (p[field] !== undefined) updated[field] = string(p[field], field, field === 'title' ? 200 : 100_000, field === 'nextAction');
        if (p.status !== undefined) { if (!['planned', 'active', 'review', 'blocked', 'done'].includes(p.status)) fail(400, 'INVALID_INPUT', 'Unknown workflow status.'); updated.status = p.status; }
        if (p.reviewedProjectRevision !== undefined) {
          const project = this.project(userId, w.projectId); this.expected(project, p.reviewedProjectRevision);
          updated.reviewedProjectRevision = project.revision;
          updated.reviewedAt = now(); updated.reviewedBy = userId;
          if (p.reviewNote !== undefined) updated.reviewNote = string(p.reviewNote, 'reviewNote');
          updated.needsReview = this.all('source').some(s => s.workId === w.id && s.status === 'needs_review' && s.active !== false);
        }
        const result = this.touch(updated); this.staleHandoffs(w.id);
        this.audit(userId, action, { workId: w.id, projectId: w.projectId }); return result;
      }
      case 'create_conversation': {
        const w = this.work(userId, p.workId, 'edit');
        const conversation = this.put('conversation', { id: id('conv'), workId: w.id, ownerId: userId, title: string(p.title, 'title', 200), client: p.client === undefined ? null : string(p.client, 'client', 100), machineName: p.machineName === undefined ? null : string(p.machineName, 'machineName', 64), clientReference: p.clientReference === undefined ? null : string(p.clientReference, 'clientReference', 1000, true), createdAt: now() });
        this.audit(userId, action, { workId: w.id, projectId: w.projectId, conversationId: conversation.id }); return conversation;
      }
      case 'list_conversations': { this.work(userId, p.workId); return this.page(this.all('conversation').filter(c => c.workId === p.workId).reverse(), p.offset, p.limit, 100, 200); }
      case 'add_source': return this.addSource(userId, p);
      case 'correct_source': {
        const s = this.source(userId, p.sourceId, 'edit'); this.expected(s, p.expectedRevision); if (s.status === 'superseded') fail(409, 'ALREADY_SUPERSEDED', 'Correct the current replacement source.');
        const content = string(p.content, 'content'), reason = string(p.reason, 'reason', 2000);
        const title = p.title === undefined ? s.title : string(p.title, 'title', 200);
        const replacement = this.put('source', { ...s, id: id('src'), title, content, status: 'needs_review', revision: 1, supersedesId: s.id, authorId: userId, createdAt: now(), correctionReason: reason, reviewNote: null, reviewedBy: null, reviewedAt: null });
        this.put('source', { ...s, status: 'superseded', revision: s.revision + 1, replacementId: replacement.id });
        this.put('edge', { id: id('edge'), from: s.id, to: replacement.id, kind: 'supersedes' });
        const edges = this.all('edge').filter(e => e.kind === 'depends_on');
        for (const e of edges.filter(e => e.to === s.id)) this.put('edge', { id: id('edge'), from: e.from, to: replacement.id, kind: 'depends_on' });
        const affected = this.dependentIds(s.id);
        const affectedWorks = new Set<string>([s.workId]);
        for (const sourceId of affected) { const dependent = this.get('source', sourceId); if (!dependent) continue; affectedWorks.add(dependent.workId); if (sourceId !== s.id && dependent.status !== 'superseded') this.put('source', { ...dependent, status: 'needs_review', revision: dependent.revision + 1, reviewReason: 'A recorded dependency was corrected.' }); }
        for (const workId of affectedWorks) { const w = this.get('work', workId)!; this.touch({ ...w, needsReview: true }); this.staleHandoffs(workId); }
        const w = this.get('work', s.workId)!;
        this.audit(userId, action, { workId: w.id, projectId: w.projectId, sourceId: s.id, replacementId: replacement.id });
        // Counts disclose only records the actor can read; private dependents are updated internally.
        return { source: replacement, affectedSourceIds: [...affected].filter(x => { const v = this.get('source', x); return v && this.permission(userId, this.get('work', v.workId)!); }) };
      }
      case 'resolve_review': {
        const s = this.source(userId, p.sourceId, 'edit'); this.expected(s, p.expectedRevision);
        const reviewNote = string(p.note, 'note');
        if (s.status === 'superseded' || s.active === false || !['proposed', 'accepted', 'verified'].includes(p.status)) fail(400, 'INVALID_INPUT', 'Choose an active current source and a valid resolution status.');
        for (const e of this.all('edge').filter(e => e.to === s.id && e.kind === 'depends_on')) { const dependency = this.get('source', e.from); if (dependency?.replacementId) this.put('edge', { ...e, from: dependency.replacementId }); }
        const result = this.put('source', { ...s, status: p.status, revision: s.revision + 1, reviewReason: null, correctedDependencyId: null, replacementDependencyId: null, reviewNote, reviewedBy: userId, reviewedAt: now() });
        const w = this.work(userId, s.workId); const remaining = (w.reviewedProjectRevision ?? 1) !== this.project(userId, w.projectId).revision || this.all('source').some(x => x.workId === w.id && x.status === 'needs_review' && x.active !== false);
        this.touch({ ...w, needsReview: remaining }); this.staleHandoffs(w.id);
        this.audit(userId, action, { workId: w.id, projectId: w.projectId, sourceId: s.id }); return result;
      }
      case 'set_source_active': {
        const s = this.source(userId, p.sourceId, 'edit'); this.expected(s, p.expectedRevision);
        if (s.status === 'superseded') fail(400, 'INVALID_INPUT', 'Manage the current replacement source instead.');
        if (typeof p.active !== 'boolean') fail(400, 'INVALID_INPUT', 'active must be a boolean.');
        const reason = string(p.reason, 'reason', 2000);
        if ((s.active !== false) === p.active) return s;
        const updated = this.put('source', { ...s, active: p.active, status: p.active ? 'needs_review' : s.status, revision: s.revision + 1, exclusionReason: reason, activityChangedBy: userId, activityChangedAt: now() });
        const affected = p.active ? new Set<string>([s.id]) : this.dependentIds(s.id), affectedWorks = new Set<string>([s.workId]);
        for (const sourceId of affected) { const dependent = this.get('source', sourceId); if (!dependent) continue; affectedWorks.add(dependent.workId); if (sourceId !== s.id && dependent.status !== 'superseded') this.put('source', { ...dependent, status: 'needs_review', revision: dependent.revision + 1, reviewReason: 'A recorded dependency was excluded from active context.' }); }
        for (const workId of affectedWorks) { const work = this.get('work', workId)!; this.touch({ ...work, needsReview: true }); this.staleHandoffs(workId); }
        const w = this.get('work', s.workId)!; this.audit(userId, action, { projectId: w.projectId, workId: w.id, sourceId: s.id, active: p.active });
        return { source: updated, affectedSourceIds: [...affected].filter(sourceId => { const source = this.get('source', sourceId)!; return this.permission(userId, this.get('work', source.workId)!); }) };
      }
      case 'get_context': return this.context(userId, p.workId, p.budgetBytes);
      case 'get_context_snapshot': {
        const c = this.get('context', p.contextId); if (!c) fail(404, 'NOT_FOUND', 'Context snapshot not found.');
        let w: RecordData;
        try { w = this.work(userId, c!.workId); } catch (error) { if (error instanceof DomainError && error.status === 404) fail(404, 'NOT_FOUND', 'Context snapshot not found.'); throw error; }
        const project = this.project(userId, w.projectId);
        return { snapshot: c!.snapshot, stale: w.revision !== c!.workRevision || project.revision !== c!.projectRevision };
      }
      case 'get_graph': {
        const work = this.work(userId, p.workId); const project = this.project(userId, work.projectId);
        const readableWorks = new Set(this.accessibleWorks(userId, work.projectId).map(w => w.id));
        const readableSources = this.all('source').filter(s => readableWorks.has(s.workId));
        const sourcesById = new Map(readableSources.map(s => [s.id as string, s]));
        // Filter before traversal. Hidden nodes cannot influence counts or connect visible nodes.
        const permittedEdges = this.all('edge').filter(e => sourcesById.has(e.from) && sourcesById.has(e.to));
        const adjacency = new Map<string, string[]>();
        for (const e of permittedEdges) {
          adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
          adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from]);
        }
        const ownSources = readableSources.filter(s => s.workId === work.id).reverse().sort((a, b) => (b.status === 'needs_review' ? 1 : 0) - (a.status === 'needs_review' ? 1 : 0) || (a.status === 'superseded' ? 1 : 0) - (b.status === 'superseded' ? 1 : 0));
        const queue = ownSources.map(s => s.id as string), reachable = new Set<string>(), order: string[] = [];
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const sourceId = queue[cursor]; if (reachable.has(sourceId)) continue;
          reachable.add(sourceId); order.push(sourceId);
          for (const neighbor of adjacency.get(sourceId) ?? []) if (!reachable.has(neighbor)) queue.push(neighbor);
        }
        const selectedSourceIds = new Set(order.slice(0, 78));
        const selectedSources = [...selectedSourceIds].map(sourceId => sourcesById.get(sourceId)!);
        const nodes = [{ id: project.id, kind: 'project', title: project.name, revision: project.revision }, { ...work, kind: 'work' }, ...selectedSources];
        const membershipEdges = ownSources.map(s => ({ id: `${work.id}:${s.id}`, from: work.id, to: s.id, kind: 'contains' }));
        const rootEdge = { id: `${project.id}:${work.id}`, from: project.id, to: work.id, kind: 'contains' };
        const knownEdges = [rootEdge, ...membershipEdges, ...permittedEdges.filter(e => reachable.has(e.from) && reachable.has(e.to))];
        const nodeIds = new Set(nodes.map(n => n.id));
        const visibleEdges = knownEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
        const edges = visibleEdges.slice(0, 160);
        const omittedNodeIds = order.filter(sourceId => !selectedSourceIds.has(sourceId));
        return { nodes, edges, truncated: omittedNodeIds.length > 0 || knownEdges.length > edges.length,
          omissions: { nodeCount: omittedNodeIds.length, edgeCount: knownEdges.length - edges.length, knownNodeIds: omittedNodeIds.slice(0, 10), scope: 'Permitted records reachable through permitted edges; hidden records are excluded.' }, limits: { nodes: 80, edges: 160 } };
      }
      case 'share_work': {
        const w = this.work(userId, p.workId, 'owner'); this.member(p.userId, w.projectId);
        if (p.userId === userId || !['read', 'edit'].includes(p.permission)) fail(400, 'INVALID_INPUT', 'Choose another member and read or edit access.');
        const grant = this.put('grant', { id: `${w.id}:${p.userId}`, workId: w.id, userId: p.userId, permission: p.permission, grantedBy: userId, createdAt: now() });
        this.audit(userId, action, { workId: w.id, projectId: w.projectId }); return grant;
      }
      case 'revoke_grant': { const w = this.work(userId, p.workId, 'owner'); this.remove('grant', `${w.id}:${p.userId}`); this.audit(userId, action, { workId: w.id, projectId: w.projectId }); return { revoked: true, note: w.visibility === 'project' ? 'Project-visible work remains readable by project members.' : undefined }; }
      case 'reassign_work': {
        const w = this.work(userId, p.workId, 'owner'); this.member(p.userId, w.projectId);
        if (p.userId === userId) fail(400, 'INVALID_INPUT', 'Choose another owner.');
        const retain = p.retainAccess ?? 'none'; if (!['none', 'read', 'edit'].includes(retain)) fail(400, 'INVALID_INPUT', 'Invalid retained access.');
        this.remove('grant', `${w.id}:${p.userId}`);
        if (retain !== 'none') this.put('grant', { id: `${w.id}:${userId}`, workId: w.id, userId, permission: retain, grantedBy: userId, createdAt: now() }); else this.remove('grant', `${w.id}:${userId}`);
        const result = this.touch({ ...w, ownerId: p.userId }); this.staleHandoffs(w.id); this.audit(userId, action, { workId: w.id, projectId: w.projectId }); return result;
      }
      case 'send_handoff': {
        const key = string(p.idempotencyKey, 'idempotencyKey', 200); const title = string(p.title, 'title', 200); const content = string(p.content, 'content', 200_000, true);
        const sourceIds = p.sourceIds ?? [], attachmentIds = p.attachmentIds ?? [];
        if (p.expectedSourceRevisions !== undefined && (!p.expectedSourceRevisions || typeof p.expectedSourceRevisions !== 'object' || Array.isArray(p.expectedSourceRevisions))) fail(400, 'INVALID_INPUT', 'expectedSourceRevisions must be a revision map.');
        if (!Array.isArray(sourceIds) || !Array.isArray(attachmentIds) || sourceIds.length > 100 || attachmentIds.length > 20 || [...sourceIds, ...attachmentIds].some(x => typeof x !== 'string')) fail(400, 'INVALID_INPUT', 'Invalid selected records.');
        const fingerprint = hash(JSON.stringify({ workId: p.workId, recipientId: p.recipientId, title, content, sourceIds: [...new Set(sourceIds)].sort(), attachmentIds: [...new Set(attachmentIds)].sort() }));
        const previous = this.all('handoff').find(h => h.senderId === userId && h.idempotencyKey === key);
        if (previous) { if (previous.fingerprint !== fingerprint) fail(409, 'IDEMPOTENCY_CONFLICT', 'This retry key already belongs to a different handoff.'); return this.handoff(userId, previous.id); }
        const w = this.work(userId, p.workId, 'owner');
        if (p.expectedRevision !== undefined) this.expected(w, p.expectedRevision);
        this.member(p.recipientId, w.projectId);
        if (p.recipientId === userId) fail(400, 'INVALID_RECIPIENT', 'Choose another project member.');
        const snapshots = [...new Set<string>(sourceIds)].map(sourceId => { const s = this.source(userId, sourceId); if (p.expectedSourceRevisions !== undefined) this.expected(s, p.expectedSourceRevisions[sourceId]); if (s.workId !== w.id) fail(400, 'INVALID_INPUT', 'Selected sources must belong to this work.'); return { id: s.id, revision: s.revision, kind: s.kind, title: s.title, content: s.content, status: s.status }; });
        for (const attachmentId of attachmentIds) { const a = this.attachment(userId, attachmentId); if (a.workId !== w.id) fail(400, 'INVALID_INPUT', 'Selected files must belong to this work.'); }
        const h = this.put('handoff', { id: id('hnd'), senderId: userId, recipientId: p.recipientId, projectId: w.projectId, workId: w.id, workRevision: w.revision, title, content, sourceSnapshots: snapshots, attachmentIds: [...new Set(attachmentIds)], idempotencyKey: key, fingerprint, state: 'queued', stale: false, revoked: false, createdAt: now() });
        this.audit(userId, action, { projectId: w.projectId, handoffId: h.id }); return h;
      }
      case 'list_inbox': return this.page(this.all('handoff').filter(h => h.recipientId === userId && !h.revoked && this.isMember(userId, h.projectId)).reverse().map(h => this.handoffMetadata(h)), p.offset, p.limit);
      case 'get_handoff': {
        const h = this.handoff(userId, p.handoffId);
        if (h.recipientId !== userId || h.state !== 'queued') return h;
        const retrieved = this.put('handoff', { ...h, state: 'retrieved', retrievedAt: h.retrievedAt ?? now() });
        this.audit(userId, action, { projectId: h.projectId, handoffId: h.id }); return retrieved;
      }
      case 'mark_handoff_read': case 'acknowledge_handoff': {
        const h = this.handoff(userId, p.handoffId); if (h.recipientId !== userId) fail(403, 'FORBIDDEN', 'Only the recipient can update delivery status.');
        const state = action === 'acknowledge_handoff' ? 'acknowledged' : h.state === 'acknowledged' ? 'acknowledged' : 'retrieved';
        const result = this.put('handoff', { ...h, state, ...(state === 'acknowledged' ? { acknowledgedAt: h.acknowledgedAt ?? now() } : { retrievedAt: h.retrievedAt ?? now() }) });
        this.audit(userId, action, { projectId: h.projectId, handoffId: h.id }); return result;
      }
      case 'revoke_handoff': { const h = this.handoff(userId, p.handoffId); if (h.senderId !== userId) fail(403, 'FORBIDDEN', 'Only the sender can withdraw a handoff.'); this.put('handoff', { ...h, revoked: true }); this.audit(userId, action, { projectId: h.projectId, handoffId: h.id }); return { revoked: true }; }
      case 'register_device': { const d = this.put('device', { id: id('dev'), userId, name: string(p.name, 'name', 160), platform: string(p.platform, 'platform', 100), client: string(p.client, 'client', 100), lastObservedAt: null, lastSeenAt: null, revoked: false, createdAt: now() }); this.audit(userId, action); return d; }
      case 'revoke_device': {
        const d = this.get('device', p.deviceId); if (!d || d.userId !== userId) fail(404, 'NOT_FOUND', 'Device not found.');
        this.put('device', { ...d!, revoked: true }); for (const c of this.all('credential').filter(c => c.deviceId === d!.id)) this.put('credential', { ...c, revoked: true }); this.audit(userId, action); return { revoked: true };
      }
      case 'create_credential': {
        if (p.deviceId) { const d = this.get('device', p.deviceId); if (!d || d.userId !== userId || d.revoked) fail(404, 'NOT_FOUND', 'Active device not found.'); }
        const token = `wt_${randomBytes(32).toString('base64url')}`;
        const credential = this.put('credential', { id: id('cred'), userId, name: string(p.name, 'name', 160), deviceId: p.deviceId ?? null, tokenHash: hash(token), revoked: false, createdAt: now() }); this.audit(userId, action); return { ...this.publicCredential(credential), token };
      }
      case 'revoke_credential': { const c = this.get('credential', p.credentialId); if (!c || c.userId !== userId) fail(404, 'NOT_FOUND', 'Credential not found.'); this.put('credential', { ...c!, revoked: true }); this.audit(userId, action); return { revoked: true }; }
      case 'add_attachment': {
        const w = this.work(userId, p.workId, 'edit'); const rawName = string(p.name, 'name', 180), mime = string(p.mime, 'mime', 100);
        if (/[\x00-\x1f\x7f]/.test(rawName)) fail(400, 'INVALID_FILE', 'File names cannot contain control characters.');
        const name = rawName.split(/[\\/]/).pop()!; if (!name || name === '.' || name === '..') fail(400, 'INVALID_FILE', 'Provide a file name.');
        if (!mimeTypes.has(mime)) fail(400, 'UNSUPPORTED_FILE_TYPE', 'Supported files are text, Markdown, PDF, PNG, and JPEG.');
        if (typeof p.contentBase64 !== 'string' || p.contentBase64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.contentBase64)) fail(400, 'INVALID_FILE', 'Provide valid base64 containing a file of at most 5 MiB.');
        const bytes = Buffer.from(p.contentBase64, 'base64'); if (bytes.length > 5 * 1024 * 1024) fail(413, 'FILE_TOO_LARGE', 'Files are limited to 5 MiB.');
        const a = this.put('attachment', { id: id('att'), workId: w.id, name, mime, size: bytes.length, contentBase64: bytes.toString('base64'), authorId: userId, createdAt: now() }); this.audit(userId, action, { workId: w.id, projectId: w.projectId }); const { contentBase64: _content, ...metadata } = a; return metadata;
      }
      case 'get_attachment': return this.attachment(userId, p.attachmentId);
    }
  }
  private preparedPrompt(userId: string, promptId: string): RecordData & { stale: boolean } {
    const draft = this.get('prepared_prompt', promptId) ?? fail(404, 'NOT_FOUND', 'Prompt draft not found.');
    if (draft.actorId !== userId) fail(404, 'NOT_FOUND', 'Prompt draft not found.');
    const w = this.work(userId, draft.workId);
    const project = this.project(userId, w.projectId);
    return { ...draft, stale: w.revision !== draft.workRevision || project.revision !== draft.projectRevision };
  }
  private addSource(userId: string, p: RecordData, preparation?: RecordData) {

        const w = this.work(userId, p.workId, 'edit');
        if (p.conversationId !== undefined) { const conversation = this.get('conversation', p.conversationId); if (!conversation || conversation.workId !== w.id || conversation.ownerId !== userId) fail(400, 'INVALID_CONVERSATION', 'Choose one of your conversations associated with this work.'); }
        if (!['prompt', 'assumption', 'decision', 'evidence', 'summary'].includes(p.kind)) fail(400, 'INVALID_INPUT', 'Unknown source kind.');
        const status = p.status ?? 'proposed'; if (!['proposed', 'accepted', 'verified', 'needs_review'].includes(status)) fail(400, 'INVALID_INPUT', 'Unknown source status.');
        const dependencies = p.dependsOn ?? []; if (!Array.isArray(dependencies) || dependencies.length > 100 || dependencies.some(x => typeof x !== 'string')) fail(400, 'INVALID_INPUT', 'dependsOn must be at most 100 source IDs.');
        for (const dependency of dependencies) { const parent = this.source(userId, dependency); const parentWork = this.work(userId, parent.workId); if (parentWork.projectId !== w.projectId) fail(400, 'INVALID_INPUT', 'Dependencies must belong to the same project.'); }
        const s = this.put('source', { id: id('src'), workId: w.id, conversationId: p.conversationId ?? null, kind: p.kind, title: string(p.title, 'title', 200), content: string(p.content, 'content'), status, active: true, revision: 1, supersedesId: null, authorId: userId, createdAt: now(), ...(preparation ? { preparation } : {}) });
        for (const parentId of [...new Set<string>(dependencies)]) this.put('edge', { id: id('edge'), from: parentId, to: s.id, kind: 'depends_on' });
        this.touch({ ...w, needsReview: w.needsReview || status === 'needs_review' }); this.staleHandoffs(w.id);
        this.audit(userId, 'add_source', { workId: w.id, projectId: w.projectId, sourceId: s.id }); return s;
  }
  private attachment(userId: string, attachmentId: string) {
    const a = this.get('attachment', attachmentId); const w = a && this.get('work', a.workId);
    const throughWork = w && this.permission(userId, w);
    const throughHandoff = a && this.all('handoff').some(h => !h.revoked && h.recipientId === userId && this.isMember(userId, h.projectId) && h.attachmentIds.includes(a.id));
    if (!a || (!throughWork && !throughHandoff)) fail(404, 'NOT_FOUND', 'File not found.'); return a!;
  }
  private staleHandoffs(workId: string) { for (const h of this.all('handoff').filter(h => h.workId === workId && !h.revoked)) this.put('handoff', { ...h, stale: true, staleReason: 'The underlying work or recorded sources changed after this snapshot.' }); }
  private context(userId: string, workId: string, budgetInput?: number) {
    const work = this.work(userId, workId); const project = this.project(userId, work.projectId);
    const budget = budgetInput ?? 32_768; if (!Number.isInteger(budget) || budget < 1 || budget > 1_048_576) fail(400, 'INVALID_BUDGET', 'budgetBytes must be an integer from 1 to 1,048,576.');
    const current = this.all('source').filter(s => s.workId === work.id && s.status !== 'superseded' && s.active !== false);
    const corrections = current.filter(s => s.supersedesId && work.needsReview);
    const correctionIds = new Set(corrections.map(s => s.id));
    const candidates = current.filter(s => !correctionIds.has(s.id)).sort((a, b) => (b.status === 'accepted' || b.status === 'verified' ? 1 : 0) - (a.status === 'accepted' || a.status === 'verified' ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
    const result: RecordData = { id: id('ctx'), workId: work.id, workRevision: work.revision, projectRevision: project.revision, objective: work.objective, requirements: project.requirements, projectObjective: project.objective, nextAction: work.nextAction,
      warnings: work.needsReview ? ['This work has changes or recorded dependencies requiring review.'] : [], corrections: corrections.map(s => ({ id: s.id, revision: s.revision, supersedesId: s.supersedesId, content: s.content, status: s.status })),
      sources: [], omitted: { count: candidates.length, ids: candidates.slice(0, 10).map(s => s.id), reason: 'Configured byte budget.' }, budgetBytes: budget, bytesUsed: 0, sizeMeasure: 'UTF-8 bytes of the complete JSON result', createdAt: now() };
    const measure = () => { for (let i = 0; i < 6; i++) { const size = Buffer.byteLength(JSON.stringify(result), 'utf8'); if (result.bytesUsed === size) return size; result.bytesUsed = size; } return Buffer.byteLength(JSON.stringify(result), 'utf8'); };
    if (measure() > budget) fail(422, 'BUDGET_TOO_SMALL', 'Mandatory current constraints and review information cannot fit. Increase the byte budget.', { requestedBudgetBytes: budget, minimumBudgetBytes: measure() });
    const selected = new Set<string>();
    for (const s of candidates) {
      const entry = { ...s, selectionReason: ['accepted', 'verified'].includes(s.status) ? 'Current accepted decision or verification evidence.' : s.status === 'needs_review' ? 'Included for review only; the conclusion is not accepted until reviewed.' : 'Unaccepted proposal supplied as context for review.' };
      result.sources.push(entry); selected.add(s.id); const omitted = candidates.filter(x => !selected.has(x.id)); result.omitted.count = omitted.length; result.omitted.ids = omitted.slice(0, 10).map(x => x.id);
      if (measure() > budget) { result.sources.pop(); selected.delete(s.id); const remainder = candidates.filter(x => !selected.has(x.id)); result.omitted.count = remainder.length; result.omitted.ids = remainder.slice(0, 10).map(x => x.id); measure(); }
    }
    measure(); this.put('context', { id: result.id, actorId: userId, workId: work.id, workRevision: work.revision, projectRevision: project.revision, snapshot: result, createdAt: now() }); return result;
  }
  private seed() {
    this.transaction(() => {
      const users = ['Akash', 'Maya', 'Ravi'].map(name => {
        const salt = randomBytes(16).toString('hex'); return this.put('user', { id: id('usr'), name, email: `${name.toLowerCase()}@worktether.local`, salt, passwordHash: scryptSync('worktether-local-2026', salt, 64).toString('hex'), sample: true });
      });
      const project = this.put('project', { id: id('prj'), name: 'WorkTether • sample project', objective: 'Keep project context accurate across people, clients, and machines.', requirements: 'Work is private by default. Share selected snapshots explicitly. Preserve revisions and verification evidence.', revision: 1, ownerId: users[0].id, sample: true, createdAt: now() });
      for (const u of users) this.put('membership', { id: `${project.id}:${u.id}`, userId: u.id, projectId: project.id });
      for (const [index, u] of users.entries()) {
        const work = this.put('work', { id: id('wrk'), projectId: project.id, ownerId: u.id, title: ['Design a reliable context handoff', 'Private planning notes', 'Verify startup connection'][index], objective: ['Continue the correct requirements without exposing private drafts.', 'Review personal design alternatives before sharing.', 'Document supported MCP capabilities with actual evidence.'][index], nextAction: ['Inspect dependencies and create a selected handoff.', 'Review the alternatives.', 'Connect a local protocol client.'][index], status: 'active', visibility: 'private', revision: 1, reviewedProjectRevision: project.revision, needsReview: false, updatedAt: now(), sample: true });
        if (index === 0) {
          const a = this.put('source', { id: id('src'), workId: work.id, kind: 'assumption', title: 'Each person may use several machines', content: 'Ownership follows a person, while device registrations describe connection locations.', status: 'accepted', revision: 1, supersedesId: null, authorId: u.id, createdAt: now(), sample: true });
          const b = this.put('source', { id: id('src'), workId: work.id, kind: 'decision', title: 'Keep a stable Work ID', content: 'A new conversation continues the existing work identity and retrieves its current revision.', status: 'accepted', revision: 1, supersedesId: null, authorId: u.id, createdAt: now(), sample: true });
          this.put('edge', { id: id('edge'), from: a.id, to: b.id, kind: 'depends_on' });
          this.put('source', { id: id('src'), workId: work.id, kind: 'evidence', title: 'Sample verification placeholder', content: 'Illustrative evidence only. Replace with a real acceptance result.', status: 'proposed', revision: 1, supersedesId: null, authorId: u.id, createdAt: now(), sample: true });
        }
      }
      this.audit(users[0].id, 'sample_project_created', { projectId: project.id, sample: true });
    });
  }
}
