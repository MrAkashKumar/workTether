# Delivery roadmap and agenda

Version 0.2 · 4 October 2026. Phases are ordered by dependencies, not promised dates. All future functionality below requires implementation and evidence. Read [PRD](PRD.md) for stable requirements and [validation](VALIDATION.md) for release checks.

## Phase 0 — Documentation and local foundation

**Current:** local prototype and recorded tests exist. This documentation revision defines BRD/PRD/FSD, diagrams, guardrails, client setup, and prompt identity/preparation architecture.

**Exit:** document links/config templates validate; current catalog matches 18 tools; all claims distinguish current, partial, planned, and certified. No active client configuration or runtime behavior changes are needed for this documentation phase.

## Phase 1 — Certify explicit client workflows

**Agenda:** run actual Codex, Cursor, and Claude Code versions against the same local service. Verify per-person identity and work access, explicit conversation capture, context, corrections, conflicts, selected delivery, and revocation. Document macOS evidence first, then real Windows evidence when a compatible service route is available.

**Deliverables:** exact client/version/OS matrix, redacted setup evidence, known limits, and instructions verified by someone other than their author where practical.

**Exit:** AC01/AC11/AC17 pass for each claimed host; no unauthorized data in the second-identity test. Unsupported host/surface stays explicitly unverified. Do not package an unreviewed third-party bridge merely to claim all Claude surfaces work.

## Phase 2A — Prepare prompts without automatic capture

**Agenda:** agree on original/prepared/consent records and versioned proposed contracts. Implement deterministic organization and current context assembly, a visible diff, acceptance/rejection, freshness checks, and provenance. Keep manual/tool invocation as the baseline.

**Deliverables:** prompt preparation panel, source/context revision linkage, bounded failure behavior, representative evaluation dataset, and results compared with original/manual workflow.

**Exit:** AC16 passes; originals and all mandatory constraints retained; uncertainty/conflict is not erased; no unsupported token/cost/accuracy claim. Optional model assistance is a later experiment requiring explicit consent and overhead measurement.

## Phase 2B — Opt-in native adapters

**Agenda:** implement one host adapter at a time. Add scoped native session/turn mappings, atomic idempotent capture, consent controls, installation identity, visible status, and supported context delivery. Test resume, fork, project change, event retry, revocation, and outage.

Start with the host whose real hook behavior is best validated in Phase 1. Codex and Claude Code provide documented prompt-submit context routes; Cursor needs its distinct submission/session capabilities respected. This is a capability-based choice, not a preferred-model claim.

**Exit:** AC14/AC18 pass for each adapter; actual hook timeout and host truncation behavior recorded. No automatic full-transcript capture. Strict preflight claims require a tested managed-client enforcement path.

## Phase 3 — Shared hosting and multi-machine pilot

**Agenda:** select operator/provider and production identity, then implement the [hosting sequence](HOSTING.md): HTTPS/OAuth, indexed database migration, private files, invitations/removal, session/credential lifecycle, retention/export policy, monitoring, and restore drills. Preserve stable IDs and baseline revisions.

**Deliverables:** staging deployment, migration/rollback report, per-person hosted credentials, two or more physical computers, recorded macOS/Windows client behavior, realistic concurrency/attachment/recovery measurements.

**Exit:** AC19 plus permission/conflict/idempotency/regression checks pass; backups restore; revoked membership and credentials cannot retrieve retained snapshots/files. Cloud-origin Claude route is tested independently from local adapters. No copying live SQLite files among machines.

## Phase 4 — GitHub linkage

**Agenda:** scoped GitHub App or reviewed connector, repository/project mapping, immutable commit/PR links, verified/deduplicated webhook events, and authorized result evidence.

**Exit:** repository permission does not grant private WorkTether access; a work result links to a specific commit and validation result; delivery retries cannot duplicate events. Git remains the code version history.

## Later candidates, subject to pilot value

- Lexical/semantic retrieval and graph-assisted expansion, evaluated against deterministic selection.
- Provenance-aware automatic summaries with dependency freshness and uncertainty checks.
- Embedded MCP Apps, notifications, or desktop packaging only for certified hosts.
- Additional evidence/latency/usage charts with defined sources and denominators.
- Offline support only after conflict/identity semantics are designed.
- Remote execution only with separately scoped authorization and observable results.

## How contributors should track implementation

Each work item should name the related BR/FR/AC/GR IDs, owner, next action, baseline revision, and evidence. Record a decision when scope changes. A later PR should identify concrete before/after behavior and validation, with repository/commit identity when GitHub linkage exists.

Prefer one phase outcome per work item. Keep unresolved claims visibly proposed. Update FSD and compatibility evidence alongside implementation. Documentation changes alone do not update a user's stored project baseline or grant consent to adapter capture.
