# Documentation change history

## 0.6 — 5 October 2026

- Added [deploy.md](deploy.md) with local installation, a private SSH shared-pilot procedure, public hosting implementation requirements, staging/migration/recovery and release gates, and personal hosted connections for Codex, Cursor, Claude and ChatGPT.
- Linked deployment prominently from the root README and related guides. Added the hosted architecture diagram and explicit start/resume/prompt preparation workflow.
- Clarified that the current runtime is loopback-only, static credentials are not hosted OAuth, HTTPS acceptance in the setup CLI is not hosted enrollment, and public hosting is separate from marketplace distribution.
- Corrected the hosting guide's stale statement about prompt preparation: explicit local preparation exists; native automatic capture/interception/delivery remain planned.
- Documentation-only revision. No runtime behavior or client configuration changed, no credentials activated and no service publicly deployed. Earlier application test/build evidence is retained; SSH/hosted/actual-client certification remains pending.

## 0.5 — 5 October 2026

- Added a dedicated Conversations view with supplied client/laptop labels, author attribution, full-ID copying, pagination and distinct start/resume instructions. Selected own conversation attribution remains visible across work tabs.
- Extended `create_conversation` with optional validated `client`/`machineName` fields; stable Work IDs and existing records remain compatible. Labels are not automatic native mapping or verified hardware identity.
- Added `--machine-name` and `--help` to laptop setup; each selected client retains a separate credential and local launch paths. Added label validation and attribution/persistence assertions to the existing tests.
- Added reusable banners, ID fields and client badges with shared design tokens, responsive layouts, richer introductory gradients and reduced-motion support.
- Added conversation tracking, laptop setup and design-system guides in `docs/`; embedded actual sample screenshots in the root README and rechecked official client documentation.
- Full suite remains 24 passing tests; production build passes. Actual client applications, physical Windows, automatic capture and hosted collaboration remain separate pending gates.

## 0.4 — 5 October 2026

- Simplified responsive navigation to Overview, Work, Handoffs, and Connections, with Dependencies, Activity, and Project members kept available. Added readable context, full-ID copying, clearer privacy labels, three-step client setup, vibrant accents, and restrained motion with reduced-motion support.
- Implemented personal local prompt drafts preserving original wording, response-format choices, authenticated current context, exact inspectable compact additions, method/provenance, warnings/corrections/omissions, and review-gated fresh manual copy. No external AI call or automatic submission.
- Added explicit editor-only reviewed save: the original request becomes a proposed source with provenance/dependencies; the full assembled draft stays personal, avoiding repeated context nesting. Saving advances the baseline and makes that draft historical.
- Added MCP `prepare_prompt` and `get_prepared_prompt`; current HTTP/stdio catalog has 20 tools. Listing/reviewed save are browser/API actions.
- Added three prompt-domain tests: 24 tests pass, production build passes, and live HTTP/stdio smoke checks each discover 20 tools and retrieve authenticated work.
- Rewrote the root README around quick start and actual setup; added the prompt builder guide and reconciled current/planned scope across product, contracts, architecture and guardrails. Actual-client certification, native adapters, semantic efficacy evaluation, retention controls and hosted/GitHub work remain pending.

## 0.3 — 4 October 2026

- Moved the entire application, dependencies, docs and preserved local data into `WorkTether/`.
- Put README.md at the WorkTether root per the updated requirement; detailed documentation remains in `docs/`.
- Added the authenticated local stdio bridge, shared workflow instructions, setup CLI, separate personal client credentials, and generated project configs for Codex/Cursor/Claude Code plus a Claude Desktop entry.
- Added four meaningful integration tests. Current suite: 21 passing tests; build and live HTTP/stdio smoke checks pass, each discovering 18 tools.
- Automatic prompt rewriting, native chat capture/mapping, hosted OAuth and real-client/physical Windows certification remain pending.

## 0.2 — 4 October 2026

- At this revision, moved the README and PRD into `docs/`; version 0.3 later returns README to the project root.
- Added the BRD, FSD, architecture diagrams, client integration guide, prompt/conversation design, guardrails, validation matrix, sources, and roadmap.
- Moved the environment template into `docs/examples/` and corrected the documented origin separator to commas, matching the server parser.
- Preserved FR01–FR20 and AC01–AC13 identifiers while distinguishing implemented, partial, and planned behavior.
- Added explicit requirements for Codex, Cursor, Claude Code, Claude Desktop/web, native chat mapping, prompt preparation, and client certification.
- Clarified that installing MCP does not automatically intercept prompts or map native chats. Current capture and retrieval are explicit.
- Documented local limits: one workspace, JSON-record scans, no hosted OAuth, no automatic optimizer/adapters, and no physical Windows/client certification.

## 0.1 — 4 October 2026

Initial PRD completed before implementation. The local application subsequently delivered stable work identity, private records, revisions, context snapshots, corrections, source exclusion, handoffs, browser UI, and an authenticated MCP endpoint. See [implementation evidence](IMPLEMENTATION.md).
