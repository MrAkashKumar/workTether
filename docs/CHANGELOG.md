# Documentation change history

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
