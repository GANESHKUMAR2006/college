/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // support class-based dark mode
  theme: {
    extend: {
      colors: {
        // Vibrant modern color palette
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#adc2ff',
          400: '#7fa0ff',
          500: '#4f73ff', // electric blue
          600: '#3850db',
          700: '#2a3bb3',
          800: '#212f8f',
          900: '#1b2470',
        },
        darkbg: '#0f172a', // slate-900
        darkcard: '#1e293b', // slate-800
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
