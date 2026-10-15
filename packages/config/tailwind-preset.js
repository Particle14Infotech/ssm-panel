/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.08)",
        ring: "#3B82F6",
        background: "#02040A",
        foreground: "#FFFFFF",
        "on-surface": "#FFFFFF",
        "on-background": "#FFFFFF",
        "on-surface-variant": "#94A3B8",
        outline: "rgba(255, 255, 255, 0.12)",
        "outline-variant": "rgba(255, 255, 255, 0.06)",
        error: "#EF4444",
        "error-container": "rgba(239, 68, 68, 0.15)",
        primary: {
          DEFAULT: "#2563EB",
          foreground: "#FFFFFF",
          container: "#1D4ED8",
          bright: "#3B82F6",
          glow: "#60A5FA",
        },
        "primary-container": "#1D4ED8",
        secondary: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
          container: "#1E40AF",
        },
        surface: {
          DEFAULT: "#070B16",
          dim: "#02040A",
          bright: "#0D1527",
          variant: "#0A1020",
          container: {
            lowest: "#02040A",
            low: "#050812",
            DEFAULT: "#070B16",
            high: "#0A1020",
            highest: "#0E172E",
          },
        },
        "surface-container-lowest": "#02040A",
        "surface-container-low": "#050812",
        "surface-container": "#070B16",
        "surface-container-high": "#0A1020",
        "surface-container-highest": "#0E172E",
        muted: {
          DEFAULT: "#070B16",
          foreground: "#94A3B8",
        },
        accent: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#070B16",
          foreground: "#FFFFFF",
        },
      },
      borderRadius: {
        DEFAULT: "1.25rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "2.5rem",
        full: "9999px",
        md: "1rem",
        sm: "0.75rem",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "var(--font-urbanist)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 12s linear infinite",
      },
    },
  },
  plugins: [],
};
