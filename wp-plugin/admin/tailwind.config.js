/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        powder:      "#fafffd",
        raisinblack: "#232634",
        lightgrey:   "#d1d1d1",
        errorgrey:   "#898989",
      },
      fontFamily: {
        sans: ['"Open Sans"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
