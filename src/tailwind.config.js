/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', 
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Adjusted to cover all relevant files in src
    "./index.html"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'), // Add DaisyUI plugin
  ],
  // Optional: DaisyUI configuration (e.g., themes)
  daisyui: {
    themes: ["light", "dark", "night", "dracula"], // Add desired themes, including a dark one
    darkTheme: "night", // Set a default dark theme for DaisyUI if needed
  },
}
