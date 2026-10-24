/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
