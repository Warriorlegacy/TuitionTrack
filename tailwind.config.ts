import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Marketing tokens (Blueprint #77) — rgb channels so /opacity modifiers work
        tt: {
          hero: "rgb(var(--tt-hero-rgb) / <alpha-value>)",
          herodeep: "rgb(var(--tt-hero-deep-rgb) / <alpha-value>)",
          ivory: "rgb(var(--tt-ivory-rgb) / <alpha-value>)",
          ink: "rgb(var(--tt-ink-rgb) / <alpha-value>)",
          accent: "rgb(var(--tt-accent-rgb) / <alpha-value>)",
          amber: "rgb(var(--tt-amber-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Marketing tokens (Blueprint #77) — mirror of --tt-radius-* in globals.css
        "tt-sm": "var(--tt-radius-sm)",
        "tt-md": "var(--tt-radius-md)",
        "tt-lg": "var(--tt-radius-lg)",
        "tt-xl": "var(--tt-radius-xl)",
      },
      fontFamily: {
        // ponytail: reuse Geist vars already loaded in layout, no new webfonts
        "tt-display": ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        "tt-mono": ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 18px 40px -26px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
