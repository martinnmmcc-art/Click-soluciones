/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./context/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#1560D4",
          blueDark: "#0E3F91",
          orange: "#FF7A1A",
          orangeDark: "#E4600A",
          bg: "#F7F9FC"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
