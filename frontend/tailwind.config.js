/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        teal: "#0D9488",
        tealLight: "#2DD4BF",
        slateDeep: "#0F172A",
        slate: "#334155",
        amber: "#F59E0B",
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
        info: "#3B82F6"
      },
      borderRadius: {
        premium: "14px"
      },
      boxShadow: {
        premium: "0 10px 30px rgba(2, 6, 23, 0.14)"
      }
    }
  },
  plugins: []
};
