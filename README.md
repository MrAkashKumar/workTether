# WorkTether

WorkTether is a local project workspace and authenticated MCP service for continuing AI work across conversations, collaborators, and clients. Stable IDs connect requirements, work, selected prompts, decisions, evidence, context snapshots, and handoffs. Work is private by default; collaboration uses explicit grants or selected deliveries.

**Working name:** WorkTether. Name, domain, and trademark availability have not been established. **Documentation:** version 0.3, 4 October 2026. This README stays at the project root. Detailed project documentation lives in `docs/`.

## Clear agenda and reading order

1. Define the problem and success measures: [BRD](docs/BRD.md).
2. Agree on product scope, requirements, and release gates: [PRD](docs/PRD.md).
3. Review components, trust boundaries, and diagrams: [architecture](docs/ARCHITECTURE.md).
4. Review implemented behavior and proposed contracts: [FSD](docs/FSD.md).
5. Connect a client: [Codex, Cursor, and Claude integrations](docs/INTEGRATIONS.md).
6. Understand IDs and prompt preparation: [prompt and context lifecycle](docs/PROMPT_CONTEXT.md).
7. Review enforcement and remaining safeguards: [guardrails](docs/GUARDRAILS.md).
8. Check evidence and next steps: [validation](docs/VALIDATION.md), [implementation](docs/IMPLEMENTATION.md), [roadmap](docs/ROADMAP.md), and [shared hosting](docs/HOSTING.md).

[Sources](docs/SOURCES.md) records official references; [change history](docs/CHANGELOG.md) records documentation changes. BR, FR, AC, and GR identifiers provide precise references across people and clients.

## Current product and next design

The prototype provides a React dashboard, Express API, SQLite store, and 18 authenticated MCP tools through HTTP or a local stdio bridge. Implemented features include stable IDs, immutable revisions, bounded context snapshots, corrections, reversible source exclusions, protected attachments, and durable handoffs. Browser and MCP operations share domain permissions.

Context assembly selects current permitted records for a Work ID, preserving requirements and reporting omissions and warnings. This is context engineering. Prompt engineering still matters for instructions.

**Designed next:** opt-in native chat ID adapters and prompt preparation with an inspectable diff. These are not implemented. Connecting MCP does not automatically capture every prompt, rewrite it, obtain the host chat ID, or open the dashboard. Official setup routes are documented for Codex, Cursor, and Claude Code; real-client certification is pending. Claude Desktop/web have separate deployment requirements in the integration guide.

## Run locally

Requires Node.js 22.13 or newer with `node:sqlite`. The verified runtime was Node 22.23.1, which prints an experimental SQLite warning. Run from the `WorkTether` project root:

```sh
npm ci
npm run build
npm start
```

Open [the dashboard](http://127.0.0.1:4318). MCP endpoint: `http://127.0.0.1:4318/mcp`. The server binds to loopback. A second physical computer needs the later [shared deployment](docs/HOSTING.md).

For development, `npm run dev` runs the API on 4318 and Vite on 5173. Open `http://127.0.0.1:5173`. Rebuild and restart after production source changes.

A first empty database seeds `akash@worktether.local`, `maya@worktether.local`, and `ravi@worktether.local`, using sample password `worktether-local-2026`. These are examples; create an account/project for actual work. Set `WORKTETHER_SEED=false` with a **new** database path to start without samples. This does not remove existing data.

## Connect Codex, Cursor, or Claude

Keep `npm start` running. In the dashboard, sign in as yourself and create a WorkTether credential in **Connections**. In a second terminal, from the `WorkTether` folder, run:

```sh
npm run setup:mcp -- --client all
```

Paste that credential at the hidden prompt. Setup creates separate personal client registrations/credentials and these local configurations:

| Client | Generated configuration |
| --- | --- |
| Codex | `.codex/config.toml` |
| Cursor | `.cursor/mcp.json` |
| Claude Code | `.mcp.json` |
| Claude Desktop | `.worktether/claude-desktop-config.json` to merge into Desktop's local server config |

Open/trust this **WorkTether** folder in the client and reconnect MCP. Claude Desktop requires the separate merge/restart step in [the integration guide](docs/INTEGRATIONS.md). A single client can be selected with `--client codex`, `cursor`, `claude-code`, or `claude-desktop`.

Configurations are generated in this checkout, contain absolute local paths, and preserve other server entries. Personal tokens stay in ignored `.worktether/connections/` files with restricted permissions on POSIX systems. They are plaintext local credentials, not OS-keychain storage; Windows access depends on folder ACLs. Never share that directory. Setup refuses conflicting entries or existing credentials rather than replacing them silently.

The checked-out client configs were generated in **configuration-only** mode: they are ready for credential activation, not signed into an account. `--configure-only` can regenerate configuration templates without provisioning credentials. Direct HTTP remains available using the documented environment-based examples. Neither transport automatically intercepts prompts or maps native chat IDs.

## First useful workflow

1. Create an account/project and record the objective and shared requirements.
2. Create private work; keep its full Work ID for continuation.
3. Register a client/device in Connections and generate a personal MCP credential. Follow the [client setup guide](docs/INTEGRATIONS.md).
4. Explicitly create a WorkTether conversation for this work. Record selected prompts and sources under its Conversation ID.
5. Retrieve current context before continuing. Inspect revisions, warnings, omissions, and next action. Record progress with the expected revision.
6. Correct or exclude unsuitable sources by ID and revision; review recorded dependents.
7. Add a registered collaborator to the project, select a handoff recipient/content, preview it, and send. This does not grant all private work access or run their machine.

[Example continuation instruction](docs/examples/continuation-instruction.md) is a manual template, not an installed client policy.

## Configuration and storage

The server reads process environment; it does not load `.env` automatically. Supply settings through the shell or process manager.

The sanitized [local environment template](docs/examples/local.env.example) documents these values; copying it alone does not configure the running process.

| Variable | Default / purpose |
| --- | --- |
| `PORT` | `4318`; update client URLs and trusted origins if changed. |
| `WORKTETHER_DB` | `data/worktether.sqlite`, relative to the process working directory. |
| `WORKTETHER_SEED` | Enabled unless exactly `false`. |
| `WORKTETHER_ORIGINS` | **Comma-separated** trusted origins; defaults cover localhost and 127.0.0.1 on 4318 and 5173. |

Connections displays the default endpoint; use the configured URL for a custom port. Keep database files, WAL sidecars, credentials, and build output out of version control. Protected attachments accept text, Markdown, PDF, PNG, and JPEG up to 5 MiB each. They are not automatically parsed into context.

Use SQLite online backup or stop writes before copying the database. Copying only the main file during WAL writes can omit recent changes. Multiple machines should connect to one shared service rather than synchronize independent SQLite databases.

## Verification and limits

```sh
npm test
npm run build
npm run check:mcp
npm run check:stdio
```

Tests bind a local port. The smoke check needs a running server and creates/revokes a temporary credential without printing it. Set `WORKTETHER_EMAIL` and `WORKTETHER_PASSWORD` when samples are disabled. `npm run benchmark` uses an isolated temporary database and replaces [benchmark-results.json](docs/benchmark-results.json).

The latest application verification recorded 21 passing tests, a successful build, and 18 discovered tools. Documentation changes do not certify new client integrations. See [validation](docs/VALIDATION.md).

There is one local workspace with multiple users/projects. The JSON-record database scans records; large hosted capacity is unestablished. Graphs represent recorded dependencies and charts represent evidence states. Byte budgets measure context serialization, not model tokens. No guarantee of accuracy or absence of bias is made. GitHub, hosted OAuth, automatic capture/optimization, and remote execution remain future work.
