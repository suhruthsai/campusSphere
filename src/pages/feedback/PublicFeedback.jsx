// Public feedback form (no login): alumni, employers and parents open the link the IQAC shares.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { feedbackApi } from '../../utils/api.js';
import FeedbackForm from './FeedbackForm.jsx';
import PublicFrame from '../../components/layout/PublicFrame.jsx';

const ROLES = { alumni: [['alumni', 'Alumnus / alumna']], employer: [['employer', 'Employer']], parent: [['parent', 'Parent / guardian']] };

export default function PublicFeedback() {
  const { code } = useParams();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { feedbackApi.publicForm(code).then(setForm).catch((e) => setError(e.message)); }, [code]);
  return (
    <PublicFrame>
      <div className="mx-auto max-w-2xl space-y-5">
        <p className="ds-eyebrow">MVSR Engineering College · CampusSphere</p>
        {error && <p className="rounded-2xl bg-white/5 p-5 text-slate-300">{error}</p>}
        {form && (
          <>
            <h1 className="font-display text-3xl font-bold text-white">{form.title}</h1>
            <div className="glass rounded-2xl p-5">
              <FeedbackForm form={form} roles={ROLES[form.kind] || [['alumni', 'Alumnus / alumna'], ['employer', 'Employer'], ['parent', 'Parent']]}
                            onSubmit={(answers, role) => feedbackApi.publicRespond(code, role, answers)} />
            </div>
          </>
        )}
      </div>
    </PublicFrame>
  );
}
