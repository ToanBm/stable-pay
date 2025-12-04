/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        'brand-primary': '#007B50',
        'brand-light': '#E8F5E9',
        'brand-dark': '#0C3223',
      },
    },
  },
  plugins: [],
}
