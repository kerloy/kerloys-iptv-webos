/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs: ['0.85rem', { lineHeight: '1.25rem' }],
        sm: ['0.96rem', { lineHeight: '1.4rem' }],
        base: ['1.08rem', { lineHeight: '1.55rem' }],
        lg: ['1.25rem', { lineHeight: '1.7rem' }],
        xl: ['1.45rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem' }],
        '3xl': ['2.15rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.65rem', { lineHeight: '2.95rem' }],
        '5xl': ['3.25rem', { lineHeight: '3.5rem' }],
      },
      colors: {
        tv: {
          bg: '#070B14',
          surface: '#0F1626',
          card: '#161F35',
          border: '#253252',
          accent: '#38BDF8',
          primary: '#6366F1',
          gold: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
