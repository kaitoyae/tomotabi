/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Noto Sans JP', 'system-ui', '-apple-system', 'sans-serif'],
        'logo': [
          'Noto Sans JP',
          'system-ui',
          '-apple-system',
          'sans-serif'
        ],
      },
    },
  },
  plugins: [],
}