# Functional Specification Document

Version 0.4 · 5 October 2026. This document specifies the current prototype and separately names proposed L2 contracts. [PRD](PRD.md) is the product baseline; [architecture](ARCHITECTURE.md) explains the components. Code references below are implementation evidence, not configuration files to copy into a client.

## 1 Current components and invariants

| Component | Responsibility |
| --- | --- |
| [server/store.ts](../server/store.ts) | Authorization, domain validation, records, transactions, revisions, context selection, correction propagation, handoffs. |
| [server/index.ts](../server/index.ts) | Loopback HTTP, authentication, host/origin validation, API routes, file delivery, static UI. |
| [server/mcp.ts](../server/mcp.ts) | Official SDK HTTP adapter, typed tool inputs, domain dispatch, structured tool errors. |
| [server/stdio.ts](../server/stdio.ts) | Official SDK stdio bridge; forwards to the authenticated HTTP service without owning a database. |
| [integrations/config.ts](../integrations/config.ts), [setup CLI](../scripts/setup-mcp.ts) | Local config generation and separate personal credential provisioning; no global config overwrite. |
| [server/prompts.ts](../server/prompts.ts) | Versioned deterministic context projection/composition without external AI calls. |
| [src/App.tsx](../src/App.tsx), [workflow](../src/workflow.tsx), [PromptBuilder](../src/PromptBuilder.tsx) | Permitted browser views, responsive navigation, readable context and deliberate prompt review/copy/save. |

The domain derives the actor from authenticated request state. Every exposed operation checks project/work authority. Changing surface from browser to MCP does not change ownership or grant rules. SQLite `BEGIN IMMEDIATE` transactions protect multi-record mutations. There is one local workspace; multi-organization tenancy is unimplemented.

## 2 Authentication and transport

Browser registration/login returns a public user and sets a seven-day HttpOnly, SameSite=Strict session cookie. Passwords use salted scrypt. Session/credential tokens are stored as hashes. Local connection credentials are revealed once and belong to a user/device registration; a revoked credential or device fails subsequent authentication. MCP accepts Bearer authentication and does not authenticate through browser cookies.

The service listens on `127.0.0.1`; Host must be loopback. Supplied origins must be allowlisted; browser mutations using cookies require a trusted Origin. Request bodies are limited to 8 MiB. Auth endpoints have a local in-memory attempt limiter. This is a local profile, not production OAuth or a complete hosted security model.

Streamable HTTP endpoint: `/mcp`. Current SDK packages and exact resolved versions are recorded in [package-lock.json](../package-lock.json). The adapter supports stateless legacy negotiation and the newer protocol mode exercised by the SDK integration check. MCP transport identity is not a durable chat ID.

The local stdio bridge connects to that endpoint with its personal credential and forwards the same tool catalog and results. The HTTP service rechecks authentication on requests, so revocation also denies subsequent bridge calls. Protocol output alone goes to stdout; operational errors go to stderr without raw tokens. Network failures do not automatically retry mutations because their outcomes may be uncertain.

The setup CLI creates a device/credential for each selected client and writes absolute-path launch configurations. Client configs contain credential-file paths; ignored connection files contain the raw tokens in plaintext (0600 files and 0700 directories on POSIX, OS ACLs on Windows). Server-side tokens remain hashed. Setup preserves unrelated config entries, rejects conflicts, and attempts to revoke new connections/remove its new credential files if setup fails. Failed cleanup produces an explicit dashboard/local-file recovery message. No global client config, OS keychain, native chat adapter, or automatic prompt rewrite is installed.

## 3 Record specification

| Entity | Current core fields / behavior |
| --- | --- |
| Project | `id`, owner, name, objective, requirements, `revision`; membership separate. |
| Work | `id`, `projectId`, owner, title, objective, next action, status, visibility, `revision`, `needsReview`, reviewed project revision. |
| Conversation | `id`, `workId`, `ownerId`, title, `clientReference` or null, creation time. |
| Source | `id`, `workId`, optional conversation, kind, title/content, author, state, `active`, revision, timestamps, supersession/review metadata. |
| Edge | Identified directed relationship; dependency, correction/supersession, or graph containment as applicable. |
| Revision | Immutable snapshot keyed by entity, record ID, and revision number. |
| Context | Identified immutable serialized package with selected sources and work/project revisions. |
| Prepared prompt | `pmt_` ID, actor/work/project, optional own conversation, verbatim original, format/method, fixed prepared text, added context projection, full context snapshot and ID, baseline/source revisions, prepared bytes, time; saved-source/title linkage is updated after explicit save. |
| Grant | Work/user relationship with read or edit authority. |
| Handoff | Sender/recipient/project/work, selected immutable payload, retry identity, receipt state, staleness/revocation metadata. |
| Device / credential | Personal labels, last authenticated observation, revocation; credential stores hash rather than raw token. |
| Attachment | Work-bound file name/type/size and base64 content; protected download and selected handoff access. |
| Event | Attributed audit event; permitted event views are bounded. |

