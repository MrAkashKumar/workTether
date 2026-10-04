# WorkTether Product Requirements Document

WorkTether preserves current project intent, work identity, decisions, evidence, and progress across AI conversations and collaborators. A browser dashboard and MCP service expose the same authorized state. Larger context windows increase available space; they do not establish which information should guide a task.

| Field | Value |
| --- | --- |
| Version / date | 0.5 / 5 October 2026 |
| Status | Local prompt preparation implemented; native adapters, evaluation, hosting, and client certification remain planned |
| Deployment | Local first, then one shared hosted service |
| Client targets | Codex, Cursor, Claude Code; Claude Desktop/web through separately verified routes |
| History | Version 0.1 preceded implementation; [change history](CHANGELOG.md) |
| Related documents | [BRD](BRD.md), [FSD](FSD.md), [architecture](ARCHITECTURE.md), [guardrails](GUARDRAILS.md) |

The name is provisional. Implemented means behavior exists in this repository. Partial means a foundation exists but the full acceptance condition is unproven or incomplete. Planned means design only. Official client capability does not mean this application has been tested in that client.

## 1 Problem and intended outcome

Project work is difficult to track when requirements, assumptions, decisions, and progress exist only in growing chats. An incorrect assumption may survive summarization. A collaborator may use an outdated requirement. A new chat may remember the conclusion without its evidence. Multiple clients may develop inconsistent versions of project intent.

The intended outcome is that an authorized person selects a Work ID, retrieves current requirements and unresolved reviews, understands the evidence and next action, and continues from a traceable state. Selected collaboration should preserve this continuity while respecting each person's private work.

Context engineering manages the working information supplied for a task: retrieval, selection, provenance, freshness, and budgets. Prompt engineering manages the instructions and wording. WorkTether needs both; prompt rewriting cannot repair unverified evidence or stale requirements by itself.

The user's 10M/100M-token examples are hypothetical future windows, not a model-support claim. The product must separate archive size from active context. It should retrieve enough permitted material for the objective, not automatically fill a larger window.

## 2 Confirmed requirements and proposed choices

Confirmed requirements:

- Many people, projects, machines, and independent or continuing conversations; three machines were an example, not a limit.
- Durable identification for work, conversations, prompts/sources, summaries, and collaboration.
- Personal work visible only through authorized access, with deliberate project sharing of selected text and files.
- Codex, Cursor, and Claude integration using MCP, including a documented approach to prompt preparation and conversation identification.
- A understandable dashboard, recorded relationship graph, evidence chart, connection information, and clear agenda.
- Wrong or irrelevant information can be corrected or excluded without losing history.
- Local first, a documented shared-hosting path, and GitHub later.
- A PRD before implementation and detailed documentation in `docs/`, with the README at the WorkTether root.

Proposed architecture: one authoritative domain service, browser plus MCP, local SQLite initially, and a shared indexed database later. Native client adapters are opt-in and capability-specific. An explicit retrieval workflow remains available when a client cannot intercept prompts.

## 3 Users and authority

| Actor | Responsibility |
| --- | --- |
| Contributor | Own work, record selected sources, continue across devices, review changes. |
| Project owner | Maintain shared requirements and membership. |
| Collaborator | Read/edit granted work or receive selected handoffs. |
| Operator | Run storage, backups, credentials, and hosting; production role management is future work. |

Authenticated people own contributions. Devices are connection labels, not principals granting project authority. The local release has one workspace with multiple projects/users; organization tenancy and a workspace administration UI are planned.

| Action | Project owner | Work owner | Read grantee | Edit grantee |
| --- | --- | --- | --- | --- |
| Maintain project requirements/membership | Yes | Only if project owner | No | No |
| Read private work | Only with grant | Yes | Yes | Yes |
| Edit work/sources | Only with edit grant | Yes | No | Yes |
| Grant access, send owner handoff, reassign | Only if work owner | Yes | No | No |
| Manage personal client credential | Own only | Own only | Own only | Own only |

Project-visible work explicitly grants project members read access. Revoking a named grant does not remove access that still exists through project visibility. Reassignment preserves the Work ID and explicitly chooses whether the old owner retains none/read/edit access.

