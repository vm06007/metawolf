/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "*.{js,ts,jsx,tsx,mdx}"
],
  theme: {
    extend: {
      screens: {
        short: { raw: "(max-height: 748px)" },
      },
      spacing: {
        inset: "var(--inset)",
        sides: "var(--sides)",
        "footer-safe-area": "var(--footer-safe-area)",
      },
      backgroundImage: {
        "gradient-primary":
          "linear-gradient(90deg,rgba(255,255,255, 0.1) 0%,rgba(255,255,255, 0.4) 100%),rgba(85,85,85,0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionProperty: {
        "colors-and-shadows":
          "color, background-color, border-color, text-decoration-color, fill, stroke, box-shadow",
      },
      animation: {
        shine: "shine 2s ease-in-out infinite",
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "serif"],
      },
      boxShadow: {
        button:
          "inset 0 0 1px 1px rgba(255, 255, 255, 0.05), inset 0 0 2px 1px rgba(255, 255, 255, 0.2), inset -1px -1px 1px 0px rgba(0, 0, 0, 0.0), 0 0 10px 0 rgba(255, 255, 255, 0.1)",
        "button-hover":
          "inset 0 0 5px 1px rgba(255, 255, 255, 0.2), inset 0.5px 0.5px 1px 0.5px rgba(255, 255, 255, 0.5), inset -0.5px -0.5px 0.5px 0.5px rgba(0, 0, 0, 0.2), 0 0 12px 4px rgba(255, 255, 255, 0.5)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
    },
  },
  plugins: [import("tailwindcss-animate")],
};
