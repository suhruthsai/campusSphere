// Visit.jsx — the public visitor view (no account): the 3D campus with Mitra, the walking guide, open
// and ready. Made for parents and first-time visitors; it shows public information only.
import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import SuhruthDigitalTwin from '../components/three/SuhruthDigitalTwin.jsx';
import GuidePanel from '../components/GuidePanel.jsx';
import PageTransition from '../components/PageTransition.jsx';

export default function Visit() {
  return (
    <PageTransition className="relative min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-[#050816]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <span className="block text-sm font-bold tracking-wide text-white">CampusSphere</span>
            <span className="block truncate text-[11px] text-slate-400">MVSR Engineering College · Visitor view</span>
          </div>
          <Link to="/login" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-cyan-300">
            <LogIn size={14} /> Sign in
          </Link>
        </div>
      </header>
      <section className="px-4 pt-[72px] sm:px-6">
        <SuhruthDigitalTwin />
        <p className="mx-auto max-w-3xl px-2 pb-28 pt-4 text-center text-xs leading-relaxed text-slate-400">
          Ask Mitra in English, हिंदी or తెలుగు: where to collect a certificate, where a department is, or for a tour.
          She answers aloud and walks you there on the map. Students sign in for their own classes and requests.
        </p>
      </section>
      <GuidePanel defaultOpen />
    </PageTransition>
  );
}
