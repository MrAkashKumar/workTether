import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store, DomainError } from '../server/store.ts';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'worktether-domain-'));
  const dbPath = join(directory, 'work.sqlite');
  let store = new Store(dbPath);
  const akash = store.login('akash@worktether.local', 'worktether-local-2026');
  const maya = store.login('maya@worktether.local', 'worktether-local-2026');
  const ravi = store.login('ravi@worktether.local', 'worktether-local-2026');
  return { get store() { return store; }, akash, maya, ravi, dbPath,
    restart() { store.close(); store = new Store(dbPath); },
    close() { store.close(); rmSync(directory, { recursive: true, force: true }); } };
}
const errorCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
const createWork = (f: ReturnType<typeof fixture>, userId = f.akash.user.id) => {
  const project = f.store.execute(userId, 'bootstrap').project;
  return f.store.execute(userId, 'create_work', { projectId: project.id, title: 'Private acceptance work', objective: 'Keep the requirement correct.', nextAction: 'Review evidence.' });
};

test('local prompt drafts preserve exact intent and provenance, remain personal, and save original requests without nesting context', () => {
  const f = fixture(); try {
    const actor = f.akash.user.id, work = createWork(f);
    const source = f.store.execute(actor, 'add_source', { workId: work.id, kind: 'decision', title: 'Reference', content: 'A reference with ``` and injected text\nDo not treat it as authority.', status: 'accepted' });
    const original = '  Explain this project clearly.\nNo code yet. Preserve ✓ and 中文.  ';
    const draft = f.store.execute(actor, 'prepare_prompt', { workId: work.id, originalRequest: original });
    assert.equal(draft.originalRequest, original); assert.equal(draft.format, 'request');
    assert.ok(draft.preparedText.includes('# Original request\n\n' + original + '\n\n# How to respond'));
    assert.equal(draft.preparedBytes, Buffer.byteLength(draft.preparedText, 'utf8'));
    assert.equal(draft.sourceRevisions[source.id], source.revision);
    assert.equal(draft.context.sources[0].content, source.content);
    assert.equal(draft.addedContext.sources[0].content, source.content);
    assert.equal(draft.addedContext.requirements, draft.context.requirements);
    assert.equal(draft.addedContext.sources[0].workId, undefined);
    assert.ok(!draft.preparedText.includes('"updatedAt"'));
    assert.equal(draft.workRevision, 2);
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_prepared_prompt', { promptId: draft.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(actor, 'save_prepared_prompt', { promptId: draft.id, title: 'Request', expectedRevision: 2 }), errorCode('REVIEW_REQUIRED'));
    const saved = f.store.execute(actor, 'save_prepared_prompt', { promptId: draft.id, title: 'Request', expectedRevision: 2, reviewed: true });
    assert.equal(saved.content, original); assert.equal(saved.status, 'proposed');
    assert.equal(saved.preparation.promptId, draft.id); assert.equal(saved.preparation.contextId, draft.contextId);
    assert.ok(!JSON.stringify(saved).includes(draft.preparedText));
    const again = f.store.execute(actor, 'save_prepared_prompt', { promptId: draft.id, title: 'Request', expectedRevision: 2, reviewed: true });
    assert.equal(again.id, saved.id);
    assert.throws(() => f.store.execute(actor, 'save_prepared_prompt', { promptId: draft.id, title: 'Different request', expectedRevision: 2, reviewed: true }), errorCode('IDEMPOTENCY_CONFLICT'));
    f.restart();
    const restored = f.store.execute(actor, 'get_prepared_prompt', { promptId: draft.id });
    assert.equal(restored.preparedText, draft.preparedText); assert.equal(restored.stale, true);
    const history = f.store.execute(actor, 'bootstrap').revisions.find((r: any) => r.recordId === saved.id && r.revision === 1);
    assert.equal(history.snapshot.preparation.contextId, draft.contextId);
  } finally { f.close(); }
});

