/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.html",
    "./src/renderer-process/**/*.{js,jsx,ts,tsx}", // Include React components
    "./src/renderer.ts" // Include main renderer entry
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
