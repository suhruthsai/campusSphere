// One-time academic profile a student fills before their first certificate request.
import { useState } from 'react';
import { servicesApi } from '../../utils/api.js';
import { btnPrimary, inputCls, labelCls } from './requestUi.jsx';

export default function ProfileForm({ profile, onSaved }) {
  const [form, setForm] = useState({
    roll_no: profile?.roll_no || '',
    year: profile?.year || '',
    section: profile?.section || '',
    parent_name: profile?.parent_name || '',
    gender: profile?.gender || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await servicesApi.saveProfile({ ...form, year: Number(form.year) });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-slate-300">
        Certificates are printed from these details, so enter them exactly as in your college records.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Roll number</label>
          <input className={inputCls} value={form.roll_no} onChange={set('roll_no')} required placeholder="1602-23-733-001" />
        </div>
        <div>
          <label className={labelCls}>Department</label>
          <input className={`${inputCls} opacity-60`} value={profile?.department || ''} disabled />
        </div>
        <div>
          <label className={labelCls}>Year</label>
          <select className={inputCls} value={form.year} onChange={set('year')} required>
            <option value="">Select</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{['I', 'II', 'III', 'IV'][y - 1]} Year</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Section</label>
          <input className={inputCls} value={form.section} onChange={set('section')} required maxLength={10} placeholder="A" />
        </div>
        <div>
          <label className={labelCls}>Father's / mother's name</label>
          <input className={inputCls} value={form.parent_name} onChange={set('parent_name')} required minLength={2} />
        </div>
        <div>
          <label className={labelCls}>Gender (for Mr./Ms. on certificates)</label>
          <select className={inputCls} value={form.gender} onChange={set('gender')} required>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}