Storage is one `records(entity,id,body)` table with JSON bodies and WAL. Entity scans load JSON records; pagination bounds responses, not internal scanning. This is not an indexed relational implementation of the logical model. Hosted migration must preserve IDs and revisions.

Sources: `prompt`, `assumption`, `decision`, `evidence`, `summary`. Current states: `proposed`, `accepted`, `verified`, `needs_review`, `superseded`. `active` is independent of state. A user's `verified` label is not external factual certification. Work states: `planned`, `active`, `review`, `blocked`, `done`.

## 4 Current MCP tool catalog

Names match the 20 registrations in `server/mcp.ts`. `?` means optional; inputs are strict schemas. Identifiers are nonempty strings up to 100 characters at the MCP boundary. Ordinary content fields are capped at 100,000 characters, titles at 200, and correction/exclusion reasons at 2,000. Limits are validation bounds, not recommended model context sizes.

| Tool | Inputs | Result / authority |
| --- | --- | --- |
| `workspace_overview` | `projectId?`, work `offset?/limit?`, `sourceOffset?`, `revisionOffset?`, `handoffOffset?` | Permitted bootstrap, personal connection metadata, bounded pages and history. |
| `list_work` | `projectId`, `query?`, `offset?/limit?` | Permitted work page; query and totals operate on accessible records. |
| `list_sources` | `workId`, `offset?/limit?`, `includeHistory?` | Accessible source page; history opt-in. Inactive records are omitted from default current source listing. |
| `get_work_context` | `workId`, `budgetBytes?` | Creates and persists a current context snapshot; requires read access. |
| `get_context_graph` | `workId` | Bounded permitted recorded neighborhood and scope/truncation information. |
| `create_work` | `projectId`, `title`, `objective`, `nextAction?`, `visibility?` | Private by default; actor becomes owner. |
| `record_progress` | `workId`, `expectedRevision`, optional title/objective/nextAction/status/reviewedProjectRevision/reviewNote | New work revision; owner/edit authority. Acknowledging requirements does not clear unresolved source reviews. |
| `record_source` | `workId`, `kind`, `title`, `content`, `status?`, `conversationId?`, `dependsOn?` | New source and work revision; owner/edit authority. Dependencies must be readable sources in the same project, max 100. |
| `correct_source` | `sourceId`, `expectedRevision`, `content`, `reason`, `title?` | Replacement source plus accessible affected IDs; recorded dependent reviews and preserved history. |
| `resolve_source_review` | `sourceId`, `expectedRevision`, `status`, `note` | Current active source gets resolution, reviewer/time/note and new revision. |
| `send_handoff` | `workId`, `recipientId`, `title`, `content`, `idempotencyKey`, `sourceIds?`, `attachmentIds?`, `expectedRevision?`, `expectedSourceRevisions?` | Selected immutable delivery; work owner only, recipient project member. At most 100 sources/20 attachments. |
| `list_inbox` | `offset?/limit?` | Recipient metadata page, without full payload. |
| `get_handoff` | `handoffId` | Authorized selected snapshot; recipient retrieval changes receipt state. |
| `acknowledge_handoff` | `handoffId` | Recipient acknowledges receipt; no execution or task-completion implication. |
| `create_conversation` | `workId`, `title`, `clientReference?` | New `conv_…` record; work edit permission, authenticated owner attribution. |
| `list_conversations` | `workId`, `offset?/limit?` | Conversation metadata for accessible work, including collaborators' records in that work. |
| `get_context_snapshot` | `contextId` | `{snapshot, stale}` under current work access; historical content remains immutable. |
| `set_source_active` | `sourceId`, `expectedRevision`, `active`, `reason` | Exclude or restore a current source; history and dependency review preserved. |
| `prepare_prompt` | `workId`, `originalRequest` (1–20,000 characters, nonblank), `format?` (`request`, `plan`, `review`, `explain`), own `conversationId?`, `budgetBytes?` | Persists personal original-preserving local draft and context; work read access, no external call/submission. |
| `get_prepared_prompt` | `promptId` | Author-only draft retrieval plus current work permission; reports work/project baseline staleness. |

Read annotations are hints; context generation persists a record and handoff retrieval changes recipient delivery state. `prepare_prompt` persists a personal draft and context. There is no MCP tool named `optimize_prompt`, `save_prepared_prompt`, `list_prepared_prompts`, `capture_turn`, or `bind_native_session` in the current catalog.

