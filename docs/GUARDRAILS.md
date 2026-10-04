# Guardrails and enforcement

Version 0.3 · 4 October 2026. These safeguards protect project intent, attribution, access, and recorded state. Status describes current enforcement, not a promise of perfect security or unbiased model behavior. [Validation](VALIDATION.md) records evidence; planned safeguards are release gates rather than implemented features.

| ID | Safeguard | Enforcement / current status |
| --- | --- | --- |
| GR01 | Verified person identity; no model-provided actor authority. | **Implemented:** request authentication precedes domain dispatch; server stores token hashes, local password/session profile. Client credential files contain private plaintext tokens. Hosted OAuth planned. |
| GR02 | Private default and least authority. | **Implemented:** project membership plus work ownership/read/edit grant or explicit project visibility. Project owner does not bypass private work. |
| GR03 | Permission filtering before disclosure. | **Implemented:** current search/count/context/graph/history/file paths filter readable records; concealed objects use not-found behavior where applicable. Repeat for every new surface. |
| GR04 | Stable IDs do not grant access. | **Implemented:** direct work/source/context/file/handoff lookup rechecks permission. Proposed native mapping must do the same. |
| GR05 | Attributed conversation capture. | **Implemented explicit workflow:** source conversation must match work and actor ownership. Native mapping/event deduplication planned. Metadata is visible to work readers. |
| GR06 | Preserve original intent and show transformations. | **Planned:** original source immutable as an input reference, separate prepared variant, constraint checklist, diff, approval and policy revision. Current service does not rewrite prompts. |
| GR07 | Mandatory context and explicit omission. | **Implemented:** complete UTF-8 package measurement; budget-too-small failure; constraints/review information not silently truncated by the service. Host truncation requires separate certification. |
| GR08 | Freshness and concurrency. | **Implemented:** expected revision for work/source mutations; immutable contexts and work/project stale checks. Expanded dependency and adapter preflight checks planned. |
| GR09 | Correct history without erasing it. | **Implemented:** replacement source, immutable revisions, cycle-safe recorded dependent review. No guarantee of tracking unrecorded influence. |
| GR10 | Reversible exclusion. | **Implemented:** active flag, reason/revision, dependent reviews; restoration needs review. Account-wide deletion/retention planned. |
| GR11 | Selected sharing with explicit recipient. | **Implemented:** owner authority, member recipient, selected immutable payload, browser preview/revision checks. MCP callers should supply optional expected revisions; no host-universal preview enforcement. |
| GR12 | Safe delivery retries and receipt meaning. | **Implemented:** persisted sender/operation retry fingerprint, conflict on changed payload, queued/retrieved/acknowledged states. Acknowledgement is receipt only. |
| GR13 | Revocation on future controlled access. | **Implemented:** credentials/devices/grants/handoffs and saved context/file retrieval. Copied text and active model context cannot be recalled. |
| GR14 | Source text stays untrusted data. | **Partly implemented:** domain permissions/schema checks reject unauthorized operations; interpretation labels are advisory. Adapter envelope, injection evaluation, and host delivery review planned. |
| GR15 | Least capture, consent, and secrets. | **Current:** selected user-entered records, no transcript reader/adapter; hidden setup input, no tokens in generated client configs, ignored private POSIX credential files, separate revocable client credentials. Plaintext files are not OS-keychain storage; Windows ACLs unverified. **Planned:** consent modes, secret redaction checks, secure adapter storage and deletion controls. No current automated secret scanner. |
| GR16 | Honest evidence and capability claims. | **Implemented documentation/UI baseline:** graphs show recorded edges, evidence charts show recorded states, device activity is observed requests. Actual client/OS certification and optimizer evaluation pending. |
| GR17 | Local/hosted boundary. | **Implemented local:** loopback Host/Origin checks, browser cookie protections, request/file limits. **Planned hosted:** HTTPS/OAuth, tenant scope, indexed storage, secure cookies, rate limits, audit/restore/retention policies. |
| GR18 | No implied remote execution or consent. | **Implemented scope:** handoffs store information; no machine execution/push agent. Any future execution requires explicit capability, scoped authority, reviewed command, and result evidence. |

