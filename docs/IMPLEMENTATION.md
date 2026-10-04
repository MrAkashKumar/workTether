# Local release implementation

Status: local prototype evidence, version 0.4 · 5 October 2026. Start with the [README agenda](../README.md), [PRD](PRD.md), [FSD](FSD.md), and [validation matrix](VALIDATION.md). Current local prompt preparation is documented in [PROMPT_BUILDER.md](PROMPT_BUILDER.md); native adapters and semantic assistance remain planned in [PROMPT_CONTEXT.md](PROMPT_CONTEXT.md).

The PRD preceded implementation. The release is a React/Vite dashboard, an Express loopback API, an official TypeScript SDK MCP endpoint, and a durable native SQLite domain store. A local stdio bridge now forwards the same 20 tools to authenticated HTTP, and the setup CLI generates Codex/Cursor/Claude Code configs plus a Claude Desktop entry. It uses local accounts and selected user-entered records. GitHub, public deployment, embedded MCP Apps and remote execution are later work.

## Core behavior

| PRD area | Implemented behavior |
| --- | --- |
| Identity and continuation | Service-generated IDs for projects, work, conversations, sources, contexts, connections and handoffs. Work identity survives ownership changes and service restarts. |
| Current requirements | Shared project baseline and immutable revisions. Baseline changes flag work and sources for review. Explicit acknowledgement does not clear outstanding source reviews. |
| Private access | Membership plus work ownership, read/edit grants or explicit project visibility. Project ownership does not bypass private-work rules. |
| Context | Complete compact-JSON UTF-8 budget, mandatory requirements/review information, explicit selection reasons/omissions and saved snapshots. Historical snapshots require current access and report staleness. |
| Corrections | New replacement source, superseded history, expected revision check, transitive recorded dependency flags, review note/reviewer/time. Reversible exclusions remove records from future active context. |
| Sharing | Selected immutable handoff snapshots and protected files, full selected-content preview with revision checks, scoped retry-key deduplication, retrieval and acknowledgement state, stale warnings and future-access revocation. |
| Workflow | Work creation, revision-checked updates, explicit read/edit sharing and ownership transfer with retained-access choice. |
| Dashboard | Simplified responsive Overview/Work/Handoffs/Connections navigation, secondary Dependencies/Activity/Project members, readable context, Prompt builder, source/history/sharing views, evidence-state chart, three-step setup and credential management. Vibrant accents and restrained motion support reduced-motion preference; no formal accessibility certification. |
| Prompt preparation | Personal verbatim-original drafts, locally projected current context, format selection, visible warnings/provenance, review-gated fresh copy and editor-only proposed-original source save. No external AI call. |
| MCP | Authenticated HTTP and stdio using official SDK packages, including prepare/get draft tools. One domain service for API and MCP permissions; no client-supplied actor IDs. |

## Verification evidence

Automated storage and HTTP/MCP tests cover authentication, credential/device revocation, private metadata/content filtering, protected file access, immutable revisions, concurrent conflicts, transitive corrections, review evidence, handoff deduplication/staleness/revocation, bounded context, restart recovery, pagination, cyclic/bounded graphs and identity continuation. The integration test connects the actual SDK client over HTTP; it is not a mocked tool call.

Earlier browser verification used the production build and sample data at 1440px and 375px widths: sign-in, permitted work, conversation creation, selected prompt capture, exclusion, work review evidence in immutable history, bounded context generation and reopening a saved context. The handoff preview displayed the selected recipient, full text, source content/state/revision and file metadata before sending; HTTP/MCP tests rejected stale work/source previews. Connection setup at 375px had no horizontal document overflow. Screenshots: [dashboard](assets/dashboard-local.jpg) and [mobile connection setup](assets/connections-mobile.jpg). Sample users/records are examples rather than other people's connected machines.

Latest automated verification: 24 tests passed, production build passed, and live HTTP/stdio MCP smoke checks each discovered 20 tools and retrieved an authenticated workspace. Added prompt tests cover original/projection retention, author privacy, permission/revision checks, reviewed save and non-nesting/idempotent behavior. See [validation](VALIDATION.md) for the current browser review and its limits. The HTTP integration check verified legacy SDK negotiation and the pinned 2026-07-28 protocol mode.