## 4 Release boundaries

| Stage | Outcome | Current status |
| --- | --- | --- |
| L0 Local foundation | Stable IDs, private work, revisions, bounded context, corrections, handoffs, dashboard, real MCP. | Implemented with known limits and recorded local verification. |
| L1 Client certification | Real Codex, Cursor, Claude Code tests with identity, conflicts, and revocation. | Planned; configuration routes are documented. |
| L2 Prompt preparation/adapters | Inspectable local preparation, original preservation, consent, native-session mapping, selected capture. | Partial: manual local builder implemented; semantic evaluation, consent registry, and native adapters planned. |
| L3 Shared pilot | HTTPS, production identity, indexed storage, team lifecycle, backups, client/OS testing. | Planned. |
| L4 GitHub linkage | Authorized repository/commit/PR/result links. | Planned. |

No release promises universal transcript capture, arbitrary automatic prompt replacement, perfect memory, unbiased model behavior, complete causal tracing, unlimited devices/capacity, or remote execution. Automatic dashboard opening, embedded MCP Apps, push notifications, and full transcript import require additional implementation and host support.

## 5 Identity and lifecycle

| Record | Purpose / current behavior |
| --- | --- |
| Project ID | Shared objective, requirement baseline, members, revisions. |
| User ID | Authenticated person; not supplied by the model as authority. |
| Device / credential ID | Personal registration and revocable connection credential. |
| Work ID | Stable objective across owners, machines, and conversations. |
| Conversation ID | Service-generated conversation record scoped to work and attributed to a person. |
| Source ID | Selected prompt, assumption, decision, evidence, or summary with author and state. |
| Revision ID | Immutable project/work/source state reference. |
| Context ID | Exact saved package and its work/project revisions. |
| Prompt draft ID | Personal original-preserving prepared text with method, format, and context/source baseline. |
| Handoff ID | Immutable selected delivery and mutable receipt/revocation state. |
| Native session / turn mapping | Proposed adapter record; not equivalent to an MCP connection identifier. |

Current IDs use type-prefixed UUIDs. An ID identifies a record; it never authorizes access. A fresh chat continuing the same objective keeps the Work ID and creates a new Conversation ID. A resumed native session should reuse its mapped Conversation ID once adapters exist. A distinct objective receives a new Work ID. Fork-origin metadata linking a new work item to a specific snapshot is planned; users can record an explicit source reference today.

Current `clientReference` is an optional opaque string. It is not a verified native chat binding or a deduplicating session registry. Conversation metadata is visible to authorized readers of its work; source capture can only attach to the actor's own conversation within that work. Changing clients does not silently combine personal chats.

## 6 Core journeys

### Create and continue

A person registers, creates a project, records shared requirements, and creates private work. The owner adds registered collaborators by email when needed. Invitation delivery is planned. The person connects a personal MCP credential, selects work, explicitly creates a conversation, and records selected sources. Before continuing, the assistant retrieves current context and inspects requirements, warnings, and next action. Progress updates use the expected revision.

### Prepare a prompt — implemented local workflow

Open permitted work and its **Prompt builder**, enter an original request, choose a response format, and prepare a personal draft. The server preserves the request verbatim, creates current authorized context, and composes a local envelope with goals, requirements, sources, warnings, corrections, omissions, and provenance. The UI separates original input from added context and generated text. No external AI call or semantic rewrite occurs.

The person confirms review before copying. Copy re-fetches current access/freshness; editor-only explicit save requires review assertion and a current baseline, storing the original request as a proposed prompt source with preparation metadata/dependencies. The full assembled draft stays personal instead of being nested into future source context. Saving increments the work revision, making that draft historical. See [Prompt builder](PROMPT_BUILDER.md).

Native-session capture, automatic delivery, semantic transformation/diffs, accept/reject registry, and measured task-quality improvement remain future work. Client hooks require separate supported/authorized integrations; nothing intercepts every model request.

### Collaborate

The work owner selects a named project member, text, sources, and attachment IDs. The browser previews the complete selected content and revisions. Sending creates a durable snapshot without granting access to the underlying private work or executing a remote machine. The recipient retrieves it and may acknowledge receipt; acknowledgement is not task completion. An edit grant or ownership transfer is a separate action.

