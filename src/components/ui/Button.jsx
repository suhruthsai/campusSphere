import { motion } from 'framer-motion';
import { forwardRef } from 'react';

/**
 * CampusSphere unified Button component
 *
 * variant:
 *   "primary"   – cyan gradient with glow, dark text
 *   "secondary" – violet/purple gradient glow
 *   "ghost"     – glass border, white text → cyan on hover
 *   "danger"    – red tint glass
 *   "icon"      – square icon button (glass)
 *
 * size: "sm" | "md" | "lg"
 */
const variants = {
  primary: {
    base: 'relative overflow-hidden bg-gradient-to-r from-[#00E5FF] via-cyan-300 to-[#00E5FF] text-slate-950 font-bold shadow-[0_0_22px_rgba(0,229,255,0.35)] border border-[rgba(0,229,255,0.3)]',
    hover: {},
    tap: {},
    shimmer: true,
  },
  secondary: {
    base: 'relative overflow-hidden bg-gradient-to-r from-[#7B61FF] via-violet-400 to-[#7B61FF] text-white font-bold shadow-[0_0_22px_rgba(123,97,255,0.35)] border border-[rgba(123,97,255,0.35)]',
    hover: {},
    tap: {},
    shimmer: true,
  },
  ghost: {
    base: 'relative overflow-hidden bg-white/[0.06] border border-white/[0.13] text-white font-semibold backdrop-blur-md',
    hover: {},
    tap: {},
    shimmer: false,
  },
  danger: {
    base: 'relative overflow-hidden bg-red-500/10 border border-red-500/25 text-red-400 font-semibold backdrop-blur-md',
    hover: {},
    tap: {},
    shimmer: false,
  },
  icon: {
    base: 'relative overflow-hidden bg-white/[0.07] border border-white/[0.12] text-white backdrop-blur-md',
    hover: {},
    tap: {},
    shimmer: false,
  },
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
    ...rest
  },
  ref,
) {
  const v = variants[variant] ?? variants.primary;
  const isIcon = variant === 'icon';
  const sizeKey = isIcon ? `icon_${size}` : size;
  const sizeClass = sizes[sizeKey] ?? sizes.md;

  return (
    <motion.button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { scale: 1.04, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={[
        'inline-flex items-center justify-center font-sans transition-all select-none',
        isIcon ? '' : 'tracking-tight',
        sizeClass,
        v.base,
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        // hover glow via group
        variant === 'primary'   ? 'hover:shadow-[0_0_38px_rgba(0,229,255,0.55)]' : '',
        variant === 'secondary' ? 'hover:shadow-[0_0_38px_rgba(123,97,255,0.55)]' : '',
        variant === 'ghost'     ? 'hover:bg-white/[0.11] hover:border-white/25 hover:text-[#00E5FF]' : '',
        variant === 'danger'    ? 'hover:bg-red-500/20 hover:border-red-500/40' : '',
        variant === 'icon'      ? 'hover:bg-white/[0.13] hover:border-[rgba(0,229,255,0.3)] hover:text-[#00E5FF]' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* Shimmer sweep for primary/secondary */}
      {v.shimmer && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/20 transition-transform duration-700 group-hover:translate-x-[200%]"
        />
      )}
      {/* Ripple pulse for primary on hover */}
      {variant === 'primary' && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-inherit opacity-0 ring-2 ring-[#00E5FF] transition-opacity hover:opacity-30"
        />
      )}
      {children}
    </motion.button>
  );
});

export default Button;
