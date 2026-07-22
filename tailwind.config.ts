import type { Config } from 'tailwindcss'

/**
 * Tokens mirror docs/DESIGN-SYSTEM.md exactly.
 * Colors are declared as CSS variables in globals.css so they are also
 * reachable from raw CSS, and referenced here so Tailwind utilities stay in sync.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', md: '1.5rem', lg: '2rem' },
      // Wide, modern canvas: content breathes at 1400px instead of pooling
      // whitespace at the sides on large screens.
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        blue: {
          50: 'var(--blue-50)',
          100: 'var(--blue-100)',
          500: 'var(--blue-500)',
          600: 'var(--blue-600)',
          700: 'var(--blue-700)',
          900: 'var(--blue-900)',
        },
        green: {
          50: 'var(--green-50)',
          600: 'var(--green-600)',
          700: 'var(--green-700)',
        },
        amber: {
          50: 'var(--amber-50)',
          600: 'var(--amber-600)',
          700: 'var(--amber-700)',
        },
        red: {
          50: 'var(--red-50)',
          600: 'var(--red-600)',
          700: 'var(--red-700)',
        },
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          700: 'var(--gray-700)',
          900: 'var(--gray-900)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing, fontWeight }]
        display: ['3rem', { lineHeight: '1.08', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['2.125rem', { lineHeight: '1.18', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['1.5rem', { lineHeight: '1.33', letterSpacing: '-0.01em', fontWeight: '650' }],
        h3: ['1.1875rem', { lineHeight: '1.47', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.625' }],
        'body-sm': ['0.875rem', { lineHeight: '1.571' }],
        caption: ['0.78125rem', { lineHeight: '1.44', fontWeight: '500' }],
        price: ['1.3125rem', { lineHeight: '1.33', fontWeight: '700' }],
        'price-lg': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        e1: '0 1px 2px rgb(15 23 42 / 0.06)',
        e2: '0 4px 12px rgb(15 23 42 / 0.08)',
        e3: '0 12px 32px rgb(15 23 42 / 0.12)',
      },
      transitionDuration: {
        fast: '120ms',
        medium: '160ms',
        slow: '240ms',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(.2,0,0,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
