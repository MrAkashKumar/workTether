# Sources and claim boundaries

Official references checked 4 October 2026. Client behavior can change; recheck the relevant version before implementation or certification. URLs may redirect from earlier vendor documentation domains. These sources explain host/protocol capability, not proof that WorkTether integrations have been tested.

| Reference | Used for |
| --- | --- |
| [OpenAI MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) | Local Codex URL/Bearer configuration and executor scope. |
| [OpenAI hooks](https://learn.chatgpt.com/docs/hooks) | Native session/turn events, prompt-submit context, and local/cloud differences. |
| [Cursor MCP](https://prod.cursor.com/docs/mcp) | Configuration locations, URL/headers and environment interpolation. |
| [Cursor MCP help](https://prod.cursor.com/help/customization/mcp) | Setup, tool use and troubleshooting. |
| [Cursor hooks](https://prod.cursor.com/docs/hooks) | Session/conversation events, submission validation and initial context delivery. |
| [Claude Code MCP](https://code.claude.com/docs/en/mcp) | HTTP setup, header/environment expansion and scope. |
| [Claude Code hooks](https://code.claude.com/docs/en/hooks) | Session/prompt event behavior and context/timeout limitations. |
| [Claude Desktop local extensions](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) | Local extension packaging and setup route. |
| [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) | Cloud-origin connectivity and remote connector route. |
| [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) | Hosted authorization requirements; local static credentials are not production OAuth. |
| [Official SDK HTTP guidance](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md) | SDK transport implementation direction. |
| [Official SDK authorization guidance](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/authorization.md) | Authorization adapter direction; use resolved dependency version during implementation. |

- [Official SDK stdio guidance](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/stdio.md): serving the local bridge across protocol eras.
- [Official local Claude Desktop connection guide](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers): manual local server configuration.

## Implementation evidence

[Domain store](../server/store.ts), [HTTP service](../server/index.ts), [MCP catalog](../server/mcp.ts), [store tests](../tests/store.test.ts), [HTTP/MCP tests](../tests/server.test.ts), and [benchmark](benchmark-results.json) substantiate current behavior and its scope. [IMPLEMENTATION.md](IMPLEMENTATION.md) describes the verified local build.

## Design versus fact

Stable-ID lifecycle, prompt preparation contracts, consent UX, release gates, and shared deployment choices are WorkTether design proposals where marked planned. They are not claimed vendor features. Official hooks indicate a possible adapter route; they do not mean an adapter is installed or correct. Config syntax checks are not host certification.

The product name is provisional. Existing memory/coordination tools are alternatives to investigate in a separate, dated comparison; no uniqueness, competitor feature, model-window-growth, accuracy, bias, or cost-saving claim is established by this documentation revision.