test('prompt preparation denies private access, detects changed baselines, and rechecks edit and conversation authority', () => {
  const f = fixture(); try {
    const actor = f.akash.user.id, other = f.maya.user.id, work = createWork(f);
    assert.throws(() => f.store.execute(other, 'prepare_prompt', { workId: work.id, originalRequest: 'Do something' }), errorCode('NOT_FOUND'));
    f.store.execute(actor, 'share_work', { workId: work.id, userId: other, permission: 'read' });
    const personal = f.store.execute(other, 'prepare_prompt', { workId: work.id, originalRequest: 'A personal draft' });
    assert.throws(() => f.store.execute(actor, 'get_prepared_prompt', { promptId: personal.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(other, 'save_prepared_prompt', { promptId: personal.id, title: 'Request', expectedRevision: work.revision, reviewed: true }), errorCode('FORBIDDEN'));
    const conversation = f.store.execute(actor, 'create_conversation', { workId: work.id, title: 'Owner chat' });
    assert.throws(() => f.store.execute(other, 'prepare_prompt', { workId: work.id, originalRequest: 'Wrong attribution', conversationId: conversation.id }), errorCode('INVALID_CONVERSATION'));
    const draft = f.store.execute(actor, 'prepare_prompt', { workId: work.id, originalRequest: 'Keep the requirement', conversationId: conversation.id });
    const updated = f.store.execute(actor, 'update_work', { workId: work.id, expectedRevision: 1, nextAction: 'Changed plan' });
    assert.equal(f.store.execute(actor, 'get_prepared_prompt', { promptId: draft.id }).stale, true);
    assert.throws(() => f.store.execute(actor, 'save_prepared_prompt', { promptId: draft.id, title: 'Request', expectedRevision: updated.revision, reviewed: true }), errorCode('STALE_CONTEXT'));
    f.store.execute(actor, 'revoke_grant', { workId: work.id, userId: other });
    assert.throws(() => f.store.execute(other, 'get_prepared_prompt', { promptId: personal.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(other, 'list_prepared_prompts', { workId: work.id }), errorCode('NOT_FOUND'));
  } finally { f.close(); }
});

test('prompt preparation preserves review warnings and exclusions, rejects invalid input, and rolls back insufficient budgets', () => {
  const f = fixture(); try {
    const actor = f.akash.user.id, work = createWork(f);
    const source = f.store.execute(actor, 'add_source', { workId: work.id, kind: 'assumption', title: 'Old assumption', content: 'Do not reuse this', status: 'accepted' });
    f.store.execute(actor, 'set_source_active', { sourceId: source.id, expectedRevision: 1, active: false, reason: 'Irrelevant' });
    const draft = f.store.execute(actor, 'prepare_prompt', { workId: work.id, originalRequest: 'Review my work', format: 'review' });
    assert.ok(draft.context.warnings.length > 0); assert.ok(!draft.context.sources.some((s: any) => s.id === source.id));
    assert.ok(draft.preparedText.includes(draft.context.warnings[0]));
    for (const extra of [{ originalRequest: ' ' }, { originalRequest: 'x'.repeat(20001) }, { format: '__proto__' }]) assert.throws(() => f.store.execute(actor, 'prepare_prompt', { workId: work.id, originalRequest: 'Request', ...extra }), errorCode('INVALID_INPUT'));
    const before = f.store.execute(actor, 'list_prepared_prompts', { workId: work.id }).total;
    assert.throws(() => f.store.execute(actor, 'prepare_prompt', { workId: work.id, originalRequest: 'Request', budgetBytes: 1 }), errorCode('BUDGET_TOO_SMALL'));
    assert.equal(f.store.execute(actor, 'list_prepared_prompts', { workId: work.id }).total, before);
    const project = f.store.execute(actor, 'bootstrap').project;
    f.store.execute(actor, 'update_project', { projectId: project.id, expectedRevision: project.revision, requirements: 'New mandatory requirement' });
    assert.equal(f.store.execute(actor, 'get_prepared_prompt', { promptId: draft.id }).stale, true);
  } finally { f.close(); }
});

test('real sessions, local registration, credential/device revocation and metadata secrecy', () => {
  const f = fixture(); try {
    assert.equal(f.store.authenticate(f.akash.token)?.id, f.akash.user.id);
    assert.throws(() => f.store.login('akash@worktether.local', 'incorrect'), errorCode('INVALID_CREDENTIALS'));
    const newcomer = f.store.register({ name: 'New person', email: 'new@worktether.local', password: 'a-private-local-password' });
    assert.deepEqual(f.store.execute(newcomer.user.id, 'bootstrap').projects, []);
    const device = f.store.execute(f.akash.user.id, 'register_device', { name: 'Second machine', platform: 'Windows', client: 'Protocol client' });
    const credential = f.store.execute(f.akash.user.id, 'create_credential', { name: 'Test connection', deviceId: device.id });
    assert.equal(f.store.authenticate(credential.token)?.id, f.akash.user.id);
    const bootstrap = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.ok(bootstrap.devices.find((d: any) => d.id === device.id).lastSeenAt);
    assert.ok(!JSON.stringify(bootstrap).includes(credential.token));
    assert.ok(!JSON.stringify(bootstrap).includes('passwordHash'));
    assert.ok(!JSON.stringify(bootstrap).includes('tokenHash'));
    assert.deepEqual(f.store.execute(f.maya.user.id, 'bootstrap').credentials, []);
    f.store.execute(f.akash.user.id, 'revoke_device', { deviceId: device.id });
    assert.equal(f.store.authenticate(credential.token), null);
    f.store.logout(f.akash.token); assert.equal(f.store.authenticate(f.akash.token), null);
  } finally { f.close(); }
});

test('private work and file data are protected across lookup, context, graph, bootstrap and edits', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const source = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'prompt', title: 'Private prompt', content: 'Private detail: ALPHA-SECRET', status: 'proposed' });
    const attachment = f.store.execute(f.akash.user.id, 'add_attachment', { workId: work.id, name: 'private.md', mime: 'text/markdown', contentBase64: Buffer.from('ALPHA-SECRET').toString('base64') });
    for (const [action, input] of [['get_context', { workId: work.id }], ['get_graph', { workId: work.id }], ['update_work', { workId: work.id, expectedRevision: 2, title: 'Bad update' }], ['correct_source', { sourceId: source.id, content: 'Bad correction', reason: 'Bad' }], ['get_attachment', { attachmentId: attachment.id }]] as const) assert.throws(() => f.store.execute(f.maya.user.id, action, input), errorCode('NOT_FOUND'));
    const visible = JSON.stringify(f.store.execute(f.maya.user.id, 'bootstrap'));
    assert.ok(!visible.includes(work.id)); assert.ok(!visible.includes(source.id)); assert.ok(!visible.includes('ALPHA-SECRET'));
    f.store.execute(f.akash.user.id, 'share_work', { workId: work.id, userId: f.maya.user.id, permission: 'edit' });
    const current = f.store.execute(f.maya.user.id, 'bootstrap').works.find((w: any) => w.id === work.id);
    f.store.execute(f.maya.user.id, 'update_work', { workId: work.id, expectedRevision: current.revision, nextAction: 'Collaborator edit' });
    assert.throws(() => f.store.execute(f.maya.user.id, 'share_work', { workId: work.id, userId: f.ravi.user.id, permission: 'read' }), errorCode('FORBIDDEN'));
    assert.throws(() => f.store.execute(f.maya.user.id, 'reassign_work', { workId: work.id, userId: f.ravi.user.id }), errorCode('FORBIDDEN'));
    f.store.execute(f.akash.user.id, 'revoke_grant', { workId: work.id, userId: f.maya.user.id });
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_attachment', { attachmentId: attachment.id }), errorCode('NOT_FOUND'));
  } finally { f.close(); }
});

