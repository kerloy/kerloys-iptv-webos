/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    backgroundOpacity: false,
    textOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    ringOpacity: false,
    placeholderOpacity: false,
  },
  theme: {
    extend: {
      fontSize: {
        xs: ['0.92rem', { lineHeight: '1.35rem' }],
        sm: ['1.04rem', { lineHeight: '1.48rem' }],
        base: ['1.18rem', { lineHeight: '1.65rem' }],
        lg: ['1.35rem', { lineHeight: '1.85rem' }],
        xl: ['1.58rem', { lineHeight: '2.05rem' }],
        '2xl': ['1.9rem', { lineHeight: '2.3rem' }],
        '3xl': ['2.35rem', { lineHeight: '2.7rem' }],
        '4xl': ['2.9rem', { lineHeight: '3.2rem' }],
        '5xl': ['3.5rem', { lineHeight: '3.8rem' }],
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
