import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { z } from 'zod';
import { DomainError, Store } from './store';
import { workflowInstructions } from './instructions';

const identifier = z.string().min(1).max(100);
const text = z.string().max(100_000);
const paging = { offset: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(100).optional() };

export function mcpAdapter(store: Store) {
  const handler = createMcpHandler(({ authInfo }) => {
    if (!authInfo) throw new Error('Authentication required.');
    const actor = authInfo.clientId;
    const server = new McpServer({ name: 'worktether', version: '0.1.0' }, { instructions: workflowInstructions });
    const tool = (name: string, action: string, description: string, shape: z.ZodRawShape, readOnly = false) => {
      server.registerTool(name, {
        description, inputSchema: z.object(shape).strict(),
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
      }, async (input) => {
        try {
          const result = store.execute(actor, action, input);
          const output = Array.isArray(result) ? { items: result } : result;
          return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output };
        } catch (cause) {
          const error = cause instanceof DomainError ? { code: cause.code, message: cause.message, details: cause.details } : { code: 'INTERNAL_ERROR', message: 'The operation failed.' };
          return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error } };
        }
      });
    };
    tool('workspace_overview', 'bootstrap', 'Retrieve your permitted project workspace. Private records require your access. Work and source results are bounded; use pagination to continue.', { projectId: identifier.optional(), sourceOffset: z.number().int().nonnegative().optional(), revisionOffset: z.number().int().nonnegative().optional(), handoffOffset: z.number().int().nonnegative().optional(), ...paging }, true);
    tool('list_work', 'list_works', 'Search and paginate work you can access in one project. Totals count only permitted work.', { projectId: identifier, query: z.string().max(200).optional(), ...paging }, true);
    tool('list_sources', 'list_sources', 'Retrieve permitted recorded prompts, assumptions, decisions, summaries and evidence. Superseded history is excluded unless requested.', { workId: identifier, ...paging, limit: z.number().int().min(1).max(200).optional(), includeHistory: z.boolean().optional() }, true);
    tool('get_work_context', 'get_context', 'Build a bounded current context package. Budget is UTF-8 bytes of the complete serialized JSON, not model tokens. Preserve requirements; report omissions and review warnings. Fail when mandatory context cannot fit.', { workId: identifier, budgetBytes: z.number().int().min(1).max(1048576).optional() });
    tool('get_context_graph', 'get_graph', 'Inspect a bounded neighborhood of recorded dependencies that you can access. Links are recorded relationships, not proof of every causal model influence.', { workId: identifier }, true);
    tool('create_work', 'create_work', 'Create a durable work ID in a project. Private by default. Project visibility grants members read access.', { projectId: identifier, title: z.string().min(1).max(200), objective: text.min(1), nextAction: text.optional(), visibility: z.enum(['private', 'project']).optional() });
    tool('record_progress', 'update_work', 'Update permitted work using its expected revision. Review current requirements before acknowledging reviewedProjectRevision. Conflict errors require retrieval and reconciliation.', { workId: identifier, expectedRevision: z.number().int().positive(), title: z.string().min(1).max(200).optional(), objective: text.min(1).optional(), nextAction: text.optional(), status: z.enum(['planned', 'active', 'review', 'blocked', 'done']).optional(), reviewedProjectRevision: z.number().int().positive().optional(), reviewNote: text.min(1).optional() });
    tool('record_source', 'add_source', 'Record a selected prompt, assumption, decision, evidence or summary. Only describe evidence as verified when supported. dependsOn records explicit source dependencies.', { workId: identifier, kind: z.enum(['prompt', 'assumption', 'decision', 'evidence', 'summary']), title: z.string().min(1).max(200), content: text.min(1), status: z.enum(['proposed', 'accepted', 'verified', 'needs_review']).optional(), conversationId: identifier.optional(), dependsOn: z.array(identifier).max(100).optional() });
    tool('correct_source', 'correct_source', 'Supersede a source while retaining history. Recorded transitive dependents are flagged for review. Requires current source revision.', { sourceId: identifier, expectedRevision: z.number().int().positive(), title: z.string().min(1).max(200).optional(), content: text.min(1), reason: z.string().min(1).max(2000) });
    tool('resolve_source_review', 'resolve_review', 'Record a human or agent review and evidence for a flagged source. Does not automatically establish factual correctness.', { sourceId: identifier, expectedRevision: z.number().int().positive(), status: z.enum(['proposed', 'accepted', 'verified']), note: text.min(1) });
    tool('send_handoff', 'send_handoff', 'Share an immutable selected snapshot with a project member. Only the owner may send. Does not grant underlying work access or execute another machine. Retry with the same idempotencyKey and identical payload.', { workId: identifier, recipientId: identifier, expectedRevision: z.number().int().positive().optional(), expectedSourceRevisions: z.record(z.string(), z.number().int().positive()).optional(), title: z.string().min(1).max(200), content: text, sourceIds: z.array(identifier).max(100).optional(), attachmentIds: z.array(identifier).max(20).optional(), idempotencyKey: z.string().min(1).max(200) });
    tool('list_inbox', 'list_inbox', 'Retrieve durable handoffs addressed to you, with stale warnings and delivery state. No automatic client notification is assumed.', paging, true);
    tool('get_handoff', 'get_handoff', 'Retrieve one permitted selected handoff snapshot and record recipient retrieval. Revoked handoffs cannot be retrieved.', { handoffId: identifier });
    tool('acknowledge_handoff', 'acknowledge_handoff', 'Acknowledge receipt of a selected handoff. This confirms receipt, not completion of the requested work.', { handoffId: identifier });
    tool('create_conversation', 'create_conversation', 'Create a durable conversation ID within a Work ID. Capture selected excerpts separately; this does not automatically read a client transcript.', {workId: identifier, title: z.string().min(1).max(200), clientReference: z.string().max(1000).optional()});
    tool('list_conversations', 'list_conversations', 'List your conversation identities for permitted work.', {workId: identifier, ...paging, limit: z.number().int().min(1).max(200).optional()}, true);
    tool('get_context_snapshot', 'get_context_snapshot', 'Retrieve a saved immutable context package by ID under current work permissions. The stale flag compares its recorded work and requirement revisions.', {contextId: identifier}, true);
    tool('set_source_active', 'set_source_active', 'Exclude a bad or irrelevant source from future context without deleting history, or restore it for review. Exclusion flags recorded dependents. Requires expected revision and reason.', {sourceId: identifier, expectedRevision: z.number().int().positive(), active: z.boolean(), reason: z.string().min(1).max(2000)});
    tool('prepare_prompt', 'prepare_prompt', 'Prepare a local prompt draft from the exact original request and currently permitted project context. Adds a structured envelope without AI rewriting or automatic submission. Draft is personal and carries context IDs, revisions, warnings and omissions.', { workId: identifier, originalRequest: z.string().min(1).max(20000), format: z.enum(['request', 'plan', 'review', 'explain']).optional(), conversationId: identifier.optional(), budgetBytes: z.number().int().min(1).max(1048576).optional() });
    tool('get_prepared_prompt', 'get_prepared_prompt', 'Retrieve your personal saved prompt draft under current work permissions. The stale flag reports changes since preparation. Review before manually copying to a client.', { promptId: identifier }, true);
    return server;
  }, { legacy: 'stateless', maxRequestBodySize: 8 * 1024 * 1024 });
  return { handle: toNodeHandler(handler, { maxRequestBodySize: 8 * 1024 * 1024 }), close: () => handler.close() };
}
