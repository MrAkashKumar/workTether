# Codex, Cursor, and Claude integrations

Version 0.4 · 5 October 2026; official references checked 4 October 2026. **Configuration documented is not client certification.** Current verification uses real SDK clients over HTTP and spawned stdio processes on this Mac. Setup generates local project configs; global installed-client settings have not been changed.

## 1 Compatibility and capability matrix

| Surface | Intended WorkTether route | Current evidence / gap |
| --- | --- | --- |
| Codex local CLI/IDE/desktop executor | HTTP + personal Bearer credential, or generated stdio bridge. | Official configuration route; actual host/version test pending. |
| Cursor local Agent | HTTP URL + personal header, or generated stdio bridge. | Official configuration route; actual host/version test pending. |
| Claude Code local | HTTP + personal header, or generated stdio bridge. | Official configuration route; actual host/version test pending. |
| Claude Desktop local connector | Generated local stdio bridge entry. | Bridge implemented and SDK-tested; Desktop UI test pending; no `.mcpb` package. |
| Claude web/Desktop/Cowork remote connector | Network-reachable shared MCP service and supported per-person authentication. | Hosted route planned; current loopback service cannot serve it. |
| Other MCP clients | Verify transport, auth, tool schema, limits, and workflow. | No blanket compatibility claim. |

The service currently offers **tools**, not MCP prompt templates, MCP resources, embedded Apps, hooks, push notifications, or automatic transcript capture. File uploading uses the browser/API; the MCP catalog can share selected existing attachment IDs but cannot upload arbitrary files itself.

## 2 Generated local setup — implemented

Start the dashboard/service. In **Connections**, select **Create setup credential** under step 1, then run `npm run setup:mcp -- --client all` from the WorkTether project root and paste that credential at the hidden prompt. Setup uses it to authenticate and provisions a distinct device/credential per selected client; no manual registration is required first. After successful setup, you may revoke the setup credential while retaining the separate client credentials. It never puts raw tokens in client config or console output.

Generated paths are `.codex/config.toml`, `.cursor/mcp.json`, `.mcp.json`, and `.worktether/claude-desktop-config.json`. They launch the same stdio bridge using absolute Node, loader, script, and credential-file paths. The bridge forwards tool discovery/calls to the authenticated shared local HTTP service; it does not create an independent database or bypass permissions.

Codex/Cursor/Claude Code read the applicable approved project config when this folder is opened/trusted. Claude Desktop needs the generated entry merged into its separate config. Global settings are not overwritten. Conflicting WorkTether entries and existing credential files require explicit review before replacement. Revoke the old client/device in Connections before deliberately removing old local credential/config entries and rerunning setup.

Credential files are ignored by Git and owner-readable on POSIX systems (0600 files, 0700 private directories). This is plaintext local storage; Windows permissions depend on ACLs and have not been physically tested. Do not copy another person's `.worktether` directory. `--configure-only` writes configs without credentials or active sign-in. The currently generated project configs are in that pending-activation state.

Use `--client codex|cursor|claude-code|claude-desktop` for one client, and `--url SERVICE_ORIGIN` for a configured local port. Tokens may alternatively come from `WORKTETHER_MCP_TOKEN`; a configured saved connection takes precedence over inherited environment values. Absolute generated paths must be reviewed/regenerated after moving the checkout or changing the Node installation. The HTTP service must remain running.

`npm run check:stdio` verifies the live bridge with a temporary revoked credential and another working directory. Tests also check pinned modern protocol negotiation, private access, stable conversation capture, conflicts, revocation, config preservation, and secret-free startup failures.

If setup fails after provisioning starts, it attempts to revoke its new connections and remove its new credential files. If cleanup also fails, follow the displayed recovery message: revoke the new client/device registrations in Connections and review local credential/config files before retrying. A connection label alone does not establish successful setup.

## 2A Direct HTTP setup

1. Start WorkTether using [README](../README.md).
2. Sign in as yourself. Register the client/device in Connections and generate its personal credential. It is revealed once.
3. Make `WORKTETHER_MCP_TOKEN` available securely to the **client process**, using the revealed token. A GUI app may not inherit a terminal's environment; use the client's supported launch/secret arrangement and verify it. Never put the token in a prompt, screenshot, committed config, or another person's installation.
4. Use `http://127.0.0.1:4318/mcp`, or the configured local port. Do not share this URL as if it identified a hosted service.
5. Add/merge the example into the client's configuration; do not overwrite other server entries. Restart/reconnect and verify discovery.

Configuration examples in [examples/](examples/) contain environment references, not credentials. They are templates, not automatically installed adapters.

## 3 Codex

