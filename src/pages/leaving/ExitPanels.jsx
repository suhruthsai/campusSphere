// ExitPanels.jsx — for a leaving student: "Your exit documents" (everything the college gives you, and where each
// stands).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, Download, FileCheck, Info, Lock } from 'lucide-react';
import Panel, { PanelNote } from '../../components/ui/Panel.jsx';
import { btnPrimary } from '../../components/services/requestUi.jsx';
import { leavingApi } from '../../utils/api.js';

const STATUS = {
  done:        { icon: Check,  color: '#10b981', label: 'Done' },
  in_progress: { icon: Clock3, color: '#f59e0b', label: 'In progress' },
  todo:        { icon: FileCheck, color: '#38bdf8', label: 'To do' },
  blocked:     { icon: Lock,   color: '#94a3b8', label: 'Not yet' },
  info:        { icon: Info,   color: '#a78bfa', label: 'Good to know' },
};

export function ExitChecklist({ reload }) {
  const [data, setData] = useState(undefined);
  const [error, setError] = useState('');
  useEffect(() => { leavingApi.checklist().then(setData).catch((e) => setError(e.message)); }, [reload]);
  if (error) return <p className="text-sm text-rose-500">{error}</p>;
  if (!data) return data === undefined ? <PanelNote>Loading your exit documents…</PanelNote> : null;
  const done = data.items.filter((i) => i.status === 'done').length;
  const counted = data.items.filter((i) => i.status !== 'info').length;
  return (
    <Panel title="Your exit documents" icon={FileCheck} iconColor="#34d399"
      badge={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{done} of {counted} done</span>}>
      <ul className="space-y-2">
        {data.items.map((it) => {
          const st = STATUS[it.status] || STATUS.info;
          const Icon = st.icon;
          return (
            <li key={it.key} className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style={{ background: st.color }}><Icon size={14} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{it.label}{it.reference ? <span className="ml-2 font-mono text-[11px] font-normal" style={{ color: 'var(--text-3)' }}>{it.reference}</span> : null}</p>
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>{it.detail}</p>
                    {it.items?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {it.items.map((o, i) => <li key={i}>{o.label}: {o.status === 'returned' ? 'returned to you' : o.status === 'out' ? 'lent to you' : 'with the college'}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
                {it.download && it.status === 'done' && (
                  <button type="button" className={btnPrimary} onClick={() => leavingApi.noDuesCertificate().catch((e) => setError(e.message))}><Download size={14} /> Download</button>
                )}
                {it.link && it.status !== 'blocked' && it.kind === 'document' && it.status !== 'done' && (
                  <Link to={it.link} className="text-xs font-semibold hover:underline" style={{ color: 'var(--brand-text)' }}>Apply →</Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
