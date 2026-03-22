import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        dali: {
          green: "#00C795",
          "green-dark": "#00A87E",
          "green-light": "#E6FFF9",
        },
        sidebar: {
          DEFAULT: "#0F1117",
          hover: "#1A1D27",
          active: "#1E2130",
          border: "#2A2D3E",
          text: "#A0A3B1",
          "text-active": "#FFFFFF",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