The [benchmark report](benchmark-results.json) records the machine, workload, sample count and latency. On the tested Apple M3 Pro / 18 GiB / Node 22.23.1, p95 latency with 10 concurrent clients was 362 ms for work listing, 393 ms for saved context assembly, and 117 ms for inbox metadata. Each operation had 30 measured requests after one warmup. It measures authenticated local API operations that share the MCP domain service. It excludes model inference, WAN latency, attachment traffic and complete dashboard bootstrap. It is not an unlimited-capacity or hosted-performance claim.

## Limits and next engineering work

- The JSON-record SQLite adapter performs scans. Pagination bounds returned records, not internal work. Replace it with indexed relational tables before large hosted deployments.
- Source relevance is limited to the selected Work ID, source state and recency. No semantic search, model reranker or learned accuracy/bias score is implemented. A source marked verified remains a user's recorded claim until its evidence is assessed.
- Conversations are explicit records and selected excerpts. Universal full-chat capture and automatic summary generation are not implemented. Summary records preserve source identity and dependencies when the author records them.
- Local prompt composition is implemented with fixed original/draft content, exact added-context inspection, browser review and explicit save assertion. Semantic rewriting/diffs, accept/reject registry, native host session mapping, and automatic capture adapters are absent. `clientReference` is an optional caller-supplied string. Conversation metadata is readable under work access; capture attribution requires the actor's own conversation. [INTEGRATIONS.md](INTEGRATIONS.md) documents official client routes without claiming real-client certification.
- Context snapshots retain exact packages. They can become stale; always retrieve current context before continuing actual work. Revocation blocks service retrieval, not previously copied content.
- The browser shows bounded source and handoff pages. Immutable history is a bounded latest workspace view; further revision offsets are available through API/MCP. Attachment listings are bounded metadata views. These limits are visible rather than presented as complete history.
- Activity shows the latest permitted events. The full local SQLite archive remains durable. Account-wide deletion, user export UI and configurable retention are not part of this local release.
- Local membership is added by registered email; invitations, removing members, password recovery, stronger session administration and production OAuth belong to hosting hardening.
- Device platform/client names are user-entered. Last observed activity records authenticated requests. This does not prove a client UI is connected, a machine is currently online, or an assistant is executing.
- Multiple-client behavior is tested with separate identities and HTTP clients on this Mac. Physical Windows machines and every third-party AI host have not been tested.
- There is one local workspace, with multiple projects/users. Organization-level tenancy, subscriptions and hosted operations are future work.
- Neither a huge context window nor this architecture guarantees correct or unbiased model behavior. The product makes requirements, selected context, revisions and evidence inspectable so users can correct direction.

## Conversation and laptop refinement

The Conversations work tab shows 50 records per page, client/laptop labels, author attribution, full-ID copy and distinct new-chat/resume instructions. A selected own conversation is visible across work tabs for new sources/drafts. Optional `client` and `machineName` fields are validated and retained with conversation records; missing labels on existing records stay unknown. Server ownership checks still control capture.

Setup now accepts `--machine-name` and validates safe command labels before provisioning. Each client gets a separately named registration and credential, with paths generated on the executing laptop. There is no hardware attestation or automatic conversation-to-registration binding. Shared UI primitives and tokens are described in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Setup/tracking instructions and screenshots are in the root README and new guides.

## Architecture boundaries

`server/store.ts` owns authorization, durable records, atomic changes and context selection. `server/index.ts` owns local HTTP authentication, trusted hosts/origins, request limits and protected downloads. `server/mcp.ts` exposes typed tools and maps domain errors into structured MCP results. `server/prompts.ts` provides the local versioned projection/composer; Store owns draft privacy/freshness and reviewed source saving. `src/` renders permitted responses and deliberate actions; it does not make authorization decisions for the server.

The relational adapter migration, OAuth deployment and real-client certification are concrete next steps in [HOSTING.md](HOSTING.md). The first hosted pilot should retain stable IDs and rerun the acceptance checks before adding autonomous execution.
