import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * LinkButton – same look as Button but renders as a React Router <Link>.
 * variant: "primary" | "secondary" | "ghost" | "icon"
 * size: "sm" | "md" | "lg"
 */
const variants = {
  primary: 'border-0 text-white font-bold hover:brightness-110',
  secondary: 'border font-bold text-[var(--text)] hover:brightness-110',
  ghost: 'border font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)]',
  icon: 'border text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
};

const variantStyle = {
  primary: { background: 'var(--brand-grad)', boxShadow: '0 6px 20px rgba(99,102,241,0.32)' },
  secondary: { background: 'color-mix(in srgb, var(--brand-2) 18%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-2) 45%, transparent)' },
  ghost: { background: 'var(--surface-2)', borderColor: 'var(--border-strong)' },
  icon: { background: 'var(--surface-2)', borderColor: 'var(--border)' },
};

const sizes = {
  sm: 'h-8  px-3.5 text-xs  gap-1.5 rounded-xl',
  md: 'h-10 px-5   text-sm  gap-2   rounded-xl',
  lg: 'h-12 px-7   text-sm  gap-2.5 rounded-2xl',
};

export default function LinkButton({ to, children, variant = 'primary', size = 'md', className = '' }) {
  const key = variants[variant] ? variant : 'primary';
  return (
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="inline-flex"
    >
      <Link
        to={to}
        style={variantStyle[key]}
        className={[
          'inline-flex items-center justify-center font-sans tracking-tight transition-all select-none',
          sizes[size] ?? sizes.md,
          variants[key],
          className,
        ].filter(Boolean).join(' ')}
      >
        {children}
      </Link>
    </motion.div>
  );
}
