// PublicFrame — the plain frame for pages anyone can open without signing in (certificate check,
// feedback links): the logo, the theme switch and the page. The <main> lets the older-page theme skin apply.
import { Link } from 'react-router-dom';
import BrandMark from '../ui/BrandMark.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

export default function PublicFrame({ children }) {
  return (
    <div className="min-h-screen" style={{ color: 'var(--text)' }}>
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link to="/" aria-label="CampusSphere home"><BrandMark size={38} sub="MVSR Engineering College" /></Link>
        <ThemeToggle />
      </header>
      <main className="px-4 pb-14 pt-4">{children}</main>
    </div>
  );
}
