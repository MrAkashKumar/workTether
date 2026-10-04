import { useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { GitBranch, X, FileText, CheckCheck, ClipboardList, Link2, CircleHelp } from 'lucide-react';
import type { Entity } from './api';

export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { planned: 'Planned', active: 'Active', review: 'In review', blocked: 'Blocked', done: 'Done', needs_review: 'Needs review', accepted: 'Accepted', verified: 'Verified', proposed: 'Proposed', excluded: 'Excluded', superseded: 'Superseded', queued: 'Queued', retrieved: 'Retrieved', acknowledged: 'Acknowledged', revoked: 'Revoked' };
  return <span className={`status status-${value}`}>{labels[value] || value}</span>;
}

export function Panel({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}

export function Empty({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><CircleHelp size={24} /><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={close}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}</dialog>;
}

export function EvidenceChart({ counts }: { counts: {verified: number; needs_review: number; unverified: number; total: number} }) {
  if (!counts.total) return <Empty title="No evidence recorded" message="Record checks to see their state here." />;
  const series = [{label: 'Verified', value: counts.verified, className: 'verified'}, {label: 'Needs review', value: counts.needs_review, className: 'review'}, {label: 'Unverified', value: counts.unverified, className: 'unverified'}];
  return <div className="evidence-chart" aria-label={`${counts.total} accessible evidence records by state`}><p className="small muted">{counts.total} accessible evidence records</p>{series.map(item => <div className="chart-row" key={item.label}><span>{item.label}</span><div className="chart-track"><div className={`chart-fill ${item.className}`} style={{ width: `${100 * item.value / counts.total}%` }} /></div><strong>{item.value}</strong></div>)}<p className="small muted chart-note">Recorded evidence state across permitted project work.</p></div>;
}

export function DependencyGraph({ nodes, edges, select, selectedId }: { nodes: Entity[]; edges: Entity[]; select: (node: Entity) => void; selectedId?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<{ id: string; path: string }[]>([]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const draw = () => {
      const box = element.getBoundingClientRect();
      setLines(edges.filter(edge => edge.kind !== 'contains').flatMap(edge => {
        const from = elements.current.get(edge.from)?.getBoundingClientRect();
        const to = elements.current.get(edge.to)?.getBoundingClientRect();
        if (!from || !to) return [];
        const sameRow = Math.abs(from.top - to.top) < 20;
        const forward = to.left > from.left, downward = to.top > from.top;
        const x1 = (sameRow ? (forward ? from.right + 2 : from.left - 2) : from.left + from.width / 2) - box.left;
        const y1 = (sameRow ? from.top + from.height / 2 : (downward ? from.bottom + 2 : from.top - 2)) - box.top;
        const x2 = (sameRow ? (forward ? to.left - 3 : to.right + 3) : to.left + to.width / 2) - box.left;
        const y2 = (sameRow ? to.top + to.height / 2 : (downward ? to.top - 3 : to.bottom + 3)) - box.top;
        return [{ id: edge.id || `${edge.from}-${edge.to}`, path: sameRow ? `M${x1} ${y1} C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}` : `M${x1} ${y1} C${x1} ${(y1 + y2) / 2},${x2} ${(y1 + y2) / 2},${x2} ${y2}` }];
      }));
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, [nodes, edges]);
  if (!nodes.length) return <Empty title="No dependencies yet" message="Add a source and link it to the records that support it." />;
  const icons: Record<string, typeof FileText> = { work: ClipboardList, requirement: FileText, evidence: CheckCheck, decision: GitBranch, prompt: FileText, assumption: CircleHelp, summary: Link2 };
  return <><div className="graph-canvas" ref={container}><svg className="graph-lines" aria-hidden="true"><defs><marker id="graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="currentColor" /></marker></defs>{lines.map(line => <path key={line.id} d={line.path} fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#graph-arrow)" />)}</svg><div className="graph-nodes">{nodes.map(node => { const Icon = icons[node.kind || node.type] || FileText; return <button type="button" key={node.id} ref={element => { if (element) elements.current.set(node.id, element); else elements.current.delete(node.id); }} className={`graph-node ${selectedId === node.id ? 'selected' : ''} ${node.status === 'needs_review' || node.needsReview ? 'needs-review' : ''}`} onClick={() => select(node)}><Icon size={22} /><span className="graph-node-text"><span className="small muted capitalize">{node.kind || node.type || 'Record'}</span><strong>{node.title || node.name || node.id}</strong>{(node.status || node.active === false) && <Status value={node.active === false ? 'excluded' : node.status} />}</span></button>; })}</div></div><p className="small muted graph-caption">Arrows show recorded source dependencies and corrections. Project and work cards identify scope.</p><div className="graph-relationships">{edges.filter(edge => edge.kind !== 'contains').map(edge => <p className="small" key={edge.id}><strong>{nodes.find(node => node.id === edge.from)?.title}</strong> → <strong>{nodes.find(node => node.id === edge.to)?.title}</strong><span className="muted"> · {edge.kind === 'supersedes' ? 'replacement' : 'recorded dependency'}</span></p>)}</div></>;
}
