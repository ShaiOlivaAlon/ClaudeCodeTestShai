/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08070d',
          900: '#0d0c14',
          800: '#15131f',
          700: '#1d1a2c',
          600: '#272338',
          500: '#3b3553',
          400: '#605880',
          300: '#8b83a8',
          200: '#c5bedc',
          100: '#ece9f5',
        },
        accent: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        electric: {
          400: '#38bdf8',
          500: '#06b6d4',
          600: '#0891b2',
        },
        hot: {
          400: '#fb7185',
          500: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'studio-gradient':
          'radial-gradient(1200px 600px at 10% -10%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(56,189,248,0.12), transparent 60%), linear-gradient(180deg, #08070d 0%, #0d0c14 100%)',
        'accent-gradient':
          'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #38bdf8 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(168,85,247,0.35), 0 8px 30px rgba(168,85,247,0.25)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 30px rgba(0,0,0,0.35)',
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
