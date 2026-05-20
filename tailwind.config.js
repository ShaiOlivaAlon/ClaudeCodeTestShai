/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07070d',
          900: '#0b0b14',
          850: '#11111c',
          800: '#161624',
          700: '#1d1d2e',
          600: '#262638',
          500: '#3a3a52',
          400: '#5a5a78',
          300: '#8a8aaa',
          200: '#b8b8d0',
          100: '#e4e4ef',
        },
        brand: {
          50:  '#f3edff',
          100: '#e3d3ff',
          200: '#c9aaff',
          300: '#a875ff',
          400: '#8b4dff',
          500: '#7029ff',
          600: '#5d15e8',
          700: '#4a0dbc',
          800: '#380a8e',
          900: '#260766',
        },
        accent: {
          400: '#ff6ec7',
          500: '#ff3aa8',
          600: '#e21f8e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(168,117,255,0.35), 0 8px 30px rgba(112,41,255,0.35)',
        soft: '0 8px 24px rgba(0,0,0,0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg,#7029ff 0%,#ff3aa8 100%)',
        'panel-gradient': 'linear-gradient(180deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      },
    },
  },
  plugins: [],
};