test('work and requirements retain immutable revisions and reject stale writes', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const updated = f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: 1, title: 'First update' });
    assert.equal(updated.revision, 2);
    assert.throws(() => f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: 1, title: 'Stale overwrite' }), errorCode('REVISION_CONFLICT'));
    const baseline = f.store.execute(f.akash.user.id, 'bootstrap').project;
    f.store.execute(f.akash.user.id, 'update_project', { projectId: baseline.id, expectedRevision: baseline.revision, requirements: 'New baseline' });
    assert.throws(() => f.store.execute(f.akash.user.id, 'update_project', { projectId: baseline.id, expectedRevision: baseline.revision, requirements: 'Stale baseline' }), errorCode('REVISION_CONFLICT'));
    const state = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(state.works.find((w: any) => w.id === work.id).title, 'First update');
    assert.equal(state.revisions.find((r: any) => r.recordId === work.id && r.revision === 1).snapshot.title, work.title);
    assert.equal(state.revisions.find((r: any) => r.recordId === baseline.id && r.revision === 1).snapshot.requirements, baseline.requirements);
    const flagged = state.works.find((w: any) => w.id === work.id);
    assert.equal(flagged.needsReview, true);
    assert.throws(() => f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: flagged.revision, reviewedProjectRevision: baseline.revision }), errorCode('REVISION_CONFLICT'));
    const reviewed = f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: flagged.revision, reviewedProjectRevision: state.project.revision });
    assert.equal(reviewed.needsReview, false);
  } finally { f.close(); }
});

test('corrections propagate transitively into private dependents without revealing them', () => {
  const f = fixture(); try {
    const aWork = createWork(f), bWork = createWork(f, f.maya.user.id);
    const a = f.store.execute(f.akash.user.id, 'add_source', { workId: aWork.id, kind: 'assumption', title: 'First assumption', content: 'Incorrect premise', status: 'accepted' });
    f.store.execute(f.akash.user.id, 'share_work', { workId: aWork.id, userId: f.maya.user.id, permission: 'read' });
    const b = f.store.execute(f.maya.user.id, 'add_source', { workId: bWork.id, kind: 'decision', title: 'Dependent decision', content: 'Needs the premise', status: 'accepted', dependsOn: [a.id] });
    const c = f.store.execute(f.maya.user.id, 'add_source', { workId: bWork.id, kind: 'evidence', title: 'Downstream evidence', content: 'Must be reviewed', status: 'verified', dependsOn: [b.id] });
    f.store.execute(f.akash.user.id, 'revoke_grant', { workId: aWork.id, userId: f.maya.user.id });
    const corrected = f.store.execute(f.akash.user.id, 'correct_source', { sourceId: a.id, expectedRevision: a.revision, content: 'Corrected premise', reason: 'New evidence' });
    assert.ok(!corrected.affectedSourceIds.includes(b.id)); assert.ok(!corrected.affectedSourceIds.includes(c.id));
    const ownerState = JSON.stringify(f.store.execute(f.akash.user.id, 'bootstrap'));
    assert.ok(!ownerState.includes(b.id)); assert.ok(!ownerState.includes(c.id));
    const mayaState = f.store.execute(f.maya.user.id, 'bootstrap');
    assert.equal(mayaState.sources.find((s: any) => s.id === b.id).status, 'needs_review');
    assert.equal(mayaState.sources.find((s: any) => s.id === c.id).status, 'needs_review');
    assert.ok(!JSON.stringify(mayaState).includes(a.id));
    const context = f.store.execute(f.akash.user.id, 'get_context', { workId: aWork.id });
    assert.equal(context.corrections[0].content, 'Corrected premise');
    assert.ok(!context.sources.some((s: any) => s.id === a.id));
  } finally { f.close(); }
});

