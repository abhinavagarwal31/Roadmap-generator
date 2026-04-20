/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-driven palette (values come from CSS variables)
        bg: {
          primary: "var(--color-bg-primary)",
          card: "var(--color-bg-card)",
          elevated: "var(--color-bg-elevated)",
        },
        accent: {
          red: "#e50914",
          redHover: "#f40612",
          redDim: "#b20710",
        },
        node: {
          locked: "#3a3a3a",
          unlocked: "#e50914",
          completed: "#1db954",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