For the local CLI/IDE configuration, merge [codex-mcp.example.toml](examples/codex-mcp.example.toml) into the applicable `~/.codex/config.toml` or approved project configuration. It uses `url` and `bearer_token_env_var`. Ensure the named environment variable is available to the executor. Use `codex mcp list` or `/mcp` to inspect availability. Desktop settings/configuration scope can vary with the active local or cloud executor; verify the installed surface. OAuth login is not the local static-credential flow. [Official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

Future adapter: documented local `UserPromptSubmit` hooks expose `session_id`, `turn_id`, and submitted prompt, and can add context or block. This requires separately installed/authorized hook behavior. Local and cloud orchestration support differs. Host output may spill or truncate large hook context; keep mandatory WorkTether information within tested host limits. [Official hooks](https://learn.chatgpt.com/docs/hooks).

## 4 Cursor

Merge [cursor-mcp.example.json](examples/cursor-mcp.example.json) into a personal `~/.cursor/mcp.json` or approved project `.cursor/mcp.json`. `url` selects the HTTP server; `headers.Authorization` uses `${env:WORKTETHER_MCP_TOKEN}` interpolation. Restart/reconnect and inspect MCP availability. Tool selection and approval remain host behavior. [Official MCP configuration](https://prod.cursor.com/docs/mcp).

Future adapter: documented hooks carry `conversation_id` and `generation_id`. `beforeSubmitPrompt` can observe the prompt and block submission; its documented output is not arbitrary replacement text. `sessionStart` can add initial context but runs without a blocking guarantee. Per-turn preparation therefore needs a supported delivery method or a visible manual fallback, rather than assuming this hook rewrites every prompt. [Official hooks](https://prod.cursor.com/docs/hooks).

## 5 Claude Code

Merge [claude-code-mcp.example.json](examples/claude-code-mcp.example.json) into an approved `.mcp.json` for the selected project. It uses `type: "http"`, `url`, and `headers.Authorization`. Claude Code supports `${WORKTETHER_MCP_TOKEN}` expansion; the variable must be available when the client starts. Missing variables may leave the literal reference unexpanded or empty, so verify authenticated discovery. Use `/mcp` and `claude mcp list` to inspect setup; user-scoped installation is also available through the client's documented commands. [Official MCP setup](https://code.claude.com/docs/en/mcp).

Future adapter: `UserPromptSubmit` receives a session ID and prompt and can add context or block. Some events also originate from automation/session messages, so capture must distinguish event provenance rather than attribute every event to typed human input. Hook timeout behavior differs by handler; a command/HTTP/MCP hook timeout can allow submission without its context. WorkTether must show missing synchronization and not promise strict preflight enforcement from installation alone. [Official hooks](https://code.claude.com/docs/en/hooks).

## 6 Claude Desktop and remote connectors

After local setup, merge the `mcpServers.worktether` entry from `.worktether/claude-desktop-config.json` into Claude Desktop's existing `claude_desktop_config.json`; preserve other entries. Use Settings → Developer → Edit Config, then fully restart Desktop. The typical paths are `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows. [Official local connection guide](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers).

The stdio bridge is implemented; an installable `.mcpb` extension is not packaged. The extension route remains a separate future convenience. [Official local extensions](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

Claude remote connectors originate from Anthropic's cloud even when used in Desktop/Cowork. The service must be reachable from that infrastructure; `127.0.0.1` on a laptop cannot be used. After the [hosting gate](HOSTING.md), configure the shared server URL through the remote connector settings and verify per-person authority. The current service is not ready for public exposure. [Official remote connector requirements](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## 7 What should happen after adding MCP

Successful discovery exposes the current 20 tools, including `prepare_prompt` and `get_prepared_prompt`. Explicitly request `workspace_overview`, select a permitted project/work, and run the workflow in [PROMPT_CONTEXT.md](PROMPT_CONTEXT.md). Open the browser dashboard deliberately to inspect records and connections. Its **Prompt builder** prepares original-preserving local drafts for manual review/copy. An authorized client can also call `prepare_prompt` explicitly and retrieve its own draft; this is tool execution, not a prompt-submit hook. Browser/API-only reviewed save creates a proposed source. See [the guide](PROMPT_BUILDER.md).

There are three separate claims to verify: the server is reachable, a credential authenticates the right person, and a tool returns the right permitted work. A green host indicator or a device label alone does not prove all three. Last observed activity means an authenticated service request, not a live machine heartbeat.

## 8 Certification checklist

For **each** claimed client, record exact name/version, OS/version, local/cloud executor, transport, auth/config scope, tool discovery, actual returned principal, continuation, conversation creation, correction/exclusion, revision conflict, selected handoff, credential revocation, host output limits, and setup/failure screenshots without secrets. Record unsupported operations separately.

The first explicit-workflow test should create a private work item, then demonstrate that a second identity cannot retrieve it. Native ID mapping and automatic delivery require additional adapter tests; passing MCP discovery does not pass those gates. Local preparation has domain tests, but its actual use within each claimed client still needs certification and task-quality evaluation. Windows and macOS need physical tests before broad OS support claims.

## 9 Troubleshooting

| Symptom | Check / action |
| --- | --- |
| Connection refused | Server running, correct port, executor on the same machine; cloud loopback mismatch. |
| 401 | Correct token available to the client process, exact Bearer header, credential/device not revoked. |
| 403 host/origin | Use the trusted local host/origin; check configuration rather than disabling protection. |
| Tools discovered but not used | Ask for the explicit workflow; check host tool enablement/approval. |
| Native chat ID absent | Expected with MCP alone; use explicit Conversation ID until an adapter is implemented. |
| Prompt not automatically prepared | Expected: use the browser Prompt builder or explicitly call `prepare_prompt`; MCP does not intercept submissions. |
| Prepared draft stale | Work/requirements changed, including after source save; prepare a new draft. |
| Prepared draft not found | Check your own Prompt ID and current work access; another author’s draft stays private. |
| Revision conflict | Retrieve latest state, compare changes, then resubmit deliberately. |
| Context cannot fit | Increase the byte budget within limits or deliberately simplify the shared baseline; do not silently drop constraints. |

## 10 Multiple people and machines

After hosting, every person connects to the same service URL with their own identity and client registration. Work IDs remain stable. Membership does not expose private work, and machine identity does not grant authority. To send information, select the project recipient and handoff payload; to edit underlying work, the owner separately grants access. GitHub integration is later and has its own repository authority. Never reuse a single shared administrative credential to simulate collaboration.
