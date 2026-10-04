# Business Requirements Document

Version 0.4 · 5 October 2026 · Proposed business baseline, reconciled with the local prototype. Read the [README agenda](../README.md) first; [PRD](PRD.md) defines product scope and [FSD](FSD.md) defines behavior.

## 1 Business problem

Project intent, decisions, evidence, and progress are scattered across chats and machines. A wrong assumption can survive multiple summaries. A collaborator can continue against outdated requirements. A fresh chat can lose the reason for a decision. More available context makes larger archives usable but does not establish relevance, freshness, correctness, or authorization.

The user's examples of 10M or 100M tokens are hypothetical planning scenarios, not predictions or claims about supported model windows. WorkTether should preserve a durable archive while selecting a small current working set for each objective, regardless of how large a future host window becomes.

## 2 Business outcome

An authorized contributor should resume a stable Work ID, understand the current requirement baseline and outstanding reviews, identify evidence behind important decisions, and continue without rebuilding the whole conversation history. Teams should share exactly selected context across clients and machines while preserving individual privacy.

The product is a context and collaboration service with an MCP interface. It is not an accuracy guarantee. The initial business hypothesis is that explicit state and traceable context reduce avoidable reconstruction and outdated-requirement errors; this must be evaluated in a pilot.

## 3 Stakeholders

| Stakeholder | Responsibility / value |
| --- | --- |
| Contributor | Own private work, review captured records, continue using stable IDs. |
| Project owner | Maintain shared requirements and membership; resolve scope changes. |
| Collaborator | Receive selected handoffs or granted work access; record results with attribution. |
| Deployment operator | Run the service, protect storage, restore backups, and manage operational access. |
| Integration maintainer | Verify each client/version and document supported capabilities. |

People authenticate; devices label connections. An operator controlling database files can access stored content. Application privacy between contributors does not constitute encryption against that operator.

## 4 Business requirements

| ID | Requirement | Product mapping |
| --- | --- | --- |
| BR01 | Preserve continuity across chats and machines using stable work identity. | FR03, FR04, FR19, FR21 |
| BR02 | Keep personal work private and make sharing deliberate. | FR01, FR02, FR07, FR08, FR18 |
| BR03 | Identify and correct outdated, irrelevant, or wrong recorded information. | FR05, FR06, FR10, FR22 |
| BR04 | Make progress and evidence inspectable without misleading accuracy scores. | FR11, FR12, FR17, FR20 |
| BR05 | Connect Codex, Cursor, and Claude clients through documented MCP routes. | FR14, FR15, FR16, FR24 |
| BR06 | Prepare useful context and prompts while preserving exact user intent. | FR06, FR23, FR25 |
| BR07 | Attribute contributions to the authenticated person across devices. | FR01, FR13, FR17, FR21 |
| BR08 | Support many users/devices without assuming three machines or copying databases. | FR09, FR19, FR26 |
| BR09 | Link later code outcomes to GitHub while retaining separate context history. | FR28 |
| BR10 | Explain deployment, limits, guardrails, and evidence in `docs/`, with the agenda in the root README. | FR24, FR26, FR27, FR29 |

## 5 Scope and rollout

The local foundation delivers deliberate context retrieval, selected source capture, privacy, revisions, and handoffs on one machine. Inspectable local prompt preparation now preserves the original request, adds permitted project context, and requires browser review before copy or source save. A client pilot then verifies real Codex, Cursor, and Claude versions and evaluates preparation quality. Optional semantic assistance and opt-in adapters follow separate evaluation and consent work. Shared hosting follows identity, storage, team lifecycle, and recovery work. GitHub follows the core collaboration workflow.

The same service implementation can support many registered clients; each person's credential retains their own permissions. A shared server installation does not imply a shared credential, all-project access, or authority over another laptop.

## 6 Success measures and evidence

| Measure | Method | Initial decision rule |
| --- | --- | --- |
| Continuation completeness | Replay tasks in a fresh chat; check current constraints, next action, and source references. | All mandatory task constraints retained in the agreed test set. |
| Unauthorized disclosure | Adversarial user/project/ID/attachment tests. | Zero observed unauthorized results in release checks; do not generalize to proof of no vulnerabilities. |
| Correction recovery | Correct an upstream source and inspect recorded dependents and new context. | Required review flags appear; superseded material is not presented as current. |
| Reconstruction effort | Compare timed continuation with ordinary transcript/manual-summary workflow. | Publish measured difference; no benefit claim before a pilot. |
| Prompt preparation quality | Paired runs with identical tasks/model settings and blinded assessment where practical. | No material constraint loss; fewer bytes alone is insufficient. |
| Collaboration reliability | Retry deliveries, test conflicting updates, revoke access, restart storage. | No lost accepted writes or duplicate identical-key handoffs in the test scenarios. |
| Service latency | Record p50/p95 and workload/machine/client scope. | Investigate p95 over 2 seconds for the documented ordinary local text workload. |

Commercial pricing, market size, willingness to pay, and hosted capacity are unvalidated. No financial forecast is part of this baseline.

## 7 Risks and alternatives

| Risk / alternative | Response |
| --- | --- |
| Native client memories or Git-managed notes already meet the user's need. | Pilot against those simpler alternatives; do not claim unique invention. |
| Additional capture/selection steps create more work than they save. | Start with selected records and one clear continuation action; measure burden. |
| Prompt rewriting changes intent or removes uncertainty. | Current local preparation keeps original text and exposes additions. Any future semantic rewrite needs a diff, evaluation, and explicit review. |
| Summaries repeat a wrong claim. | Require provenance and review state; corrections invalidate recorded dependents. |
| A host does not invoke tools or support interception. | Offer explicit retrieval/copy workflow; advertise adapter support only after certification. |
| Sharing/transcripts disclose personal or repository secrets. | Private defaults, preview, least capture, explicit consent, and revocation. |
| Hosted scaling exceeds the prototype database design. | Migrate to indexed storage and measure workload before capacity promises. |

## 8 Decisions and open questions

Confirmed: local first; later shared hosting; many people/machines; Codex/Cursor/Claude targets; stable identities; private default; selected sharing; GitHub later; detailed documentation in `docs/` and README at the WorkTether root.

Proposed: one authoritative shared service, explicit retrieval as the universal fallback, deterministic context assembly before optional model-assisted preparation, and opt-in client adapters.

Before a hosted pilot, choose the hosting operator, identity provider, retention policy, supported client versions, and user consent UX. Before any optimizer claim, define representative tasks and evaluators. These are recorded decisions for later stages, not reasons to stop local documentation work.
