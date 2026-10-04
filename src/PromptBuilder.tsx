import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, LoaderCircle, Save, Sparkles } from 'lucide-react';
import { action, ago, type Entity } from './api';
import { Panel } from './components';
import { ContextPreview } from './workflow';

export function PromptBuilder({ work, projectRevision, conversationId, saved }: { work: Entity; projectRevision: number; conversationId: string; saved: () => void }) {
  const [input, setInput] = useState('');
  const [format, setFormat] = useState('request');
  const [draft, setDraft] = useState<any>(null);
  const [history, setHistory] = useState<Entity[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const historyPage = async () => { const result = await action('list_prepared_prompts', { workId: work.id, limit: 10 }); setHistory(result.items); };
  useEffect(() => { let cancelled = false; action('list_prepared_prompts', { workId: work.id, limit: 10 }).then(result => { if (!cancelled) setHistory(result.items); }).catch(() => {}); return () => { cancelled = true; }; }, [work.id]);
  useEffect(() => { setDraft(null); setReviewed(false); }, [work.id, work.revision, projectRevision, conversationId]);
  const invalidate = () => { setDraft(null); setReviewed(false); setNotice(''); setError(''); };
  const prepare = async () => {
    setBusy(true); setError(''); setNotice(''); setReviewed(false); setDraft(null);
    try {
      const result = await action('prepare_prompt', { workId: work.id, originalRequest: input, format, ...(conversationId ? { conversationId } : {}) });
      setDraft(result); void historyPage().catch(() => {});
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const copy = async () => {
    setBusy(true); setError('');
    try {
      const current = await action('get_prepared_prompt', { promptId: draft.id });
      setDraft(current);
      if (current.stale) throw new Error('The project or work changed. Prepare a new draft before copying.');
      await navigator.clipboard.writeText(current.preparedText); setNotice('Prepared prompt copied. Paste it into the AI client you choose.');
    } catch (cause) { setError((cause as Error).message || 'Clipboard unavailable.'); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      await action('save_prepared_prompt', { promptId: draft.id, expectedRevision: work.revision, title: 'Prompt request · ' + work.title.slice(0, 170), reviewed });
      setNotice('Original request saved as a proposed source with a link to this private draft. Prepare again to include the new source.');
      setDraft(null); setReviewed(false); saved(); void historyPage().catch(() => {});
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const open = async (promptId: string) => {
    setBusy(true); setError(''); setNotice(''); setReviewed(false);
    try { const result = await action('get_prepared_prompt', { promptId }); setInput(result.originalRequest); setFormat(result.format); setDraft(result); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const draftStale = draft && (draft.stale || draft.workRevision !== work.revision || draft.projectRevision !== projectRevision);
  return <div className="prompt-builder">
    <div className="prompt-intro"><span className="prompt-symbol"><Sparkles size={23} /></span><div><h2>A clearer prompt, with your project behind it</h2><p>Keep your request intact. Add current requirements and useful context, then review before using it.</p></div><span className="local-preparation">Prepared locally</span></div>
    {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
    {notice && <p className="prompt-notice" role="status"><Check size={17} />{notice}</p>}
    <div className="prompt-grid">
      <Panel title="1. Your original request"><div className="prompt-input">
        <label className="field"><span>What do you want to do?</span><textarea value={input} disabled={busy} maxLength={20000} rows={7} placeholder="Describe the task, constraints, and result you want. Your wording will be kept exactly as written." onChange={event => { setInput(event.target.value); invalidate(); }} /></label>
        <label className="field"><span>Response format</span><select disabled={busy} value={format} onChange={event => { setFormat(event.target.value); invalidate(); }}><option value="request">Follow my request</option><option value="plan">Step-by-step plan</option><option value="review">Review and findings</option><option value="explain">Plain-language explanation</option></select></label>
        <p className="small muted">Work ID <code>{work.id}</code>{conversationId && <><br />Conversation ID <code>{conversationId}</code></>}</p>
        <button className="primary prompt-primary full-width" disabled={busy || !input.trim()} onClick={() => void prepare()}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}Prepare prompt</button>
        <p className="small muted prompt-privacy">No external AI call. This structures your request; it does not rewrite its meaning or submit it to another client.</p>
      </div></Panel>
      <Panel title="2. Review and use"><div className="prompt-output">{draft ? <>
        <div className="prompt-additions"><strong>Your request is unchanged. We added:</strong><ul><li>Work goal, next step, and current requirements</li><li>{draft.context.sources.length} selected sources, with IDs and revisions</li><li>Review warnings, corrections, and omitted-source information</li><li>The response format you selected</li></ul></div>
        {(draftStale || draft.context.warnings.length > 0 || draft.context.omitted.count > 0) && <div className="context-warning" role="status"><AlertTriangle size={18} /><div>{draftStale && <p><strong>This draft is out of date. Prepare a new one before use.</strong></p>}{draft.context.warnings.map((warning: string, index: number) => <p key={index}>{warning}</p>)}{draft.context.omitted.count > 0 && <p>{draft.context.omitted.count} eligible sources did not fit the context budget.</p>}</div></div>}
        <details className="prompt-context"><summary>Inspect added project context</summary><ContextPreview context={draft.addedContext || draft.context} /></details>
        <label className="field"><span>Prepared prompt</span><textarea className="prepared-text" value={draft.preparedText} readOnly rows={10} /></label>
        <p className="small muted prompt-provenance"><code>{draft.id}</code><br />{draft.preparedBytes.toLocaleString()} bytes total · Context <code>{draft.contextId}</code><br />Work v{draft.workRevision} · Requirements v{draft.projectRevision}</p>
        <label className="review-check"><input type="checkbox" checked={reviewed} disabled={draftStale} onChange={event => setReviewed(event.target.checked)} /><span>I reviewed my request, the added context, and any warnings.</span></label>
        <div className="row prompt-actions"><button className="primary prompt-primary" disabled={!reviewed || busy || draftStale} onClick={() => void copy()}><Copy size={16} />Copy prepared prompt</button>{work.canEdit && <button className="secondary" disabled={!reviewed || busy || draftStale || !!draft.savedSourceId} onClick={() => void save()}><Save size={16} />Save request to sources</button>}</div>
        <p className="small muted">Saving records the original request as proposed and links this draft. The assembled context stays separate, avoiding repeated copies inside future context.</p>
      </> : <div className="prompt-empty"><Sparkles size={30} /><h3>Your prepared prompt will appear here</h3><p>Write your request and choose Prepare prompt. You’ll be able to inspect everything that was added.</p></div>}</div></Panel>
    </div>
    {history.length > 0 && <details className="prompt-history"><summary>Your recent drafts <span className="small muted">Latest {history.length}</span></summary><div>{history.map(item => <button key={item.id} disabled={busy} onClick={() => void open(item.id)}><span><code>{item.id}</code><span className="small muted">{ago(item.createdAt)} · {item.format}{item.savedSourceId && ' · request saved'}</span></span><span className="text-button">Open</span></button>)}</div></details>}
  </div>;
}
