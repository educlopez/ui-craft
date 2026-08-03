/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          0: "var(--gray-0)",
          1: "var(--gray-1)",
          2: "var(--gray-2)",
          3: "var(--gray-3)",
          6: "var(--gray-6)",
          7: "var(--gray-7)",
          9: "var(--gray-9)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          tint: "var(--accent-tint)",
        },
        "on-accent": "var(--on-accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        input: "var(--radius-input)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        overlay: "var(--shadow-overlay)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
