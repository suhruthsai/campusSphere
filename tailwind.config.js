/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#020510',
        primary: '#00E5FF',
        secondary: '#7B61FF',
        accent: '#00FFB3',
        panel: 'rgba(255, 255, 255, 0.07)',
        'glass-white': 'rgba(255,255,255,0.09)',
        'glass-border': 'rgba(255,255,255,0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        glow:        '0 0 40px rgba(0, 229, 255, 0.30)',
        'glow-sm':   '0 0 20px rgba(0, 229, 255, 0.20)',
        violet:      '0 0 44px rgba(123, 97, 255, 0.28)',
        'violet-sm': '0 0 22px rgba(123, 97, 255, 0.18)',
        accent:      '0 0 40px rgba(0, 255, 179, 0.25)',
        glass:       '0 8px 40px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.07) inset',
      },
      animation: {
        float:      'float 7s ease-in-out infinite',
        scan:       'scan 5s linear infinite',
        pulseGlow:  'pulseGlow 2.8s ease-in-out infinite',
        shimmer:    'shimmer 2.4s linear infinite',
        aurora:     'aurora 12s ease-in-out infinite',
        blink:      'blink 1.4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.72', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.4)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        aurora: {
          '0%':   { transform: 'translate(0, 0) scale(1)' },
          '33%':  { transform: 'translate(40px, -30px) scale(1.08)' },
          '66%':  { transform: 'translate(-30px, 20px) scale(0.95)' },
          '100%': { transform: 'translate(0, 0) scale(1)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
