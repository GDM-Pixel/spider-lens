/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "15px", xl: "0", "2xl": "0" },
    },
    extend: {
      colors: {
        // ── Charte GDM-Pixel (source : global.css GDM-X-Astro-V5) ──
        prussian: {
          100: "#445474",
          200: "#3c4a67",
          300: "#35415a",
          400: "#273043",
          500: "#262e40",
          600: "#1e2533",
          700: "#171c27",
        },
        dustyred: {
          100: "#e6607b",
          200: "#e34f6c",
          300: "#e13d5e",
          400: "#d62246",
          500: "#d42145",
          600: "#c21e3f",
          700: "#b01c39",
          800: "#9f1934",
        },
        moonstone: {
          100: "#1fe5ff",
          200: "#0ae2ff",
          300: "#00d8f5",
          400: "#00c6e0",
          500: "#00b2cb",
          600: "#00a2b8",
          700: "#0090a3",
          800: "#007e8f",
        },
        powder: "#fafffd",
        raisinblack: "#232634",
        lightgrey: "#d1d1d1",
        errorgrey: "#898989",
      },
      fontFamily: {
        sans: ['"Open Sans"', '"Open Sans Fallback"', "Arial", "sans-serif"],
      },
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        md: ["1.125rem", { lineHeight: "1.625rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["1.875rem", { lineHeight: "2.5rem" }],
        "3xl": ["2.25rem", { lineHeight: "3rem" }],
        "4xl": ["2.5rem", { lineHeight: "3.125rem" }],
        jumbo: ["3.75rem", { lineHeight: "5rem" }],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 18px rgba(0,0,0,0.15)",
        sidebar: "-2px 0px 8px rgba(0,0,0,0.2)",
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
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}