Work pages default to 40 and cap at 100. Source pages default/cap at 200. Conversation pages default to 100 and cap at 200. Inbox pages default to 40 and cap at 100. Pages identify returned items, offsets/limits, and permitted totals. Bootstrap contains bounded work/source/history/handoff views; follow page metadata rather than assuming completeness.

## 5 Browser/API operations

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Local health/mode/version, without private project data. |
| `POST /api/auth/register` | Register name/email/password. Password minimum 12 characters. |
| `POST /api/auth/login` | Authenticate and create local browser session. |
| `POST /api/auth/logout` | Revoke current session. |
| `GET /api/bootstrap` | Authenticated permitted initial view with supported offsets. |
| `POST /api/action` | `{action,input}` dispatch to the same domain service. |
| `GET /api/attachments/:id` | Authorized attachment download, attachment disposition and nosniff. |

Additional domain actions available through the API/browser include project create/update, add member, work grants/revocation/reassignment, handoff revocation, device/credential management, and attachment upload/download. They are **not all exposed as MCP tools**. Use `server/store.ts` for the exact action validation before adding a new API consumer. Prompt actions also include `list_prepared_prompts` (own metadata; offset/limit, default ten, maximum 100) and `save_prepared_prompt` (`promptId`, `title`, `expectedRevision`, `reviewed:true`). These two actions are API/browser-only, unlike prepare/get.

File MIME allowlist: `text/plain`, `text/markdown`, `application/pdf`, `image/png`, `image/jpeg`; maximum decoded size 5 MiB. Metadata listing does not return file bytes. No OCR, content parsing, malware scan, or attachment MCP upload tool is implemented.

## 6 Context assembly

`get_work_context` maps to `get_context`. Default `budgetBytes` is 32,768; range 1–1,048,576. The measured object is the complete compact JSON package encoded as UTF-8. This is not a host-token budget or a budget for the model's entire request.

1. Authorize work and project.
2. Include current objective, requirements, next action, requirement/work revisions, and mandatory review/correction information.
3. Evaluate permitted current sources for this work by state and recency; exclude inactive and superseded records.
4. Include complete selected entries while they fit. Label selection reasons and proposal/review uncertainty.
5. Return permitted omission information and persist the exact package. If mandatory material cannot fit, return `BUDGET_TOO_SMALL` rather than truncate constraints.

Package fields include `id`, `workId`, `workRevision`, `projectRevision`, objective/project objective/requirements/next action, warnings, corrections, sources, omitted information, `budgetBytes`, `bytesUsed`, `sizeMeasure`, and creation time. Included source entries carry IDs, revision/provenance, and selection reasons. Omission details contain at most the documented sample of permitted IDs, not hidden-record counts.

Historical snapshot retrieval rechecks current permission and reports staleness when the current work/project revision differs. This is not a comprehensive check of every external dependency, native chat, or copied package. The caller must retrieve current context before a new decision.

## 6A Current local prompt composition

`prepare_prompt` validates a nonblank original without trimming it, resolves work read permission and optional own conversation, creates current context, and persists a personal `prepared_prompt`. The method is `worktether-local-2`. A compact `addedContext` projection retains goals/requirements/next action, warnings/corrections/omissions, snapshot IDs/revisions/time and source provenance/content, while omitting repeated internal source metadata. Full `context` stays in the draft separately.

The prepared text consists of the exact original, selected format instruction, scope/evidence reminders, and labeled JSON reference data. There is no semantic rewrite, source verification, external model call, or automatic delivery. `preparedBytes` measures the full generated UTF-8 text; `budgetBytes` still limits the compact full context snapshot, not generated text or model tokens.

Draft content is fixed. Only its actor may list/retrieve it, with current work access rechecked; saved Context IDs retain their existing work-permission behavior. Staleness compares current work/project revisions, not independently every external dependency. The browser invalidates previews after input/format/baseline/conversation changes and requires review before fresh authenticated retrieval/copy.

`save_prepared_prompt` additionally requires edit access, title, expected work revision, and `reviewed:true`. It rejects an unsaved stale draft. It creates a `proposed` prompt source containing only the original request, with dependencies on included source/correction IDs and `preparation` metadata: Prompt ID, method/format, Context ID, work/project/source revisions, reviewer/time. The full envelope is not nested into source content. That source follows ordinary work access; the full draft remains actor-private.

Saving updates saved-source/title linkage and increments work revision, making the draft historical. Repeated completed save with the same draft/title returns its source after authority/review checks; changed title returns `IDEMPOTENCY_CONFLICT`. Current save records a review assertion, not factual verification or a semantic acceptance/rejection registry. See [Prompt builder](PROMPT_BUILDER.md).

## 7 Corrections and exclusions