test('handoffs are immutable selected snapshots, durable, deduplicated, stale-aware and revocable', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const source = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'decision', title: 'Selected decision', content: 'Share this selected detail', status: 'accepted' });
    const attachment = f.store.execute(f.akash.user.id, 'add_attachment', { workId: work.id, name: 'selected.md', mime: 'text/markdown', contentBase64: Buffer.from('Selected attachment').toString('base64') });
    const input = { workId: work.id, recipientId: f.maya.user.id, title: 'Selected handoff', content: 'Please review', sourceIds: [source.id], attachmentIds: [attachment.id], idempotencyKey: 'retry-one' };
    const h = f.store.execute(f.akash.user.id, 'send_handoff', input);
    assert.equal(f.store.execute(f.akash.user.id, 'send_handoff', input).id, h.id);
    assert.throws(() => f.store.execute(f.akash.user.id, 'send_handoff', { ...input, content: 'Changed request' }), errorCode('IDEMPOTENCY_CONFLICT'));
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_context', { workId: work.id }), errorCode('NOT_FOUND'));
    assert.equal(f.store.execute(f.maya.user.id, 'get_attachment', { attachmentId: attachment.id }).contentBase64, Buffer.from('Selected attachment').toString('base64'));
    f.store.execute(f.akash.user.id, 'correct_source', { sourceId: source.id, expectedRevision: source.revision, content: 'New decision', reason: 'Evidence changed' });
    f.restart();
    const inbox = f.store.execute(f.maya.user.id, 'list_inbox').items; assert.equal(inbox.length, 1);
    assert.equal(inbox[0].sourceSnapshots, undefined); assert.equal(inbox[0].content, undefined); assert.equal(inbox[0].state, 'queued'); assert.equal(inbox[0].stale, true);
    assert.equal(f.store.execute(f.akash.user.id, 'get_handoff', { handoffId: h.id }).state, 'queued');
    const retrieved = f.store.execute(f.maya.user.id, 'get_handoff', { handoffId: h.id });
    assert.equal(retrieved.state, 'retrieved'); assert.equal(retrieved.sourceSnapshots[0].content, 'Share this selected detail');
    assert.equal(f.store.execute(f.maya.user.id, 'mark_handoff_read', { handoffId: h.id }).state, 'retrieved');
    assert.equal(f.store.execute(f.maya.user.id, 'acknowledge_handoff', { handoffId: h.id }).state, 'acknowledged');
    assert.equal(f.store.execute(f.maya.user.id, 'mark_handoff_read', { handoffId: h.id }).state, 'acknowledged');
    f.store.execute(f.akash.user.id, 'revoke_handoff', { handoffId: h.id });
    assert.deepEqual(f.store.execute(f.maya.user.id, 'list_inbox').items, []);
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_handoff', { handoffId: h.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_attachment', { attachmentId: attachment.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(f.maya.user.id, 'mark_handoff_read', { handoffId: h.id }), errorCode('NOT_FOUND'));
  } finally { f.close(); }
});

test('context budgets measure complete UTF8 output and never truncate mandatory constraints', () => {
  const f = fixture(); try {
    const work = createWork(f);
    f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'prompt', title: 'Large source', content: '🌱'.repeat(5000), status: 'proposed' });
    const context = f.store.execute(f.akash.user.id, 'get_context', { workId: work.id, budgetBytes: 2000 });
    assert.ok(Buffer.byteLength(JSON.stringify(context), 'utf8') <= 2000);
    assert.equal(context.bytesUsed, Buffer.byteLength(JSON.stringify(context), 'utf8'));
    assert.equal(context.omitted.count, 1); assert.equal(context.sources.length, 0);
    assert.equal(context.objective, work.objective);
    assert.throws(() => f.store.execute(f.akash.user.id, 'get_context', { workId: work.id, budgetBytes: 1 }), errorCode('BUDGET_TOO_SMALL'));
    assert.throws(() => f.store.execute(f.akash.user.id, 'get_context', { workId: work.id, budgetBytes: -1 }), errorCode('INVALID_BUDGET'));
  } finally { f.close(); }
});

