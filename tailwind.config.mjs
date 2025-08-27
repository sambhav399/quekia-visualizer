import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

export default {
  darkMode: 'class',
  theme: {
    fontFamily: {
      default: ['Inter', ...defaultTheme.fontFamily.sans],
      lead: ['Domine', ...defaultTheme.fontFamily.serif],
    },
    fontWeight: {
      400: '400',
      500: '500',
      600: '600',
      700: '700',
      800: '800',
    },
    colors: {
      theme: {
        0: '#ffffff',
        50: '#f7f8f9',
        100: '#f1f2f4',
        200: '#dcdfe4',
        300: '#b3b9c4',
        400: '#8590a2',
        500: '#454f59',
        600: '#2c333a',
        700: '#22272b',
        800: '#1d2125',
        900: '#161a1d',
        950: '#101214',
        1000: '#000000',
      },
      brand: {
        50: '#fbf7ef',
        100: '#f2e2c4',
        200: '#e6c7a0',
        300: '#d1a178',
        400: '#be7f58',
        500: '#a86548',
        600: '#8c5946',
        700: '#75483d',
        800: '#5f3a33',
        900: '#4c2f2a',
        950: '#2b1713',
      },
      primary: '#8c5946',
      secondary: '#f2e2c4',
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-hide::-webkit-scrollbar': {
          display: 'none',
        },
        '.btn': {
          '@apply cursor-pointer disabled:opacity-50 font-600 text-sm rounded-lg':
            {},
        },
        '.btn.btn-primary': {
          '@apply bg-primary text-theme-50': {},
        },
        '.btn.btn-secondary': {
          '@apply bg-secondary text-theme-950': {},
        },
      });
    }),
  ],
};
