# Validation and requirement traceability

Version 0.4 · 5 October 2026. Evidence below is the current application verification from this local build. This release adds simpler responsive navigation, readable context, and local prompt preparation. Protocol/setup tests do not certify actual third-party host UIs, hooks, or semantic prompt quality.

## Evidence summary

| Evidence | Recorded result / scope |
| --- | --- |
| [Store tests](../tests/store.test.ts) | 19 tests: identity, permissions, revisions, correction/review, handoffs, budgets, pagination/graphs, explicit conversations, snapshots, exclusion, personal prompt preservation/provenance/freshness and reviewed original-only source save. |
| [HTTP/MCP test](../tests/server.test.ts) | 1 integration test uses actual HTTP and SDK client; identity/origin/revocation/handoff behavior, legacy negotiation and pinned newer protocol mode. |
| [Integration tests](../tests/integrations.test.ts) | 4 tests: safe config generation, separate personal credentials and interrupted setup recovery, real stdio process across protocol modes, personal prompt preparation/retrieval/privacy, revocation, and secret-free failure. |
| Complete suite | 24 tests passed; zero failed. Original whitespace/Unicode, compact context, warnings, rollback on mandatory-budget failure, stale/access checks, save replay, and restart persistence are covered. |
| Production build | TypeScript and Vite build passed during application verification. |
| [Live MCP smoke](../scripts/check-mcp.ts) | HTTP and stdio each discovered 20 tools and an authenticated workspace; temporary credentials revoked. |
| Browser review | 1440px desktop and 375px mobile: overview, prompt preparation, review gate, invalidation after input edits, mobile More menu, client selector/command and setup form. Checked page widths matched viewport widths. No captured warning/error console entries. Not a full accessibility audit. |
| Visual evidence | [Overview](assets/dashboard-refined.jpg), [Prompt builder](assets/prompt-builder-local.jpg), [mobile Connections](assets/connections-refined-mobile.jpg). Images contain sample project data. |
| [Local benchmark](benchmark-results.json) | 4 October 2026; synthetic local authenticated HTTP, 10 concurrent clients, 30 measured samples per operation. |

Sample accounts and client/device labels are data fixtures, not actual other connected physical machines. No real Codex/Cursor/Claude host or physical Windows certification is recorded. Graph/byte/evidence-state results are not model accuracy or bias evaluations.

## Requirement-to-evidence map

| Requirements / acceptance | Existing evidence | Remaining gap |
| --- | --- | --- |
| FR01/02/07/18; AC02/04; GR01–04/13 | Session/credential/device revocation tests; private metadata/content/file/context/graph filtering. | Hosted tenancy, member removal, export and broader security review. |
| FR03/04/15/19; AC01/05/09; GR08 | Stable ownership transfer, immutable revisions, stale writes, restart, shared domain dispatch. | Physical multi-machine continuation and hosted adapter recovery. |
| FR05/21; AC14; GR05 | Explicit conversation IDs, same-work/actor capture validation, dependency-linked selected summaries. | Native mapping uniqueness and event deduplication; automatic capture/summarization. |
| FR06; AC07; GR07 | Complete UTF-8 package tests, mandatory-budget failure, immutable context/stale/access tests. | Host request/token/truncation behavior; semantic relevance evaluation. |
| FR08/09; AC03/08; GR11/12 | Selected immutable payloads, retry conflict/deduplication, staleness/revocation, protected selected files; UI preview. | Actual host preview/delivery workflows and WAN reliability. |
| FR10/22; AC06/15; GR09/10 | Transitive/private correction review, concurrent corrections, preserved review evidence, exclusion/restoration. | Unrecorded dependency discovery is not promised; expanded freshness scope needs design. |
| FR11/12; AC10; GR16 | Permitted bounded cyclic graph tests, evidence counts across work pages; UI review. | Formal accessibility and future chart semantics. |
| FR13/14/16/24; AC11/17; GR16/17 | Personal registrations/revocation, actual SDK HTTP test, 20-tool HTTP/stdio smoke, official setup references. | Exact third-party versions/OS/executor certification. |
| FR17/20; AC12 | Review/audit history, responsive browser workflow and screenshots. | Formal keyboard/screen-reader audit and hosted audit administration. |
| FR23/25; AC16/18; GR06/14/15 | Local preparation: verbatim originals, private drafts, compact context/full snapshot provenance, review-gated browser copy and explicit original-only proposed-source save; API/MCP permission and baseline freshness checks. | Native capture/consent/adapters, semantic rewriting/diff, secret scanning, injection and paired-quality evaluation. |
| FR26/27; AC19; GR17 | Hosting architecture/migration plan only. | Production identity/storage/lifecycle/restore and real machines. |
| FR28 | GitHub design boundary only. | Authorized App/connector implementation and events. |
| FR29; AC20 | Documentation set and configuration templates. | Keep link/schema/status validation current with each change. |

## Benchmark interpretation

Measured machine: Apple M3 Pro, 11 logical CPUs, 18 GiB RAM, Node 22.23.1, macOS/arm64. Workload: 20 users, 60 device records, 5 projects, 1,000 works, 10,000 sources, 100 handoffs, 10 concurrent clients.

| Operation | p50 | p95 |
| --- | --- | --- |
| Permitted work list | 357 ms | 362 ms |
| Saved context assembly | 385 ms | 393 ms |
| Inbox metadata | 117 ms | 117 ms |

Excluded: model inference, WAN, attachments, complete dashboard bootstrap, physical OS compatibility. One warmup preceded 30 measured requests per operation. These observations do not establish unlimited capacity or hosted performance. The prototype's JSON scans are a known scaling limit.

## Reproduction

From the repository root:

```sh
npm test
npm run build
npm run check:mcp
npm run check:stdio
```

The smoke check requires the running server and an available account; see [README](../README.md). `npm run benchmark` uses a temporary database and replaces the recorded benchmark artifact, so run it only when intentionally collecting a new result.

For documentation changes, check relative links, Markdown structure, JSON/TOML example parsing, requirement references, and exact catalog/schema consistency. Do not regenerate benchmark results or imply new application verification for a prose-only change. No new application tests are needed unless behavior changes or a discovered concern justifies them.

The current documentation/configuration check is recorded in [documentation-validation.json](documentation-validation.json), alongside the application verification evidence. It checks files/configuration syntax and catalog consistency; it does not render every Mermaid diagram or run real-client certification. The earlier benchmark has been preserved.

Entrance and hover transitions have a CSS reduced-motion override. This implementation check is not a formal animation/accessibility certification. Prompt freshness compares current work/project revisions; it is not comprehensive freshness detection for every external dependency. Local preparation is deterministic composition, without external AI calls, and has not been shown to improve model accuracy, bias, latency, or token cost.

## Client certification record template

Record client/version; OS/version; local/cloud executor; config scope; transport/auth; tested principal; tool count; work/context/conversation IDs without secrets; permission/conflict/correction/handoff/revocation results; unsupported operations; output/truncation limits; failure behavior; tester/date; redacted evidence path.

Do not mark a row passed because the official client docs support HTTP. Test the actual WorkTether workflow in that client. Native adapter certification separately tests session resume/fork, event attribution/idempotency, consent, timeout, host delivery, and large output. [ROADMAP.md](ROADMAP.md) names exit gates.