### Correct direction

An editor corrects a current source using its ID, expected revision, replacement, and reason. History remains. Recorded transitive dependents are flagged for review, including private dependents internally without disclosing them. Future current context excludes superseded or inactive sources and carries applicable review information. Unrecorded influences cannot be discovered reliably from this graph.

Exclusion changes future active context while preserving history. Restoration returns the source for review. A correction cannot erase information already in a running model conversation; the client must retrieve current context and decide whether to restart/restate the task.

### Reconcile or recover

Two writers using the same revision produce a conflict rather than a silent overwrite. The losing writer retrieves current state and reconciles. Restart preserves IDs and accepted records. There is no offline mutation queue. An ambiguous failed delivery retries with the identical payload/key rather than sending a new duplicate.

## 7 Functional requirements

FR01–FR20 retain their original identifiers. The table records actual status instead of implying all target behavior is complete.

| ID | Requirement and acceptance condition | Status / stage |
| --- | --- | --- |
| FR01 | Derive identity from verified credentials; enforce project membership. Separate organization/workspace tenancy before hosted multi-organization use. | Partial: local identity/membership implemented; tenancy L3. |
| FR02 | Private work by default; explicit read/edit grants; project ownership alone cannot read private work. | Implemented L0. |
| FR03 | Create/search/update/reassign stable work with visible states; Work ID survives owner/device/chat changes. | Implemented L0. |
| FR04 | Immutable project/work/source revisions; stale expected-revision writes fail atomically. | Implemented L0. |
| FR05 | Record selected prompt/assumption/decision/evidence/summary with author, time, status, optional conversation, explicit dependencies. | Implemented L0; automatic capture/summarization excluded. |
| FR06 | Assemble/save bounded current context; preserve mandatory state; identify selection, omissions, revisions, warnings, next action; fail if mandatory package cannot fit. | Implemented L0, UTF-8 JSON byte budget. |
| FR07 | Permission-filter search, retrieval, graphs, and result counts before disclosure. | Implemented L0 within current surfaces. |
| FR08 | Preview selected recipient/text/sources/files; share immutable selected payload without underlying work access. | Implemented L0; browser provides full preview. |
| FR09 | Durable inbox; identical scoped retry key/payload returns same delivery; changed payload conflicts; queued/retrieved/acknowledged states distinct. | Implemented L0. |
| FR10 | Preserve correction history and flag recorded transitive dependencies cycle-safely. | Implemented L0; not complete causal tracing. |
| FR11 | Permission-filtered bounded graph and readable relationship list; display scope and truncation. | Implemented L0. |
| FR12 | Defined evidence-state chart with accessible scope, counts, and empty state; no unsupported accuracy/token claims. | Implemented L0; more charts planned. |
| FR13 | Personal client/device registration, revocation, last authenticated activity; distinguish observation from online/execution state. | Implemented L0; labels user-entered. |
| FR14 | Real HTTP/stdio MCP discovery and authorized operations using supported SDK. | Implemented L0, SDK and spawned bridge tests; real host certification L1. |
| FR15 | Browser/API and MCP share domain permissions, revisions, validation, and transactions. | Implemented L0. |
| FR16 | Truthful capabilities and manual/browser fallback; no automatic UI/hook claim merely from installation. | Partial: docs/UI explain limits; certified per-host reporting L1/L2. |
| FR17 | Attributed audit records for important changes, corrections, grants, and handoffs with permission-filtered viewing. | Implemented L0; hosted audit/export administration L3. |
| FR18 | Revoke sessions/credentials/devices/grants/handoffs; deny future controlled retrieval including contexts/files. | Implemented L0; account-wide session administration L3. |
| FR19 | Persist IDs/state/revisions/permissions/handoffs across restart. | Implemented L0; backup/recovery operations L3. |
| FR20 | Responsive browser overview/work/context/prompt-builder/sources/history/handoffs/dependencies/members/connections; clear states, reviewable actions, reduced-motion behavior. | Partial: local UI implemented/reviewed; formal accessibility audit pending. |
| FR21 | Durable conversation capture attribution plus native session/turn mapping unique by authenticated integration scope, with idempotent lifecycle. | Partial: explicit conversations, client/laptop labels and browser tracking implemented; adapters/mapping L2. |
| FR22 | Exclude/restore current sources with reason/revision; preserved history and dependency review flags. | Implemented L0. |
| FR23 | Preserve original prompt; prepared variant has inspectable additions, method version, context/source provenance and review before use. Extend to semantic diff and accept/reject registry when needed. | Partial L2: personal local drafts, review-gated copy, and reviewed proposed-source save implemented; semantic diff/evaluation and rejection registry planned. |
| FR24 | Client-specific setup, capability matrix, version/OS/auth evidence; sanitized configs; Claude surfaces separated. | Setup CLI and stdio bridge implemented; real client certification L1. |
| FR25 | Explicit capture/preparation; choose project/work; handle stale/revoked access, unsupported hooks, uncertainty, and timeout visibly. | Partial L2: explicit local preparation and access/freshness failures implemented; native capture/consent and host fallback planned. |
| FR26 | One authoritative shared deployment for multiple physical machines with per-person identity, HTTPS, indexed storage, restore, and tested clients. | Planned L3; documented migration. |
| FR27 | User export, retention/deletion, membership removal, credential lifecycle, and operator policies before broader hosted use. | Planned L3. |
| FR28 | GitHub App or reviewed connector with scoped repository authority; immutable commit/PR links and deduplicated verified events. | Planned L4. |
| FR29 | Root README agenda plus BRD, PRD, FSD, diagrams, guardrails, evidence, and roadmap in `docs/`. | Delivered documentation baseline. |

