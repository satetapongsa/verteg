/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        exchangeBg: '#0A0E17',
        exchangeCard: '#111827',
        exchangeInput: '#1F2937',
        exchangeBlue: '#2563EB',
        exchangeGreen: '#22C55E',
        exchangeRed: '#EF4444',
        exchangeGray: '#9CA3AF'
      }
    },
  },
  plugins: [],
}