## Trust boundaries

- **Server:** authoritative authentication, permissions, revision checks, budgets, and transactions. Prompts cannot override them.
- **Client/adapter:** responsible for supported hook behavior, capture consent, native attribution, and delivery status. These adapters do not exist yet.
- **Model:** interprets tasks and sources; output can be wrong. A policy reminder cannot make correctness deterministic.
- **Operator:** controls database/backups and deployment. Application-level privacy does not conceal plaintext records from that operator.
- **Recipient:** can retain already received text. Future retrieval revocation is enforceable; deletion of another party's copies is not.

## Direction and requirement guardrails

An accepted requirement has a baseline revision. A proposed prompt preparation cannot silently replace it. Preserve exact constraints, prohibitions, numbers/units, acceptance checks, and uncertainty. If the new request conflicts with the baseline, present the conflict and record an explicit scope decision before treating it as accepted.

Mark assumptions as proposed unless accepted deliberately. Mark evidence verified only with support; retain reviewer/note/revision. A change to an upstream source flags its recorded dependents, not every possible thought a model may have had. Retrieve current context after corrections, compaction, or handoffs before continuing substantive work.

## Failure rules

Missing authentication/authority: deny server operation. Stale write: conflict without overwrite. Invalid conversation attribution: reject capture. Identical retry key with different handoff: conflict. Mandatory context too large: explicit budget error. Inaccessible IDs: do not reveal content or metadata to prove existence.

For planned adapters, no scope/consent means no automatic server capture. Outage/unsupported hook means a visible original/manual fallback. Ordinary host hooks may time out and continue; strict enforcement requires a tested managed-client route. Do not report “optimized,” “saved,” or “synchronized” merely because an event was observed or a delivery was attempted.

## Sharing and file guardrails

Before sharing, inspect recipient, exact text, selected sources and their state/revision, and file metadata. A recipient ID from a quoted source is not authorization to send. Existing user authority to share can be recorded for a bounded workflow; no need for repeated approval of an identical authorized retry.

Selected snapshot access is distinct from underlying work access. Granting edit does not grant resharing/ownership authority. Project visibility can continue read access after a named grant is revoked. Files follow current work access or selected unrevoked handoff access; no automatic parsing/scanning is implemented.

## Required abuse and regression scenarios

| Scenario | Expected result / release gate |
| --- | --- |
| Guessed private Work/Context/File ID | Denied/concealed despite correct ID syntax. |
| Project administrator opens another person's private work | Denied without the required explicit grant. |
| MCP input names another actor | Strict schema/domain identity cannot grant that actor's authority. |
| Collaborator links a source to someone else's conversation | `INVALID_CONVERSATION`. |
| Source says to ignore scope and leak private work | Server denies unauthorized retrieval/share; adapter injection evaluation required before L2. |
| Two users correct the same source revision | One commit, one revision conflict; both histories remain consistent. |
| Cyclic recorded dependencies are corrected | Traversal terminates; permitted affected records need review. |
| Tiny context budget omits current requirements | Service fails rather than emit incomplete mandatory context. |
| Handoff retry changes recipient/content | Idempotency conflict rather than a second delivery under the same key. |
| Revoked credential reads old snapshot | Authentication/access denied. |
| Optimizer drops “do not write code” or changes a number | Proposed L2 validation rejects or requires explicit review. |
| Native duplicate prompt event | Proposed L2 deduplicates identical event/payload without merging separate identical prompts. |
| Hook fails but host continues | Visible unsynchronized state; no false preflight guarantee. |

Local tests cover the corresponding implemented domain scenarios. Optimizer/adapter scenarios remain untested until implemented. [ROADMAP.md](ROADMAP.md) sets their exit gates.