## 8 MCP and client requirements

HTTP and the implemented stdio bridge expose the same 20-tool surface, specified in [FSD](FSD.md). Tool names/schemas must match implementation; proposed tools must be visibly marked unavailable. Credentials map to authenticated users, not model-supplied actor IDs. Tool annotations are hints for hosts, not permission enforcement.

An MCP server exposes operations called by a client. It does not inherently receive all prompts, native chat identifiers, transcripts, host system instructions, model outputs, or usage counters. MCP transport sessions are not durable conversation identity. Hooks or client extensions add separate capabilities and consent obligations.

The [integration guide](INTEGRATIONS.md) documents Codex, Cursor, and Claude Code HTTP routes. Claude Desktop local extension/bridge and Claude remote connectors are separate routes. Local loopback is unavailable to cloud-origin connectors. Actual transport/authentication/client behavior must be recorded in a certification matrix rather than generalized from SDK tests.

On connection the host should discover tools; a person can then request workspace overview and open the dashboard link. A failed or absent tool call must not create an inferred successful sync. Future adapters should report identity, supported capture mode, mapped Work/Conversation IDs, last synchronization, and fallback reason, without exposing secrets.

## 9 Prompt preparation and relevance

Current preparation preserves original wording and adds the selected response format plus a compact current-context projection. Goals, requirements, next action, warnings, corrections, omissions, and source IDs/revisions remain visible. Repeated internal source metadata is omitted from the added projection; the full snapshot remains persisted. This is deterministic organization, not semantic ambiguity/conflict detection or intent interpretation.

The original is evidence of what the user requested and is never overwritten. The envelope asks the receiving model to surface conflicts and distinguish assumptions from evidence; it cannot guarantee compliance. Prepared text is a draft, not an accepted requirement baseline. The user can leave it unused or copy the original instead. Explicit reviewed save creates only a proposed source containing the original request.

Existing selection uses the chosen work, state, and recency; there is no semantic reranker or LLM optimizer. Future semantic retrieval should be evaluated against a deterministic baseline. Summaries must retain source and requirement revisions and become reviewable when dependencies change. Arbitrary archival text is never promoted to host instruction authority solely because it was retrieved.

Byte savings and task quality are separate measures. Actual tokens depend on the model/tokenizer and complete client request; the service reports compact context bytes and complete prepared-text UTF-8 bytes separately. Measure any new preparation overhead, including optional model calls, before claiming a cost benefit.

## 10 UI requirements

The opening dashboard prioritizes permitted work, requirement changes/reviews, next actions, inbox, and connection observations. The full browser interface is the cross-client fallback. It is opened deliberately; automatic launch is not implemented.

