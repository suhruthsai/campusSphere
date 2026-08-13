import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * LinkButton – same visual system as Button but renders as a React Router <Link>.
 * variant: "primary" | "secondary" | "ghost" | "icon"
 * size: "sm" | "md" | "lg"
 */
const variants = {
  primary: 'relative overflow-hidden bg-gradient-to-r from-[#00E5FF] via-cyan-300 to-[#00E5FF] text-slate-950 font-bold border border-[rgba(0,229,255,0.3)] shadow-[0_0_22px_rgba(0,229,255,0.35)] hover:shadow-[0_0_42px_rgba(0,229,255,0.6)]',
  secondary: 'relative overflow-hidden bg-gradient-to-r from-[#7B61FF] via-violet-400 to-[#7B61FF] text-white font-bold border border-[rgba(123,97,255,0.35)] shadow-[0_0_22px_rgba(123,97,255,0.35)] hover:shadow-[0_0_42px_rgba(123,97,255,0.6)]',
  ghost: 'relative overflow-hidden bg-white/[0.06] border border-white/[0.13] text-white font-semibold backdrop-blur-md hover:bg-white/[0.11] hover:border-white/25 hover:text-[#00E5FF]',
  icon: 'relative overflow-hidden bg-white/[0.07] border border-white/[0.12] text-white backdrop-blur-md hover:bg-white/[0.13] hover:text-[#00E5FF] hover:border-[rgba(0,229,255,0.3)]',
};

const sizes = {
  sm: 'h-8  px-3.5 text-xs  gap-1.5 rounded-xl',
  md: 'h-10 px-5   text-sm  gap-2   rounded-xl',
  lg: 'h-12 px-7   text-sm  gap-2.5 rounded-2xl',
};

export default function LinkButton({ to, children, variant = 'primary', size = 'md', className = '' }) {
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="inline-flex"
    >
      <Link
        to={to}
        className={[
          'inline-flex items-center justify-center font-sans tracking-tight transition-all select-none',
          sizes[size] ?? sizes.md,
          variants[variant] ?? variants.primary,
          className,
        ].filter(Boolean).join(' ')}
      >
        {/* shimmer sweep */}
        {(variant === 'primary' || variant === 'secondary') && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/[0.18] transition-transform duration-700 group-hover:translate-x-[200%]"
          />
        )}
        {children}
      </Link>
    </motion.div>
  );
}
