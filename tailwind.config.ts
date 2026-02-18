import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shadcn semantics (mapped in globals.css to dark theme)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // App design tokens (neutral, desaturated, mobile-friendly)
        app: "#020617",
        page: "#020819",
        surface: "#0b1120",
        "surface-alt": "#0f172a",
        "surface-elevated": "#1e293b",
        "border-app": "rgba(148, 163, 184, 0.25)",
        "border-strong": "rgba(148, 163, 184, 0.6)",
        "tab-selected": "#020819",
        "tab-indicator": "#0ea5e9",
        "accent-steel": "#64748b",
        "accent-cyan": "#0ea5e9",
        chip: "rgba(148, 163, 184, 0.18)",
        "chip-user": "rgba(148, 163, 184, 0.5)",
        success: "#22C55E",
        warning: "#F59E0B",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        // Shadcn fallback
        "shadcn-lg": "var(--radius)",
        "shadcn-md": "calc(var(--radius) - 2px)",
        "shadcn-sm": "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "card-soft": "0 10px 30px rgba(0,0,0,0.35)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "sans-serif",
        ],
        display: [
          "var(--font-space-grotesk)",
          "Space Grotesk",
          "var(--font-inter)",
          "sans-serif",
        ],
        body: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        logo: [
          "var(--font-righteous)",
          "Righteous",
          "sans-serif",
        ],
      },
      fontSize: {
        "city-name": ["1.25rem", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        "tab-label": ["0.8125rem", { lineHeight: "1.3" }],
        "card-title": ["1rem", { lineHeight: "1.4" }],
        metadata: ["0.75rem", { lineHeight: "1.3" }],
        body: ["0.875rem", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};

export default config;
