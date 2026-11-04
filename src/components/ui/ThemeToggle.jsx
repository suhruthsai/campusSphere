// ThemeToggle — the sun / moon switch in the top bar
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { isLight, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Dark theme' : 'Light theme'}
      className={`grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] ${className}`}>
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
