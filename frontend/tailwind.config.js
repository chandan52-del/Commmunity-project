/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          800: '#0F2744',
        },
        teal: {
          DEFAULT: '#0D9488',
          400: '#14B8A6',
        },
        page: '#F8FAFC',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(11, 31, 58, 0.08)',
      },
      borderRadius: {
        card: '16px',
      },
    },
  },
  plugins: [],
}
