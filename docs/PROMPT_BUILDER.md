# Local prompt builder

Version 0.4 · 5 October 2026. This guide describes the implemented browser/API composer and its two MCP tools. It is distinct from planned native chat adapters and optional external AI rewriting. Start with the [README](../README.md); contracts are in [FSD](FSD.md).

## What preparation does

WorkTether keeps the original request exactly as submitted and adds a response-format instruction plus a compact projection of a current authorized context snapshot. The generated text contains work/project goals and requirements, next action, selected sources and revisions, warnings, corrections, and omission information. The composition method is `worktether-local-2`.

The projection removes repeated internal source fields while keeping source IDs, revisions, kind, title/content, status, author, optional conversation, and selection reason. The full context snapshot remains stored separately. The UI exposes the exact context added to the prepared text.

There is no external model call, semantic rewrite, automatic delivery, or factual verification. Format options are **Follow my request**, **Step-by-step plan**, **Review and findings**, and **Plain-language explanation**. The default follows the original request. The plan option explicitly avoids implementation unless the original asks for it.

Preparation can make relevant recorded state easier to inspect. It has not demonstrated improved model accuracy, reduced bias, or token savings. Added context increases the full prompt size; useful preparation is not necessarily shorter.

## Use it in the dashboard

1. Open a work item you can read and select **Prompt builder**. An optional selected Conversation ID must belong to you and that work.
2. Enter the request, up to 20,000 characters. Leading/trailing whitespace and wording are preserved; blank-only requests are rejected.
3. Choose a response format and select **Prepare prompt**. This persists a personal draft and its exact context in the local database.
4. Inspect **Your request is unchanged. We added**, expand the project context, and read the complete prepared text. Check warnings, corrections, omitted sources, Work/requirements revisions, and the Prompt/Context IDs.
5. Confirm **I reviewed my request, the added context, and any warnings**. **Copy prepared prompt** re-fetches the draft with current authorization and checks freshness before copying. Paste it into the client you choose.
6. If you have edit permission, choose **Save request to sources** to record the original request as a proposed source. The full composed prompt remains a separate personal draft.

Changing input or response format invalidates the preview. Work, requirement-revision, or conversation-selection changes also clear the current draft view and review confirmation. **Your recent drafts** shows the latest ten for this person/work; opening one checks current access and displays its historical baseline.

The original input and added-context panels make additions inspectable. The current feature does not calculate changed-word spans, semantically classify ambiguities, edit generated text, or maintain a separate accept/reject decision registry.

## Identity, visibility, and saving

| Record | Purpose and access |
| --- | --- |
| `pmt_<uuid>` | Personal prepared draft. Only its authenticated author can list/retrieve it, and current work read access is still required. Original request, composed text, method, format, and context baseline remain fixed. |
| `ctx_<uuid>` | Exact saved context selection. Existing context retrieval follows current work permissions; it is not the personal prompt draft. |
| `src_<uuid>` after explicit save | Original request saved as kind `prompt`, state `proposed`. This source follows normal work permissions, so other authorized work readers may read it. |
| `conv_<uuid>` when selected | Attribution to the author's own explicit conversation in this work; no native chat capture is implied. |

Saving creates a source with preparation provenance: Prompt ID, method, format, Context ID, work/project baseline revisions, selected source revisions, and reviewer/time. Recorded dependency edges link included source/correction IDs to that new prompt source. Later corrections can flag recorded dependents for review.

Only the **original request** becomes source content. Re-inserting the complete assembled context into sources would repeatedly nest old packages in new context; the implementation avoids that. The full draft stays persisted and personal. Saving updates its saved-source/title linkage without replacing original or composed content.

Save requires edit authority, `reviewed:true`, the expected current work revision, and an unchanged preparation baseline. The server rejects stale drafts and invalid conversation attribution. Repeating an already completed save with the same draft/title returns the original source after access/edit/review checks; a different title conflicts. Saving increments the work revision, so the just-saved draft becomes historical/stale. Prepare again to include the new source.

## Freshness and budgets

Draft retrieval compares current work/project revisions with the recorded baseline. It does not independently certify every cross-work dependency or external document. Source revisions are retained as provenance. Changes that update the work baseline require a newly prepared draft.

The context budget defaults to 32,768 UTF-8 bytes and accepts 1–1,048,576 through the API/MCP. The browser uses the default. Mandatory requirements/review information must fit; otherwise preparation fails with `BUDGET_TOO_SMALL`. Optional sources are included whole by state/recency selection and omitted records are reported. This is not semantic relevance ranking.

The context budget limits the compact full JSON snapshot, **not the prepared prompt**. The draft separately reports `preparedBytes`, including original request, instructions, and projected context. Neither number measures model tokens or the AI client's complete request.

## API and MCP boundaries

The authenticated `POST /api/action` route supports:

| Action | Key inputs / behavior |
| --- | --- |
| `prepare_prompt` | `workId`, `originalRequest`, optional `format`, own `conversationId`, `budgetBytes`; persists and returns a personal draft. Work read access is sufficient. |
| `get_prepared_prompt` | `promptId`; personal-owner and current work checks, result includes `stale`. |
| `list_prepared_prompts` | `workId`, optional offset/limit; actor's draft metadata only, default ten, maximum 100. |
| `save_prepared_prompt` | `promptId`, `title`, `expectedRevision`, `reviewed:true`; editor-only explicit save with provenance. |

Only `prepare_prompt` and `get_prepared_prompt` are MCP tools. List/save are browser/API actions; the MCP catalog has 20 tools total. Generic `record_source` remains available, but it does not perform the prepared-draft reviewed-save workflow.

The checkbox gates the browser Copy/Save buttons, not independent manual text selection. `get_prepared_prompt` itself does not attest that a human reviewed anything. The API save gate records a supplied review assertion, not proof of review quality. SDK calls and manual copying remain separate from host prompt submission.

## Guardrails and known limits

Project context is labeled reference data. Source instructions cannot grant server access or replace the original request's constraints. Formatting/reminders are advisory and do not guarantee prompt-injection resistance or resolve requirement conflicts automatically.

Drafts and context are plaintext local database records accessible to the operator. Preparing persists the request even if you never save it as a source. There is currently no draft deletion, retention setting, secret scanner, or OS-keychain-backed database encryption. Enter only information you intend to store locally.

Copying a prompt to a provider exposes its selected content under that client's/provider's policies. Revoking access cannot recall text already copied. Automatic chat interception, native session mapping, model-assisted rewriting, adapter delivery, and paired task-quality evaluation remain future work. See [guardrails](GUARDRAILS.md), [integrations](INTEGRATIONS.md), and [roadmap](ROADMAP.md).
