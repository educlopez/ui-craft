/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        signal: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel:
          "0 1px 1px rgba(0,0,0,0.24), 0 8px 24px -8px rgba(0,0,0,0.55), 0 24px 48px -24px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
