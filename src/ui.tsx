import type { ReactNode } from 'react';
import { Copy, type LucideIcon } from 'lucide-react';

export function FeatureBanner({ eyebrow, title, children, Icon, action, tone = 'violet' }: { eyebrow: string; title: string; children: ReactNode; Icon: LucideIcon; action?: ReactNode; tone?: 'violet' | 'teal' }) {
  return <section className={`feature-banner feature-${tone}`}><span className="feature-icon"><Icon size={26} /></span><div className="feature-copy"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><div>{children}</div></div>{action && <div className="feature-action">{action}</div>}</section>;
}

export function CopyField({ label, value, copy }: { label: string; value: string; copy: (text: string) => void }) {
  return <div className="copy-field"><span className="small muted">{label}</span><div><code>{value}</code><button className="icon-button" aria-label={`Copy ${label}`} onClick={() => copy(value)}><Copy size={16} /></button></div></div>;
}

const labels: Record<string, string> = { codex: 'Codex', cursor: 'Cursor', 'claude-code': 'Claude Code', 'claude-desktop': 'Claude Desktop', claude: 'Claude' };
export function ClientBadge({ client }: { client?: string }) {
  return <span className={`client-badge client-${Object.hasOwn(labels, client || '') ? client : 'other'}`}><span aria-hidden="true">{(labels[client || ''] || client || '?').slice(0, 1)}</span>{labels[client || ''] || client || 'Client not recorded'}</span>;
}
