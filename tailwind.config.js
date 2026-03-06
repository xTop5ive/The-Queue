/** @type {import('tailwindcss').Config} */

const colors = require("tailwindcss/colors")

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // The Queue — luxury club palette
        ink: "#0A0B10",          // near-black
        midnight: "#0E1020",     // deep navy/black
        plum: "#5B2EFF",         // accent purple
        violet: "#7C3AED",       // secondary accent
        gold: "#D4AF37",         // gold highlight
        fog: "rgba(255,255,255,0.72)",
        line: "rgba(255,255,255,0.10)",

        // Optional aliases so existing components that use `primary` don't break
        primary: "#5B2EFF",
      },
      screens: {
        'mobile':  "960px",
        '0.5xl': '1125px',
        '3xl': '2560px',
      },
      maxWidth: {
        'mainSection': 'calc(100% - 35rem)',
      },
    },
  },
  plugins: [],
}
