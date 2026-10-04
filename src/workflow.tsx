import { useRef, useState } from 'react';
import { AlertTriangle, Check, ClipboardList, Clock3, Copy, GitBranch, Inbox, LayoutDashboard, MoreHorizontal, Plug, Plus, ShieldCheck, Users } from 'lucide-react';
import { Panel, Status } from './components';
import type { Entity } from './api';

const mainNavigation = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'work', label: 'Work', Icon: ClipboardList },
  { id: 'inbox', label: 'Handoffs', Icon: Inbox },
  { id: 'connections', label: 'Connections', Icon: Plug },
];
const projectNavigation = [
  { id: 'graph', label: 'Dependencies', Icon: GitBranch },
  { id: 'activity', label: 'Activity', Icon: Clock3 },
  { id: 'access', label: 'Project members', Icon: Users },
];

export function AppNavigation({ view, navigate, unread, createProject }: { view: string; navigate: (view: string) => void; unread: number; createProject: () => void }) {
  const more = useRef<HTMLDetailsElement>(null);
  const secondaryActive = projectNavigation.some(item => item.id === view);
  const item = ({ id, label, Icon }: typeof mainNavigation[number]) => {
    const active = view === id || (view === 'detail' && id === 'work');
    return <button key={id} className={`nav-item ${active ? 'active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} onClick={() => { navigate(id); if (more.current) more.current.open = false; }}>
      <Icon size={19} /><span>{label}</span>{id === 'inbox' && unread > 0 && <span className="nav-count" aria-label={`${unread} unread handoffs`}>{unread}</span>}
    </button>;
  };
  return <aside className="sidebar">
    <nav className="main-navigation" aria-label="Main navigation">{mainNavigation.map(item)}</nav>
    <div className="project-navigation"><p className="nav-group-label">PROJECT</p><nav aria-label="Project navigation">{projectNavigation.map(item)}</nav></div>
    <details className={`mobile-more ${secondaryActive ? 'active' : ''}`} ref={more}>
      <summary><MoreHorizontal size={19} /><span>More</span></summary>
      <nav aria-label="More navigation">{projectNavigation.map(item)}<button className="nav-item" aria-label="New project" onClick={() => { if (more.current) more.current.open = false; createProject(); }}><Plus size={19} /><span>New project</span></button></nav>
    </details>
    <div className="sidebar-footer"><button className="secondary" onClick={createProject}><Plus size={16} />New project</button><p className="small muted"><ShieldCheck size={14} />Private until shared</p></div>
  </aside>;
}

export function ContextPreview({ context }: { context: any }) {
  const sources: Entity[] = context.sources || [];
  const corrections: Entity[] = context.corrections || [];
  const warnings: string[] = context.warnings || [];
  return <div className="context-preview">
    {warnings.length > 0 && <div className="context-warning" role="status"><AlertTriangle size={19} /><div><strong>Review before continuing</strong>{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div></div>}
    <section className="context-section"><h3>Goal</h3><p className="preserve">{context.objective}</p>{context.projectObjective && <p className="small muted preserve">Project goal: {context.projectObjective}</p>}</section>
    <section className="context-section"><h3>Requirements</h3><p className="preserve">{context.requirements || 'No shared requirements recorded.'}</p></section>
    <section className="context-section"><h3>Next step</h3><p className="preserve">{context.nextAction || 'A next step has not been recorded.'}</p></section>
    {corrections.length > 0 && <section className="context-section"><h3>Corrections to review</h3>{corrections.map(correction => <details className="context-source" key={correction.id}><summary>Correction · <span className="mono small">{correction.id}</span></summary><p className="preserve">{correction.content}</p><p className="small muted mono">Replaces {correction.supersedesId} · v{correction.revision}</p><Status value={correction.status} /></details>)}</section>}
    <section className="context-section"><h3>Included sources <span className="muted">({sources.length})</span></h3>{sources.length ? sources.map(source => <details className="context-source" key={source.id}><summary><span>{source.title}</span><Status value={source.status} /></summary><p className="preserve">{source.content}</p><p className="small muted">{source.kind} · revision {source.revision}</p><p className="small muted mono">{source.id}{source.conversationId && ` · ${source.conversationId}`}</p>{source.selectionReason && <p className="small muted">{source.selectionReason}</p>}</details>) : <p className="small muted">This package contains the work goal, requirements, and next step.</p>}</section>
    {context.omitted?.count > 0 && <div className="context-omissions"><strong>{context.omitted.count} eligible {context.omitted.count === 1 ? 'source was' : 'sources were'} left out</strong><p className="small">{context.omitted.reason} Increase the budget or review which sources should be included.</p>{context.omitted.ids?.length > 0 && <details><summary>View omitted ID sample</summary><p className="small mono preserve">{context.omitted.ids.join('\n')}</p></details>}</div>}
    <details className="technical-details"><summary>View complete JSON package</summary><pre className="context-output">{JSON.stringify(context, null, 2)}</pre></details>
  </div>;
}

const aiClients = [
  { id: 'all', label: 'All supported clients' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'claude-desktop', label: 'Claude Desktop' },
];

export function ClientSetup({ createCredential, registerDevice, copy }: { createCredential: (setup: boolean) => void; registerDevice: () => void; copy: (value: string) => void }) {
  const [client, setClient] = useState('all');
  const command = `npm run setup:mcp -- --client ${client}`;
  return <Panel title="Connect your AI client" className="setup-panel">
    <div className="connection-setup">
      <p className="muted">Use the same work and saved context in Codex, Cursor, or Claude.</p>
      <ol className="setup-guide">
        <li><span className="step-number">1</span><div><h3>Create a setup credential</h3><p>Use your own account. Copy the credential when it is shown.</p><button className="primary" onClick={() => createCredential(true)}><ShieldCheck size={16} />Create setup credential</button></div></li>
        <li><span className="step-number">2</span><div><h3>Run setup in a terminal</h3><label className="client-choice">AI client<select value={client} onChange={event => setClient(event.target.value)}>{aiClients.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><p>From the WorkTether folder, run this command. Paste the credential at the hidden prompt.</p><div className="command-field"><code>{command}</code><button className="icon-button" aria-label="Copy setup command" onClick={() => copy(command)}><Copy size={17} /></button></div><p className="small muted">Setup creates a separate registration and credential for each selected client. Keep the WorkTether server running.</p></div></li>
        <li><span className="step-number">3</span><div><h3>Open your client and reconnect MCP</h3><p>Open and trust the WorkTether folder in your client. Ask it to retrieve your workspace or continue a Work ID.</p>{['all', 'claude-desktop'].includes(client) && <p className="small muted">For Claude Desktop, merge the entry from <code>.worktether/claude-desktop-config.json</code> into its local server config and restart Desktop. See README.md for the full guide.</p>}<p className="small muted">Verify that the client returns your own account and permitted work. A registration alone does not prove a connection.</p></div></li>
      </ol>
      <div className="setup-note"><Check size={17} /><p>Work stays private unless you share it. MCP uses explicitly recorded information; prepare prompts in the work’s Prompt builder. Automatic chat capture remains planned.</p></div>
      <details className="advanced-setup"><summary>Advanced: manual MCP configuration</summary><p className="small muted">For clients you configure by hand, register a client and create its credential. The endpoint below is the default local address; use your configured port if different.</p><div className="command-field"><code>http://127.0.0.1:4318/mcp</code><button className="icon-button" aria-label="Copy MCP endpoint" onClick={() => copy('http://127.0.0.1:4318/mcp')}><Copy size={17} /></button></div><div className="row"><button className="secondary" onClick={registerDevice}><Plus size={16} />Register client manually</button><button className="secondary" onClick={() => createCredential(false)}>Create client credential</button></div><p className="small muted">Use the endpoint and a personal Bearer credential. Sharing across physical machines requires the documented shared deployment.</p></details>
    </div>
  </Panel>;
}