test('ownership transfer keeps stable ID and makes retention explicit', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const reassigned = f.store.execute(f.akash.user.id, 'reassign_work', { workId: work.id, userId: f.maya.user.id, retainAccess: 'none' });
    assert.equal(reassigned.id, work.id); assert.equal(reassigned.ownerId, f.maya.user.id);
    assert.throws(() => f.store.execute(f.akash.user.id, 'get_context', { workId: work.id }), errorCode('NOT_FOUND'));
    const credential = f.store.execute(f.maya.user.id, 'create_credential', { name: 'Independent connection' });
    f.restart(); assert.equal(f.store.authenticate(credential.token)?.id, f.maya.user.id);
    assert.equal(f.store.execute(f.maya.user.id, 'get_context', { workId: work.id }).workId, work.id);
    f.store.execute(f.maya.user.id, 'revoke_credential', { credentialId: credential.id });
    assert.equal(f.store.authenticate(credential.token), null);
  } finally { f.close(); }
});

test('work pagination filters permissions before query/count and evidence totals span all pages', () => {
  const f = fixture(); try {
    const project = f.store.execute(f.akash.user.id, 'create_project', { name: 'Pagination project', objective: 'Check readable pages.' });
    f.store.execute(f.akash.user.id, 'add_member', { projectId: project.id, email: f.maya.user.email });
    const created = [];
    for (let n = 0; n < 45; n++) {
      const w = f.store.execute(f.akash.user.id, 'create_work', { projectId: project.id, title: `Visible item ${String(n).padStart(3, '0')}`, objective: 'Visible objective' });
      created.push(w);
      f.store.execute(f.akash.user.id, 'add_source', { workId: w.id, kind: 'evidence', title: 'Verified check', content: 'Recorded verification result', status: 'verified' });
    }
    const hidden = f.store.execute(f.maya.user.id, 'create_work', { projectId: project.id, title: 'CONFIDENTIAL', objective: 'A private objective' });
    f.store.execute(f.maya.user.id, 'add_source', { workId: hidden.id, kind: 'evidence', title: 'CONFIDENTIAL EVIDENCE', content: 'Private evidence', status: 'verified' });
    const state = f.store.execute(f.akash.user.id, 'bootstrap', { projectId: project.id });
    assert.equal(state.works.length, 40); assert.equal(state.workPage.total, 45); assert.equal(state.workPage.nextOffset, 40);
    assert.deepEqual(state.evidenceCounts, { verified: 45, needs_review: 0, unverified: 0, total: 45 });
    assert.ok(!JSON.stringify(state).includes(hidden.id)); assert.ok(!JSON.stringify(state).includes('CONFIDENTIAL'));
    const second = f.store.execute(f.akash.user.id, 'list_works', { projectId: project.id, offset: 40 });
    assert.equal(second.items.length, 5); assert.equal(second.nextOffset, null);
    assert.equal(new Set([...state.works, ...second.items].map((w: any) => w.id)).size, 45);
    const query = f.store.execute(f.akash.user.id, 'list_works', { projectId: project.id, query: 'Visible item 044' });
    assert.equal(query.total, 1); assert.equal(query.items[0].id, created[44].id);
    assert.equal(f.store.execute(f.akash.user.id, 'list_works', { projectId: project.id, query: 'CONFIDENTIAL' }).total, 0);
    assert.throws(() => f.store.execute(f.ravi.user.id, 'list_works', { projectId: project.id }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(f.akash.user.id, 'list_works', { projectId: project.id, limit: 101 }), errorCode('INVALID_PAGINATION'));
  } finally { f.close(); }
});

test('sources and revision histories are explicitly bounded and source pages remain private', () => {
  const f = fixture(); try {
    const work = createWork(f);
    for (let n = 0; n < 205; n++) f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'prompt', title: `Source ${n}`, content: `Content ${n}`, status: 'proposed' });
    const page = f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id });
    assert.equal(page.total, 205); assert.equal(page.items.length, 200); assert.equal(page.nextOffset, 200);
    const finalPage = f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id, offset: 200 });
    assert.equal(finalPage.items.length, 5);
    assert.equal(new Set([...page.items, ...finalPage.items].map((s: any) => s.id)).size, 205);
    const state = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(state.sources.length, 200); assert.ok(state.sourcePage.total > state.sources.length); assert.equal(state.sourcePage.nextOffset, 200);
    assert.ok(state.revisions.length <= 200); assert.ok(state.revisionPage.total > state.revisions.length);
    assert.throws(() => f.store.execute(f.maya.user.id, 'list_sources', { workId: work.id }), errorCode('NOT_FOUND'));
    const old = finalPage.items[0];
    f.store.execute(f.akash.user.id, 'correct_source', { sourceId: old.id, expectedRevision: old.revision, content: 'Correction', reason: 'Changed evidence' });
    assert.equal(f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id }).total, 205);
    assert.equal(f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id, includeHistory: true }).total, 206);
  } finally { f.close(); }
});

