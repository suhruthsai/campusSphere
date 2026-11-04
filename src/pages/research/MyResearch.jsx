// My research (faculty): my service record and the research / development items I report, with their evidence.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PageTransition from '../../components/PageTransition.jsx';
import { DashboardHeading } from '../StudentDashboard.jsx';
import { researchApi as api } from '../../utils/api.js';
import { AddItem, ItemRow } from './shared.jsx';

export default function MyResearch() {
  const [d, setD] = useState(null);
  const load = useCallback(() => api.mine().then(setD), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <PageTransition className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-28 text-slate-400"><Loader2 className="animate-spin" size={16} /> Loading…</PageTransition>;
  const r = d.record;
  return (
    <PageTransition className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 pb-20 pt-28 sm:px-6">
      <DashboardHeading eyebrow="My research" title="Your papers, projects and FDPs" />
      {!r ? <p className="text-slate-400">{d.reason}</p> : (
        <>
          <section className="glass grid gap-3 rounded-2xl p-5 text-sm sm:grid-cols-4">
            {[['Designation', r.designation], ['Qualification', r.qualification + (r.phd_year ? ` (${r.phd_year})` : '')],
              ['Teaching experience', `${r.experience_now} years`], ['Joined', new Date(r.joined_on).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })]].map(([k, v]) => (
              <div key={k}><p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p><p className="text-slate-200">{v}</p></div>
            ))}
            <p className="text-xs text-slate-500 sm:col-span-4">Your HOD keeps this record. If anything is wrong, tell them.</p>
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="section-title mb-3">Report something new</h2>
            <AddItem onDone={load} />
          </section>
          <section className="glass rounded-2xl p-5">
            <h2 className="section-title mb-3">What you have reported ({d.items.length})</h2>
            {d.items.length === 0 ? <p className="text-sm text-slate-400">Nothing yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>
                {d.items.map((i) => <ItemRow key={i.id} i={i} canDelete onChanged={load} />)}
              </tbody></table></div>
            )}
          </section>
        </>
      )}
    </PageTransition>
  );
}
