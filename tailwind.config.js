/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./node_modules/flowbite/**/*.js",
    "node_modules/flowbite-vue/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    darkMode: 'class',
    extend: {
      gridTemplateColumns: {
        '12': 'repeat(12, minmax(0, 1fr))'
      },
      maxWidth: {
        '25p': '25%',
      }
    },
  },
  plugins: [
    require('flowbite/plugin'),
  ],
}