test('graph traverses permitted cross-work dependencies, handles cycles and caps disclosed results', () => {
  const f = fixture(); try {
    const rootWork = createWork(f), otherWork = createWork(f), hiddenWork = createWork(f, f.maya.user.id);
    let predecessor = f.store.execute(f.akash.user.id, 'add_source', { workId: rootWork.id, kind: 'decision', title: 'Root decision', content: 'Root', status: 'accepted' });
    const rootSource = predecessor;
    for (let n = 0; n < 90; n++) predecessor = f.store.execute(f.akash.user.id, 'add_source', { workId: otherWork.id, kind: 'decision', title: `Connected ${n}`, content: 'Dependent source', status: 'accepted', dependsOn: [predecessor.id] });
    f.store.execute(f.akash.user.id, 'add_source', { workId: otherWork.id, kind: 'decision', title: 'Diamond connection', content: 'Two paths to the root', status: 'accepted', dependsOn: [predecessor.id, rootSource.id] });
    f.store.execute(f.akash.user.id, 'share_work', { workId: rootWork.id, userId: f.maya.user.id, permission: 'read' });
    const hidden = f.store.execute(f.maya.user.id, 'add_source', { workId: hiddenWork.id, kind: 'decision', title: 'Hidden dependent', content: 'Private content', status: 'accepted', dependsOn: [rootSource.id] });
    const graph = f.store.execute(f.akash.user.id, 'get_graph', { workId: rootWork.id });
    assert.equal(graph.nodes.length, 80); assert.ok(graph.edges.length <= 160); assert.equal(graph.truncated, true);
    assert.equal(graph.omissions.nodeCount, 14);
    assert.ok(graph.nodes.some((n: any) => n.workId === otherWork.id));
    assert.ok(!JSON.stringify(graph).includes(hidden.id)); assert.ok(!JSON.stringify(graph).includes('Hidden dependent'));
    const nodeIds = new Set(graph.nodes.map((n: any) => n.id)); assert.ok(graph.edges.every((e: any) => nodeIds.has(e.from) && nodeIds.has(e.to)));
    // The diamond has a cycle in the bidirectional neighborhood; replacement adds historical links.
    const replacement = f.store.execute(f.akash.user.id, 'correct_source', { sourceId: rootSource.id, expectedRevision: rootSource.revision, content: 'Corrected root', reason: 'Review all dependents' }).source;
    const cycleGraph = f.store.execute(f.akash.user.id, 'get_graph', { workId: rootWork.id });
    assert.ok(cycleGraph.nodes.some((n: any) => n.id === replacement.id)); assert.ok(cycleGraph.nodes.length <= 80);
  } finally { f.close(); }
});

test('source review cannot clear an unacknowledged baseline and prior source revisions stay immutable', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const source = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'evidence', title: 'Accepted evidence', content: 'Evidence for old requirements', status: 'verified' });
    const project = f.store.execute(f.akash.user.id, 'bootstrap').project;
    f.store.execute(f.akash.user.id, 'update_project', { projectId: project.id, expectedRevision: project.revision, requirements: 'A newer baseline' });
    const state = f.store.execute(f.akash.user.id, 'bootstrap');
    const flagged = state.sources.find((s: any) => s.id === source.id);
    assert.equal(flagged.status, 'needs_review'); assert.equal(flagged.revision, 2);
    assert.equal(state.revisions.find((r: any) => r.recordId === source.id && r.revision === 1).snapshot.status, 'verified');
    f.store.execute(f.akash.user.id, 'resolve_review', { sourceId: source.id, expectedRevision: 2, status: 'verified', note: 'Reviewed against the new requirements; evidence still applies.' });
    const unresolved = f.store.execute(f.akash.user.id, 'bootstrap').works.find((w: any) => w.id === work.id);
    assert.equal(unresolved.needsReview, true);
    const resolved = f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: unresolved.revision, reviewedProjectRevision: state.project.revision });
    assert.equal(resolved.needsReview, false);
    const latest = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(latest.revisions.find((r: any) => r.recordId === source.id && r.revision === 1).snapshot.status, 'verified');
    assert.equal(latest.revisions.find((r: any) => r.recordId === source.id && r.revision === 2).snapshot.status, 'needs_review');
  } finally { f.close(); }
});

