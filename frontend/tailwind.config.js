/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFDF5',
        ink: '#1E293B',
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#8B5CF6', // Pop violet
          600: '#7C3AED',
          700: '#6D28D9',
        },
        pop: {
          violet: '#8B5CF6',
          pink: '#F472B6',
          yellow: '#FBBF24',
          mint: '#34D399',
          sky: '#38BDF8',
          slate: '#F1F5F9',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        heading: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'pop-xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'pop-sm': '0 1px 3px 0 rgba(15, 23, 42, 0.07), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        'pop': '0 4px 12px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        'pop-lg': '0 10px 20px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)',
        'pop-xl': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        'pop-pink': '0 4px 14px 0 rgba(244, 114, 182, 0.25)',
        'pop-violet': '0 4px 14px 0 rgba(139, 92, 246, 0.25)',
        'pop-yellow': '0 4px 14px 0 rgba(251, 191, 36, 0.25)',
        'pop-mint': '0 4px 14px 0 rgba(52, 211, 153, 0.25)',
        'pop-sky': '0 4px 14px 0 rgba(56, 189, 248, 0.25)',
      },
      borderRadius: {
        'sticker': '18px',
        'blob': '24px 24px 24px 0px',
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};
