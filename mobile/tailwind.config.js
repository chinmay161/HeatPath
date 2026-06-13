/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        hotRed: "#FF4444",
        orange: "#FF8C00",
        yellow: "#FFD700",
        coolGreen: "#22C55E",
      },
    },
  },
  plugins: [],
}
