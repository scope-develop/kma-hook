/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kma: {
          base: '#0B0C10',
          surface: '#11131A',
          elevated: '#181B24',
          hover: '#1E2130',
          border: '#252836',
          'border-subtle': '#191C27',
        },
        accent: {
          DEFAULT: '#2B9FD4',
          dim: '#1E7BA8',
          bright: '#4DB8E8',
          bg: 'rgba(43, 159, 212, 0.08)',
          'bg-hover': 'rgba(43, 159, 212, 0.13)',
          border: 'rgba(43, 159, 212, 0.2)',
        },
        teal: {
          DEFAULT: '#5BB8C4',
          dim: '#3D99A6',
          bright: '#7ECFDA',
          bg: 'rgba(91, 184, 196, 0.08)',
          border: 'rgba(91, 184, 196, 0.2)',
        },
        steel: {
          DEFAULT: '#8FA8BE',
          dim: '#6889A2',
          bright: '#B0C8DC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
