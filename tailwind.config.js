/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1E40AF',
          50: '#eff4ff',
          100: '#dbe6fe',
          600: '#1E40AF',
          700: '#1c3aa0',
          800: '#1a3490',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
