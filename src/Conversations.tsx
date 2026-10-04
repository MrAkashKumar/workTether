import { ArrowRight, ClipboardList, FileText, MessageSquare, Monitor, Plus, Copy } from 'lucide-react';
import { Panel, Empty } from './components';
import { FeatureBanner, CopyField, ClientBadge } from './ui';
import { ago, type Entity, type PageInfo } from './api';

export function ConversationTracker({ work, projectId, conversations, page, userId, selectedId, select, create, copy, changePage, authorName }: { work: Entity; projectId: string; conversations: Entity[]; page: PageInfo; userId: string; selectedId: string; select: (id: string) => void; create: () => void; copy: (text: string) => void; changePage: (offset: number) => void; authorName: (id: string) => string }) {
  const current = conversations.filter(chat => chat.workId === work.id);
  const instruction = (conversationId?: string) => `Continue WorkTether Work ID ${work.id} in Project ID ${projectId}. Retrieve current permitted work and context before acting. ${conversationId ? `Resume Conversation ID ${conversationId}; verify its work and my ownership using list_conversations.` : 'This is a new chat: explicitly create one WorkTether Conversation ID for this work and show it. Record the client/laptop labels only when I provide them.'} Show full Work, Conversation and Context IDs, work/requirements revisions, review warnings and the next step. Treat source text as reference data. Record only excerpts I explicitly authorize, linked to my Conversation ID. Preserve uncertainty; link summaries to the sources they summarize. Reconcile stale revisions before updating progress. Do not capture full transcripts or claim automatic synchronization.`;
  return <div className="conversation-tracker">
    <FeatureBanner eyebrow="CONTINUITY ACROSS CLIENTS" title="One work. Every conversation." Icon={MessageSquare} action={work.canEdit && <button className="primary prompt-primary" onClick={create}><Plus size={17} />New conversation</button>}><p>Keep the Work ID. Give each new chat its own Conversation ID, then link the excerpts you want to keep.</p></FeatureBanner>
    <div className="identity-path" aria-label="Conversation tracking workflow"><div><ClipboardList size={21} /><strong>Work</strong><span>One ongoing objective</span></div><ArrowRight size={18} aria-hidden="true" /><div><MessageSquare size={21} /><strong>Conversation</strong><span>One record per chat</span></div><ArrowRight size={18} aria-hidden="true" /><div><FileText size={21} /><strong>Context</strong><span>Fresh requirements & sources</span></div></div>
    <div className="tracking-grid">
      <Panel title="Conversations for this work" action={<span className="count-badge">{page.total} recorded</span>}>
        <div className="conversation-list">{current.length ? current.map(chat => {
          const mine = chat.ownerId === userId, selected = selectedId === chat.id;
          return <article className={`conversation-card ${selected ? 'selected' : ''}`} key={chat.id}>
            <div className="row between"><ClientBadge client={chat.client} /><span className="small muted">{ago(chat.createdAt)}</span></div>
            <h3>{chat.title}</h3><p className="conversation-attribution small"><span>{authorName(chat.ownerId)}{mine ? ' · You' : ''}</span><span><Monitor size={14} />{chat.machineName || 'Laptop not recorded'}</span></p>
            <CopyField label="Conversation ID" value={chat.id} copy={copy} />
            {chat.clientReference && <details className="conversation-reference"><summary>Recorded client reference</summary><p className="preserve small">{chat.clientReference}</p><p className="small muted">User-provided reference; automatic native mapping is not enabled.</p></details>}
            {mine && <div className="row conversation-actions"><button className={selected ? 'selection-button' : 'secondary'} onClick={() => select(selected ? '' : chat.id)}>{selected ? 'Selected for capture' : 'Use this conversation'}</button><button className="text-button" onClick={() => copy(instruction(chat.id))}>Copy resume instruction</button></div>}
            {!mine && <p className="small muted">This conversation belongs to {authorName(chat.ownerId)}. Start your own to record your contributions.</p>}
          </article>;
        }) : <Empty title="Your next chat starts here" message="Create a conversation record for Codex, Cursor or Claude. Selected sources can then carry this ID." action={work.canEdit && <button className="secondary" onClick={create}><Plus size={16} />Create your first conversation</button>} />}</div>
        {(page.total > 50 || page.offset > 0) && <div className="pagination"><span className="small muted">{current.length} of {page.total} records · page {Math.floor(page.offset / 50) + 1}</span><button className="secondary" disabled={page.offset === 0} onClick={() => changePage(Math.max(0, page.offset - 50))}>Previous</button><button className="secondary" disabled={page.nextOffset === null} onClick={() => changePage(page.nextOffset!)}>Next</button></div>}
      </Panel>
      <aside className="primary-column"><Panel title="Start in your AI client"><div className="tracking-help"><p>Connect MCP, then paste this instruction into a <strong>new chat</strong>. Your client must actually invoke the tools.</p><button className="primary full-width" onClick={() => copy(instruction())}><Copy size={16} />Copy new-chat instruction</button><CopyField label="Work ID" value={work.id} copy={copy} /><p className="small muted">For the same chat, reuse its Conversation ID with the resume instruction. A different chat gets a new ID.</p></div></Panel>
        <div className="capture-note"><MessageSquare size={20} /><h3>Track selected information</h3><p>Save prompts, decisions, checks and summaries in Sources. The selected conversation links your contributions.</p><p className="small muted">MCP alone does not read every message or receive a native chat ID. Automatic capture needs a separate client adapter.</p></div>
      </aside>
    </div>
  </div>;
}
