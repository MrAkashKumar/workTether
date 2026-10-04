# Architecture and diagrams

Version 0.3 · 4 October 2026. Diagrams describe the current local service or explicitly labeled future components. Requirements are in [PRD](PRD.md); contracts are in [FSD](FSD.md). Mermaid source stays inside these documents for review and versioning.

## D1 — Current local architecture

**Why needed:** show where identity and permissions are enforced, and why changing AI clients should not change project rules.

```mermaid
flowchart LR
  B[Browser dashboard] -->|Session cookie| H[Loopback HTTP API]
  C[Compatible local AI client] -->|Personal Bearer credential| M[Streamable HTTP MCP adapter]
  L[Client launching a local process] --> T[Authenticated stdio bridge]
  T -->|Personal credential and same service| M
  H --> D[Authenticated domain service]
  M --> D
  D --> A[Membership and work access checks]
  A --> R[Revision and context operations]
  R --> S[(SQLite JSON records and WAL)]
  R --> Q[Saved context and selected handoffs]
```

The browser is presentation, not the authority. MCP dispatches the same domain operations. Local files and the SQLite database are trusted operator resources. Source/handoff text remains untrusted content. The stdio bridge is a transport adapter, not native chat capture. No native chat adapter or prompt optimizer is present in D1.

## D2 — Explicit MCP continuation today

**Why needed:** demonstrate what happens after connection and which steps actually create conversation identity.

```mermaid
sequenceDiagram
  actor U as Person
  participant C as AI client
  participant M as WorkTether MCP
  participant D as Domain store
  U->>C: Select project and Work ID
  C->>M: workspace_overview / list_work
  M->>D: Check authenticated access
  D-->>C: Permitted records
  U->>C: Start a WorkTether conversation
  C->>M: create_conversation(workId, title)
  D-->>C: Conversation ID
  C->>M: record_source(selected prompt, conversationId)
  D-->>C: Source ID and revision
  C->>M: get_work_context(workId, budgetBytes)
  D-->>C: Context ID, current revisions, warnings
  U->>C: Continue and review result
  C->>M: record_progress(expectedRevision)
  alt Revision remains current
    D-->>C: Updated work revision
  else Another change committed
    D-->>C: Conflict; retrieve and reconcile
  end
```

Tool invocation depends on the client and the person's workflow. Merely adding the server does not trigger all these calls or capture all prompts.

## D3 — Identity model

**Why needed:** distinguish durable work, conversations, sources, and client transport connections, so a new chat does not become a new project by accident.

```mermaid
erDiagram
  PROJECT ||--o{ WORK : contains
  USER ||--o{ WORK : owns
  WORK ||--o{ CONVERSATION : continues_in
  USER ||--o{ CONVERSATION : authors
  CONVERSATION |o--o{ SOURCE : attributes
  WORK ||--o{ SOURCE : records
  WORK ||--o{ CONTEXT : snapshots
  WORK ||--o{ HANDOFF : selected_delivery
  USER ||--o{ DEVICE : registers
  DEVICE ||--o{ CREDENTIAL : authenticates
  SOURCE ||--o{ REVISION : preserves
```

Sources may omit conversation linkage today. Conversation metadata follows work read access, while recording against a conversation requires its owner attribution. Native session mappings are proposed separate records scoped by deployment, person, integration, and native session identity. An MCP transport session ID is not included as durable work identity.

## D4 — Prompt preparation target, L2

**Why needed:** make the missing adapter visible and keep the original request separate from a prepared proposal.

```mermaid
flowchart TD
  P[Original user prompt] --> O[Explicit opt-in adapter or manual preparation]
  O --> X{Approved project and work selected?}
  X -->|No| F[Visible selection or original-prompt fallback]
  X -->|Yes| N[Bind native session and capture selected turn]
  N --> A[Authorize and retrieve current context]
  A --> R[Preserve constraints and provenance]
  R --> T[Proposed preparation with diff and warnings]
  T --> U{Accept or approved bounded mode?}
  U -->|Reject| F
  U -->|Accept| V{Host supports delivery method?}
  V -->|Yes| H[Add context or submit reviewed text using supported API]
  V -->|No| K[Manual preview and copy]
  H --> E[Record delivery state and work outcome]
  K --> E
```

Every node beyond the manual/current context path is proposed. Capture, preparation, and execution are distinct decisions. Hooks that accept context are not assumed to permit arbitrary prompt replacement. Failure handling must follow actual host behavior, documented in [integrations](INTEGRATIONS.md).

## D5 — Correction and delivery lifecycle

**Why needed:** show why deleting a mistaken prompt is insufficient, and why receipt does not mean work completion.

```mermaid
flowchart LR
  S[Current source] -->|Correction with revision and reason| N[New replacement source]
  S --> H[Superseded immutable history]
  N --> R[Recorded dependents need review]
  R --> C[New context includes review information]
  W[Selected work and content] --> P[Exact recipient and payload preview]
  P --> Q[Queued immutable handoff]
  Q --> T[Retrieved by recipient]
  T --> A[Acknowledged receipt]
  Q --> V[Revoked future retrieval]
  T --> V
  A --> V
```

Recorded edges determine review propagation. Already copied handoff/context text cannot be withdrawn from another model or person. Handoff staleness and review warnings complement the retained payload.

## D6 — Shared hosting target, L3

**Why needed:** explain collaboration across many machines without peer-to-peer credentials or database-file synchronization.

```mermaid
flowchart LR
  A[Person A - macOS - Codex] -->|HTTPS and own identity| G[Shared API and MCP gateway]
  B[Person B - Windows - Cursor] -->|HTTPS and own identity| G
  C[Other people and Claude clients] -->|Verified client route| G
  U[Browser dashboard] --> G
  G --> I[Production identity and scoped authorization]
  I --> D[Shared domain service]
  D --> R[(Indexed shared database)]
  D --> F[Private file storage]
  D --> Q[Durable handoff inbox]
  D --> E[Audit and recovery]
```

Every request is attributed to a person. Work grants and selected deliveries remain distinct. Cloud-origin clients need a network-reachable verified route; local 127.0.0.1 cannot be reused as a shared endpoint. [HOSTING.md](HOSTING.md) defines migration and deployment gates.

## UI and chart interpretation

The [current dashboard](assets/dashboard-local.jpg) and [mobile connections view](assets/connections-mobile.jpg) show the implemented UI using sample data. The [dashboard concept](assets/dashboard-concept.png) and [connection concept](assets/connection-concept.png) are design references, not observed connected machines.

![Local WorkTether dashboard with sample project records](assets/dashboard-local.jpg)

The evidence chart counts readable current project records in explicit evidence states. It measures recorded evidence state, not model accuracy. The graph is a bounded recorded neighborhood: current limits are 80 nodes and 160 edges. A readable relationship list complements the visualization. Future prompt preparation should add an original/proposed diff and visible capture/mapping status rather than an unexplained optimization score.

## Architecture decisions

| Decision | Reason / tradeoff |
| --- | --- |
| One shared authoritative service | Stable identity and consistent access; operator availability becomes a dependency. |
| MCP plus browser | Broad tool access with a consistent full UI; host-specific capabilities still differ. |
| Explicit capture first | Less accidental collection; more deliberate user effort until adapters prove useful. |
| Immutable snapshots and revisions | Reviewable state and safe conflict handling; archive storage grows. |
| Bounded deterministic context | Inspectable selection and preserved constraints; weaker relevance than a proven semantic retriever. |
| Local SQLite prototype | Simple durable start; JSON scans need replacement before large hosted use. |
| Git separate from context history | Code remains in repository versions; future links connect intent to commits without replacing Git. |
