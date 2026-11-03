import type { Config } from "tailwindcss";
import preset from "../../packages/config/tailwind-preset.js";

const config: Config = {
  darkMode: "class",
  presets: [preset],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          glass: "var(--surface-glass)",
          raised: "var(--surface-raised)",
        },
        fg: {
          DEFAULT: "var(--fg)",
          2: "var(--fg-2)",
          muted: "var(--fg-muted)",
        },
        "border-control": "var(--border-control)",
        "accent-text": "var(--accent-text)",
        "on-accent": "var(--on-accent)",
        accent: "var(--accent)",
        border: "var(--border)",
      },
    },
  },
  plugins: [],
};

export default config;