test('inbox and sent snapshots are paginated, direct handoff reads remain authorized', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const deliveries: any[] = [];
    for (let n = 0; n < 105; n++) deliveries.push(f.store.execute(f.akash.user.id, 'send_handoff', { workId: work.id, recipientId: f.maya.user.id, title: `Handoff ${n}`, content: 'Selected text', idempotencyKey: `page-${n}` }));
    const first = f.store.execute(f.maya.user.id, 'list_inbox');
    assert.equal(first.total, 105); assert.equal(first.items.length, 40); assert.equal(first.nextOffset, 40);
    assert.ok(first.items.every((h: any) => h.content === undefined && h.sourceSnapshots === undefined && h.idempotencyKey === undefined && h.fingerprint === undefined));
    const last = f.store.execute(f.maya.user.id, 'list_inbox', { offset: 100, limit: 100 });
    assert.equal(last.items.length, 5); assert.equal(last.nextOffset, null);
    assert.equal(f.store.execute(f.maya.user.id, 'get_handoff', { handoffId: deliveries[0].id }).content, 'Selected text');
    assert.throws(() => f.store.execute(f.ravi.user.id, 'get_handoff', { handoffId: deliveries[0].id }), errorCode('NOT_FOUND'));
    assert.equal(f.store.execute(f.ravi.user.id, 'list_inbox').total, 0);
    const sender = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(sender.handoffs.length, 100); assert.equal(sender.handoffPage.total, 105); assert.equal(sender.handoffPage.nextOffset, 100);
    const senderLast = f.store.execute(f.akash.user.id, 'bootstrap', { handoffOffset: 100 });
    assert.equal(senderLast.handoffs.length, 5);
    f.store.execute(f.akash.user.id, 'revoke_handoff', { handoffId: deliveries[0].id });
    assert.equal(f.store.execute(f.maya.user.id, 'list_inbox').total, 104);
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_handoff', { handoffId: deliveries[0].id }), errorCode('NOT_FOUND'));
  } finally { f.close(); }
});

test('concurrent source corrections conflict and review evidence is retained in immutable revisions', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const original = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'decision', title: 'Original title', content: 'Original conclusion', status: 'accepted' });
    const corrected = f.store.execute(f.akash.user.id, 'correct_source', { sourceId: original.id, expectedRevision: original.revision, title: 'Corrected title', content: 'Corrected conclusion', reason: 'New evidence' }).source;
    assert.equal(corrected.title, 'Corrected title');
    assert.throws(() => f.store.execute(f.akash.user.id, 'correct_source', { sourceId: original.id, expectedRevision: original.revision, content: 'Stale replacement', reason: 'Old client' }), errorCode('REVISION_CONFLICT'));
    assert.throws(() => f.store.execute(f.akash.user.id, 'resolve_review', { sourceId: corrected.id, expectedRevision: corrected.revision, status: 'verified', note: '' }), errorCode('INVALID_INPUT'));
    const reviewed = f.store.execute(f.akash.user.id, 'resolve_review', { sourceId: corrected.id, expectedRevision: corrected.revision, status: 'verified', note: 'Verified against acceptance result TEST-42.' });
    assert.equal(reviewed.reviewedBy, f.akash.user.id); assert.ok(reviewed.reviewedAt);
    f.restart();
    const state = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(state.sources.find((s: any) => s.id === corrected.id).reviewNote, 'Verified against acceptance result TEST-42.');
    assert.equal(state.sources.filter((s: any) => s.supersedesId === original.id).length, 1);
    const first = state.revisions.find((r: any) => r.recordId === original.id && r.revision === 1).snapshot;
    assert.equal(first.content, 'Original conclusion'); assert.equal(first.title, 'Original title'); assert.equal(first.status, 'accepted');
    assert.equal(state.revisions.find((r: any) => r.recordId === corrected.id && r.revision === 1).snapshot.status, 'needs_review');
    assert.equal(state.revisions.find((r: any) => r.recordId === corrected.id && r.revision === 2).snapshot.reviewNote, reviewed.reviewNote);
  } finally { f.close(); }
});

test('durable conversation IDs link deliberate captures across sessions without impersonating collaborators', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const first = f.store.execute(f.akash.user.id, 'create_conversation', { workId: work.id, title: 'Planning conversation', clientReference: 'client-session-one' });
    const prompt = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, conversationId: first.id, kind: 'prompt', title: 'Selected request', content: 'Capture only this selected request.', status: 'accepted' });
    const second = f.store.execute(f.akash.user.id, 'create_conversation', { workId: work.id, title: 'Continuation conversation', clientReference: 'client-session-two' });
    const summary = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, conversationId: second.id, kind: 'summary', title: 'Continuing summary', content: 'Continue the same work from the selected request.', status: 'accepted', dependsOn: [prompt.id] });
    assert.notEqual(first.id, second.id); assert.equal(first.workId, second.workId);
    f.store.execute(f.akash.user.id, 'share_work', { workId: work.id, userId: f.maya.user.id, permission: 'edit' });
    assert.throws(() => f.store.execute(f.maya.user.id, 'add_source', { workId: work.id, conversationId: first.id, kind: 'prompt', title: 'Wrong attribution', content: 'My selected prompt', status: 'proposed' }), errorCode('INVALID_CONVERSATION'));
    const collaborator = f.store.execute(f.maya.user.id, 'create_conversation', { workId: work.id, title: 'Collaborator continuation' });
    assert.equal(collaborator.ownerId, f.maya.user.id);
    assert.throws(() => f.store.execute(f.ravi.user.id, 'list_conversations', { workId: work.id }), errorCode('NOT_FOUND'));
    f.restart();
    const conversations = f.store.execute(f.akash.user.id, 'list_conversations', { workId: work.id });
    assert.equal(conversations.total, 3); assert.ok(conversations.items.some((c: any) => c.id === first.id && c.clientReference === 'client-session-one'));
    const context = f.store.execute(f.akash.user.id, 'get_context', { workId: work.id });
    assert.equal(context.sources.find((s: any) => s.id === summary.id).conversationId, second.id);
    assert.equal(context.sources.find((s: any) => s.id === prompt.id).conversationId, first.id);
  } finally { f.close(); }
});

