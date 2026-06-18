/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0E17',
        card: '#111827',
        accentBlue: '#2563EB',
        successGreen: '#22C55E',
        errorRed: '#EF4444',
        darkGray: '#1F2937',
        textMuted: '#9CA3AF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
