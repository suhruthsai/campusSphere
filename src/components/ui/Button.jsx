import { motion } from 'framer-motion';
import { forwardRef } from 'react';

/**
 * CampusSphere unified Button component (colours follow the theme tokens in styles.css)
 *
 * variant:
 *   "primary"   – brand gradient, white text
 *   "secondary" – tinted violet
 *   "ghost"     – quiet glass button
 *   "danger"    – red tint
 *   "icon"      – square icon button
 *
 * size: "sm" | "md" | "lg"
 */
const variants = {
  primary: 'border-0 text-white font-bold hover:brightness-110',
  secondary: 'border font-bold text-[var(--text)] hover:brightness-110',
  ghost: 'border font-semibold text-[var(--text)] hover:bg-[var(--surface-hover)]',
  danger: 'border font-semibold text-rose-500 hover:bg-rose-500/20',
  icon: 'border text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
};

const variantStyle = {
  primary: { background: 'var(--brand-grad)', boxShadow: '0 6px 20px rgba(99,102,241,0.32)' },
  secondary: { background: 'color-mix(in srgb, var(--brand-2) 18%, transparent)', borderColor: 'color-mix(in srgb, var(--brand-2) 45%, transparent)' },
  ghost: { background: 'var(--surface-2)', borderColor: 'var(--border-strong)' },
  danger: { background: 'rgba(244,63,94,0.10)', borderColor: 'rgba(244,63,94,0.35)' },
  icon: { background: 'var(--surface-2)', borderColor: 'var(--border)' },
};

const sizes = {
  sm:   'h-8  px-3.5  text-xs  gap-1.5 rounded-xl',
  md:   'h-10 px-5    text-sm  gap-2   rounded-xl',
  lg:   'h-12 px-7    text-sm  gap-2.5 rounded-2xl',
  icon_sm: 'h-8  w-8  rounded-xl',
  icon_md: 'h-10 w-10 rounded-xl',
  icon_lg: 'h-12 w-12 rounded-2xl',
};

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    onClick,
    type = 'button',
    'aria-label': ariaLabel,
    style,
    ...rest
  },
  ref,
) {
  const key = variants[variant] ? variant : 'primary';
  const isIcon = key === 'icon';
  const sizeClass = sizes[isIcon ? `icon_${size}` : size] ?? sizes.md;

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{ ...variantStyle[key], ...style }}
      className={[
        'inline-flex items-center justify-center font-sans transition-all select-none',
        isIcon ? '' : 'tracking-tight',
        sizeClass,
        variants[key],
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

export default Button;