test('context IDs retrieve immutable durable snapshots only under current work authorization', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const context = f.store.execute(f.akash.user.id, 'get_context', { workId: work.id });
    assert.deepEqual(f.store.execute(f.akash.user.id, 'get_context_snapshot', { contextId: context.id }), { snapshot: context, stale: false });
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_context_snapshot', { contextId: context.id }), errorCode('NOT_FOUND'));
    f.store.execute(f.akash.user.id, 'share_work', { workId: work.id, userId: f.maya.user.id, permission: 'read' });
    assert.equal(f.store.execute(f.maya.user.id, 'get_context_snapshot', { contextId: context.id }).snapshot.id, context.id);
    f.store.execute(f.akash.user.id, 'update_work', { workId: work.id, expectedRevision: work.revision, nextAction: 'Changed next action' });
    f.restart();
    const historical = f.store.execute(f.maya.user.id, 'get_context_snapshot', { contextId: context.id });
    assert.equal(historical.stale, true); assert.equal(historical.snapshot.nextAction, 'Review evidence.'); assert.deepEqual(historical.snapshot, context);
    f.store.execute(f.akash.user.id, 'revoke_grant', { workId: work.id, userId: f.maya.user.id });
    assert.throws(() => f.store.execute(f.maya.user.id, 'get_context_snapshot', { contextId: context.id }), errorCode('NOT_FOUND'));
  } finally { f.close(); }
});

test('excluding a bad source removes active use, flags dependencies and supports reviewed restoration', () => {
  const f = fixture(); try {
    const work = createWork(f);
    const bad = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'evidence', title: 'Wrong evidence', content: 'BAD-PROMPT-CONTENT', status: 'verified' });
    const summary = f.store.execute(f.akash.user.id, 'add_source', { workId: work.id, kind: 'summary', title: 'Dependent summary', content: 'Conclusion derived from the recorded source.', status: 'accepted', dependsOn: [bad.id] });
    const historical = f.store.execute(f.akash.user.id, 'get_context', { workId: work.id });
    const excluded = f.store.execute(f.akash.user.id, 'set_source_active', { sourceId: bad.id, expectedRevision: bad.revision, active: false, reason: 'The evidence was invalid.' });
    assert.equal(excluded.source.active, false); assert.ok(excluded.affectedSourceIds.includes(summary.id));
    const current = f.store.execute(f.akash.user.id, 'get_context', { workId: work.id });
    assert.ok(!JSON.stringify(current).includes('BAD-PROMPT-CONTENT')); assert.ok(current.warnings.length > 0);
    assert.equal(current.sources.find((s: any) => s.id === summary.id).status, 'needs_review');
    assert.ok(!f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id }).items.some((s: any) => s.id === bad.id));
    const history = f.store.execute(f.akash.user.id, 'list_sources', { workId: work.id, includeHistory: true });
    assert.ok(history.items.some((s: any) => s.id === bad.id && s.active === false));
    assert.equal(f.store.execute(f.akash.user.id, 'bootstrap').evidenceCounts.verified, 0);
    assert.equal(f.store.execute(f.akash.user.id, 'get_context_snapshot', { contextId: historical.id }).stale, true);
    assert.throws(() => f.store.execute(f.maya.user.id, 'set_source_active', { sourceId: bad.id, expectedRevision: 2, active: true, reason: 'Unauthorized' }), errorCode('NOT_FOUND'));
    assert.throws(() => f.store.execute(f.akash.user.id, 'set_source_active', { sourceId: bad.id, expectedRevision: bad.revision, active: true, reason: 'Stale client' }), errorCode('REVISION_CONFLICT'));
    const restored = f.store.execute(f.akash.user.id, 'set_source_active', { sourceId: bad.id, expectedRevision: excluded.source.revision, active: true, reason: 'New review is needed.' }).source;
    assert.equal(restored.active, true); assert.equal(restored.status, 'needs_review');
    f.restart();
    const state = f.store.execute(f.akash.user.id, 'bootstrap');
    assert.equal(state.revisions.find((r: any) => r.recordId === bad.id && r.revision === 1).snapshot.active, true);
    assert.equal(state.revisions.find((r: any) => r.recordId === bad.id && r.revision === 2).snapshot.active, false);
    assert.equal(state.sources.find((s: any) => s.id === bad.id).status, 'needs_review');
  } finally { f.close(); }
});
