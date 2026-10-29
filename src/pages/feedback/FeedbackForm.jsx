// One feedback form to answer: a 1-5 rating per statement and an optional comment. Used by signed-in students and
// teachers, and (with a role choice) by alumni, employers and parents on the public link.
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { btnPrimary, inputCls, labelCls } from '../../components/services/requestUi.jsx';

const SCALE = [[1, 'Strongly disagree'], [2, 'Disagree'], [3, 'Neutral'], [4, 'Agree'], [5, 'Strongly agree']];

export default function FeedbackForm({ form, onSubmit, roles }) {
  const [answers, setAnswers] = useState({});
  const [role, setRole] = useState(roles?.[0]?.[0] || null);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const ratings = form.questions.filter((q) => q.type === 'rating');
  const missing = ratings.filter((q) => !answers[q.id]).length;

  const submit = async (e) => {
    e.preventDefault();
    if (missing) { setMsg(`Rate all ${ratings.length} statements (${missing} left).`); return; }
    setBusy(true);
    try { setMsg((await onSubmit(answers, role)).message); setDone(true); } catch (err) { setMsg(err.message); } finally { setBusy(false); }
  };

  if (done) return <p className="flex items-center gap-2 rounded-2xl bg-emerald-400/10 p-4 text-emerald-200"><CheckCircle2 size={18} /> {msg}</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-slate-400">Your answers are anonymous: nobody can see who gave them.</p>
      {roles && (
        <div>
          <label className={labelCls}>I am a / an</label>
          <div className="flex flex-wrap gap-2">
            {roles.map(([k, l]) => <button type="button" key={k} onClick={() => setRole(k)} className={`rounded-full px-3 py-1 text-sm ${role === k ? 'bg-cyan-400/20 text-cyan-200' : 'bg-white/5 text-slate-400'}`}>{l}</button>)}
          </div>
        </div>
      )}
      {ratings.map((q, i) => (
        <div key={q.id} className="rounded-xl bg-white/5 p-3">
          <p className="text-sm text-slate-200"><span className="mr-2 text-slate-500">{i + 1}.</span>{q.text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCALE.map(([v, l]) => (
              <button type="button" key={v} title={l} onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                      className={`min-w-[2.6rem] rounded-lg px-2 py-1.5 text-sm ${answers[q.id] === v ? 'bg-cyan-400 font-semibold text-slate-900' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                {v}
              </button>
            ))}
            <span className="ml-1 self-center text-[11px] text-slate-500">{answers[q.id] ? SCALE[answers[q.id] - 1][1] : '1 = strongly disagree · 5 = strongly agree'}</span>
          </div>
        </div>
      ))}
      {form.questions.filter((q) => q.type === 'text').map((q) => (
        <div key={q.id}>
          <label className={labelCls}>{q.text} (optional)</label>
          <textarea rows={3} maxLength={1000} className={inputCls} value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
        </div>
      ))}
      <div className="flex items-center gap-3"><button className={btnPrimary} disabled={busy}>Submit feedback</button>{msg && <span className="text-sm text-amber-300">{msg}</span>}</div>
    </form>
  );
}
