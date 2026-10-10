/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          container: "#d8ec8d",
          "on-container": "#5b6b1b",
          fixed: "#d8ec8d",
          "fixed-dim": "#bccf74",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          container: "#bd0183",
          "on-container": "#ffd5e6",
          fixed: "#ffd8e8",
          "fixed-dim": "#ffafd5",
        },
        tertiary: {
          DEFAULT: "#ffffff",
          container: "#dae2fc",
          fixed: "#dae2fc",
          "fixed-dim": "#bec6df",
        },
        surface: {
          DEFAULT: "#131313",
          dim: "#131313",
          bright: "#3a3939",
          variant: "#353534",
          tint: "#bccf74",
          container: {
            lowest: "#0e0e0e",
            low: "#1c1b1b",
            DEFAULT: "#201f1f",
            high: "#2a2a2a",
            highest: "#353534",
          },
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "3rem",
        "2xl": "3.5rem",
        full: "9999px",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        "space-xs": "0.375rem",
        "space-sm": "0.75rem",
        "space-md": "1.25rem",
        "space-lg": "2rem",
        "space-xl": "3rem",
        gutter: "1.5rem",
        "gutter-mobile": "1rem",
        margin: "2.5rem",
        "margin-mobile": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-urbanist)", "system-ui", "sans-serif"],
        heading: ["var(--font-urbanist)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [],
};