| View | Required content / actions |
| --- | --- |
| Overview | Selected project, accessible work, pending handoffs, review flags, evidence-state chart. |
| Work | Objective, owner/state/revision, current requirements, sources, next action, explicit continuation. |
| Context | Package ID/revisions/budget, warnings, source reasons, omissions, saved snapshot/stale state. |
| Conversations | WorkTether ID, owner, title, supplied client/laptop labels, optional client reference, own attribution selection and start/resume instructions; future native mapping/capture status. |
| Handoffs | Sender/recipient, exact selected snapshot, delivery/review/stale state, acknowledge action. |
| Dependencies | Bounded recorded neighborhood, labeled relations, permitted omission information, record list. |
| Connections | Device/client labels, last observed request, credential creation/revocation, setup guide. |
| Project members / Sharing / History | Project membership, work grants, immutable changes, correction/review evidence, explicit ownership changes. |
| Prompt builder | Original input, format choice, inspectable added context, personal draft ID/provenance, review/freshness gate, copy and editor-only save. Native capture/diffs/evaluation remain planned. |

Graphs answer questions such as which recorded conclusions need review after a correction. They are not complete organization maps. Charts must label what is counted; verified evidence is a recorded status, not a factual accuracy score. Prompt/token charts require measured usage or clearly labeled estimates.

[Dashboard concept](assets/dashboard-concept.png) and [connection concept](assets/connection-concept.png) are illustrative designs. [Earlier dashboard](assets/dashboard-local.jpg) and [mobile connection setup](assets/connections-mobile.jpg) show an earlier local UI with sample records; they do not certify the version 0.5 layout. Current screenshots are in the root README and tracking/setup guides.

## 11 Privacy, guardrails, and retention

Apply [GR01–GR18](GUARDRAILS.md). Server authorization is authoritative; client instructions cannot grant access. Filter before ranking and counting. Recheck permission on historical contexts/files/handoffs. Do not leak hidden dependents through counts or graph nodes.

Project requirements are intentionally shared; private work and its source records require ownership, grants, or explicit project visibility. Prepared drafts are additionally restricted to their author; explicitly saved originals become normal work-readable sources. Preparing persists personal input locally even without source saving; draft deletion/retention controls are absent. Handoffs disclose only selected immutable payloads. A recipient may copy already received content; revocation controls future service retrieval. A running model may retain old context after a correction.

Opt-in adapters should capture the smallest approved fields. Full transcripts, unrelated projects, local files, provider secrets, and hidden model reasoning are excluded by default. Selected imported content remains untrusted data. Scanning, encryption-at-rest administration, user export, retention/deletion, and account lifecycle are hosted/adapter requirements where applicable, not features already delivered.

## 12 Reliability and scale

Atomic revision checks, corrections, and handoff deduplication protect recorded state. Context snapshots remain immutable and current access is checked on retrieval. Staleness currently compares work/project revisions; comprehensive cross-work dependency snapshot freshness is a separate planned gate.

Returned work/source/inbox/history pages and graph neighborhoods are bounded. Some internal database scans remain unbounded; this adapter is not a demonstrated large-scale design. The architecture has no fixed three-device limit, but measured capacity is separate from structural support.

The recorded local benchmark used 20 users, 60 registrations, 5 projects, 1,000 work items, 10,000 sources, and 10 concurrent HTTP clients. Each operation used 30 measured samples after one warmup. p95 was 362 ms for work listing, 393 ms for context assembly, and 117 ms for inbox metadata on the documented Mac. This excludes WAN, model inference, attachments, and complete dashboard bootstrap. See [benchmark](benchmark-results.json); do not infer hosted or physical Windows performance.

Before hosted release, define realistic source sizes, tenant/project distributions, concurrent writes, and recovery goals; migrate indexed storage and test them. For adapters, proposed targets are sub-second p95 deterministic preparation for ordinary bounded text and a two-second deadline before a visible fallback. These are design targets, not results or guaranteed host failure behavior.

## 13 Acceptance and release gates

Original AC01–AC13 are preserved, with gaps identified. [VALIDATION.md](VALIDATION.md) maps scenarios to evidence.

