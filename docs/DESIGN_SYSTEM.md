# Reusable interface design

Version 0.5 · 5 October 2026. The design uses a shared visual language for work, conversations, setup and prompt review. [PRD](PRD.md) contains the product constraints.

## Principles

Lead with the next useful action. Keep full identities copyable and technical details expandable. Use color for hierarchy and explicit recorded state; never imply that a client is connected or that a model answer is accurate from decoration.

Teal identifies ordinary actions and local setup. Violet identifies conversation continuity and prompt preparation. Amber/red remain reserved for review and errors. Client initial badges are text labels, not vendor logos or connectivity indicators.

## Shared building blocks

| Component | Intended reuse | Source |
| --- | --- | --- |
| `FeatureBanner` | Screen introduction, icon, short explanation and optional primary action. Violet/teal tone. | [ui.tsx](../src/ui.tsx) |
| `CopyField` | Labeled full ID, wrapping text and accessible copy button. | [ui.tsx](../src/ui.tsx) |
| `ClientBadge` | Compact client label; unknown values have a neutral fallback. | [ui.tsx](../src/ui.tsx) |
| `Panel`, `Empty`, `Modal`, `Status` | Containers, empty workflows, native dialog and readable recorded states. | [components.tsx](../src/components.tsx) |
| `ContextPreview` | Goals, constraints, next step, sources, corrections, omissions and complete JSON. | [workflow.tsx](../src/workflow.tsx) |
| `ConversationTracker` | Conversation identity/cards, attribution, pagination and start/resume instructions. | [Conversations.tsx](../src/Conversations.tsx) |

## Tokens and layout

[styles.css](../src/styles.css) defines shared `--teal`, `--teal-dark`, `--accent`, `--accent-soft`, `--muted`, `--line`, `--radius-card`, `--radius-control` and `--shadow-card`. Cards use an 18px radius, controls 10px, and soft shadows. Gradients sit behind introductory surfaces; content stays on quiet backgrounds.

Use the existing 8/12/16/18/22/24/28/32px spacing scale, readable system fonts, and consistent heading hierarchy. New screens should use existing primitives rather than duplicating container markup or inventing another palette. Domain validation and access remain server responsibilities.

At narrower widths, paired content/aside layouts become a single column. Mobile primary navigation keeps four destinations and a More menu; work tabs scroll within their strip. IDs wrap, setup choices stack, and continuation diagrams become vertical. Preserve privacy labels and review warnings at every width.

## Interaction and accessibility

Short entrance and hover/press transitions provide feedback; no continuous background animation is needed. The global `prefers-reduced-motion` override removes animation/transitions. Disabled actions need a visible reason; invalid laptop names suppress command copying. Native buttons/forms and explicit labels remain keyboard operable.

Screen names, IDs, warning text and source states are visible in addition to color. Full keyboard/screen-reader, contrast and motion certification remains pending; responsive spot checks do not establish complete accessibility.

## Visual review

Current sample screenshots: [dashboard](assets/dashboard-refined.jpg), [conversation tracking](assets/conversation-tracking.jpg), [laptop setup](assets/laptop-setup.jpg). Keep screenshots in `docs/assets/` and embed selected views in the root README. Refresh them after visible changes, use sample data, and keep credentials out of captures.