Correction requires a current source and expected revision. It creates a new replacement ID, marks the original superseded, preserves immutable history, records supersession, and propagates review flags through recorded transitive dependency edges. Traversal handles cycles. Private dependent records may be updated internally but are filtered from the response.

Exclusion sets `active=false` with reason/actor/time and new revision; future active context/source views omit it. Dependents need review. Restoration sets the source active and `needs_review`. Neither operation deletes the historical source or repairs an already running model's memory.

Resolving a source review stores the note, reviewer, and time; it cannot resolve an inactive/superseded source. Work review remains required if other active sources need review or the project baseline has not been acknowledged.

## 8 Sharing, idempotency, and concurrency

Only the work owner sends selected handoffs. The recipient must be a current project member. All selected sources/files must belong to the selected work and be permitted. UI preview sends expected work/source revisions; changed state rejects submission. Those fields are optional in the current MCP schema, so a tool caller should provide them after its own review.

The retry key is scoped to authenticated sender and operation and stored with the payload fingerprint. Identical retry returns the original delivery; changed payload produces `IDEMPOTENCY_CONFLICT`. Persisted payload and delivery state are atomic. Receipt state progresses queued → retrieved → acknowledged. Sender retrieval does not count as recipient retrieval.

Revoking delivery blocks future service retrieval; previously copied data remains outside service control. A delivery does not expose the original private work. Work/source changes mark snapshots stale without replacing their payload. Grant revocation and ownership transfer are separate domain operations.

Revision-checked writes return conflicts without overwriting. Re-fetch and compare before resubmission; do not substitute the current revision into an old proposed update without review.

## 9 Errors

HTTP domain errors use `{error:{code,message,details?}}`. MCP domain failures return `isError:true` and a structured error payload; protocol/schema-level failures may use the SDK's JSON-RPC error path.

| HTTP / example code | Meaning / client action |
| --- | --- |
| 400 `INVALID_INPUT`, `INVALID_CONVERSATION`, `INVALID_FILE`, `REVIEW_REQUIRED` | Fix the request; conversation attribution must match actor/work and prepared save requires review assertion. |
| 401 `UNAUTHENTICATED` | Obtain valid current identity; never fall back to an unauthenticated actor. |
| 403 `FORBIDDEN`, `INVALID_HOST`, `INVALID_ORIGIN`, `ORIGIN_REQUIRED` | Authority/host/origin mismatch; do not weaken checks to make setup pass. |
| 404 `NOT_FOUND` | Missing or concealed inaccessible object; do not infer whether private content exists. |
| 409 `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `ALREADY_SUPERSEDED`, `STALE_CONTEXT` | Retrieve/reconcile or prepare a new draft; reuse keys/draft saves only for identical completed payloads. |
| 413 `TOO_LARGE` | Reduce request/file size. |
| 422 `BUDGET_TOO_SMALL` | Increase permitted budget or reduce mandatory baseline deliberately. |
| 429 `RATE_LIMITED` | Back off local authentication attempts. |
| 500 `INTERNAL_ERROR` | Generic failure; no internal secrets in response. |

## 10 Proposed L2 contracts — unavailable today

Exact public names and schemas must be reviewed before implementation; these are design requirements, not usable tools.

| Proposed operation | Inputs / outputs / invariant |
| --- | --- |
| Bind native conversation | Authenticated integration identity, approved project/work, native session reference, resume/fork mode; return stable WorkTether Conversation ID. Unique scoped mapping, no authority from email/native ID alone. |
| Capture selected turn | Mapping, client event ID, original selected prompt, capture scope/consent version; idempotent source creation. Identical event/payload deduplicates, mismatch conflicts. |
| Semantically assist preparation | Extend the implemented local composer with an explicitly authorized/evaluated model mode, changed-span diff, constraint checks, ambiguities, cost/latency and failure handling. No current external model mode. |
| Record preparation decisions | Extend current browser review assertion/proposed-source save with an explicit accept/reject registry and adapter lifecycle; never overwrite original. |
| Record adapter delivery | Prepared ID, native turn/event reference, status and failure reason; distinguish attempted, host-accepted, and unknown. No false model-processing guarantee. |

New records should include mapping/preparation/consent revisions, lifecycle timestamps, policy version, and exact context provenance. Secret storage remains in the client/credential system, not in prompts. Persist mapping and captured source atomically where possible. Use a verified client event ID or an adapter-generated persisted retry ID; text hashes alone cannot distinguish legitimate repeated prompts.

Current preparation is inspectable deterministic composition. Optional model assistance must be opt-in, evaluated, and able to return ambiguity without changing intent. [PROMPT_CONTEXT.md](PROMPT_CONTEXT.md) specifies lifecycle and host boundaries; [GUARDRAILS.md](GUARDRAILS.md) specifies release conditions.