| ID | Scenario / required result | Evidence / gate |
| --- | --- | --- |
| AC01 | Fresh session resumes stable Work ID and current permitted state. | Local domain/SDK evidence; physical cross-client L1/L3. |
| AC02 | Private lookup/search/context/graph/chart/files reveal no unauthorized content/metadata. | Current surfaces tested; future exports must repeat checks. |
| AC03 | Selected handoff reveals selected content only. | Local store/HTTP evidence. |
| AC04 | Revoked grants/credentials/devices deny new controlled retrieval. | Local evidence. |
| AC05 | Two stale writers cannot silently overwrite. | Revision conflict tests. |
| AC06 | Corrected source preserves history and flags recorded dependents. | Transitive/private/cycle tests. |
| AC07 | Undersized budget fails rather than dropping mandatory context; omissions are permitted only. | UTF-8 complete-package tests. |
| AC08 | Identical handoff retry deduplicates; changed payload conflicts. | Local evidence. |
| AC09 | Restart preserves work/history/permissions/delivery state. | Store restart evidence. |
| AC10 | Graph/chart scope and empty/truncated state are understandable and permission-filtered. | Domain tests + browser review; accessibility audit pending. |
| AC11 | Real SDK discovery and authenticated workflow; errors stay structured. | HTTP and stdio evidence, 20 tools; real host L1. |
| AC12 | Mobile/desktop core journeys and keyboard interaction are usable. | 1440/375px review; formal accessibility audit pending. |
| AC13 | Measured workload/report has machine, samples, scope, p50/p95. | Local synthetic benchmark only. |
| AC14 | Explicit conversation capture cannot impersonate another contributor; native adapters deduplicate resume/turn events. | Explicit capture tested; native mapping L2. |
| AC15 | Exclusion changes current context, retains history, flags dependents, and restoration needs review. | Local evidence. |
| AC16 | Preparation preserves original and mandatory context, exposes additions/review information, prevents stale unauthorized save, and retains provenance. | Local domain checks cover preservation/privacy/freshness/save; semantic ambiguity handling and paired task-quality evaluation remain L2. |
| AC17 | Each claimed client route is tested with exact version/OS/auth, including failure/revocation. | Planned L1; official docs alone insufficient. |
| AC18 | Adapter timeout/unsupported host/ambiguous work produces visible fallback, with no false saved/synchronized claim. | Planned L2. |
| AC19 | Shared multi-machine deployment passes isolation, migration, backup restore, and concurrent-write checks. | Planned L3. |
| AC20 | All docs/config examples link correctly, tool catalog matches code, and current/planned labels are consistent. | Documentation validation. |

## 14 Delivery agenda

1. Maintain this requirements baseline and traceable documentation.
2. Certify explicit MCP workflows in real Codex, Cursor, and Claude Code clients.
3. Maintain the implemented personal local composer, original/provenance checks, and reviewed-save contract.
4. Evaluate representative tasks against the original/manual workflow before making quality or cost claims; design semantic assistance and native consent/mapping contracts separately.
5. Add one opt-in adapter at a time; verify native hook input/output and failure behavior.
6. Harden shared identity, indexed storage, team lifecycle, and restore; migrate while retaining IDs.
7. Test actual macOS/Windows collaborators against one hosted service.
8. Add scoped GitHub linkage after the collaboration foundation.

Detailed phase exit gates are in [ROADMAP.md](ROADMAP.md). Retention defaults, host versions, deployment operator/provider, and evaluator dataset remain decisions to make at their respective gates. The next implementation should not expand to autonomous execution before these core workflows are proven.

## 15 Change control

Use stable requirement IDs in work records, decisions, handoffs, and later PR descriptions. A project requirement change increments its baseline, flags affected work for review, and records who made the change. Document edits revise this baseline explicitly; they do not silently change every project's stored requirements.

Every claimed implementation improvement should name the requirement, observable behavior, validation, and remaining limits. Compatibility claims require exact client evidence. Improvements in accuracy, bias, or token cost require their own evaluations. See [official sources](SOURCES.md) and [implementation evidence](IMPLEMENTATION.md).
