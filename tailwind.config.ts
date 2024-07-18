import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        "theme-light-white": "rgb(var(--theme-light-white) / <alpha-value>)",
        "theme-white": "rgb(var(--theme-white) / <alpha-value>)",
        "theme-dark-white": "rgb(var(--theme-dark-white) / <alpha-value>)",
        "theme-light-black": "rgb(var(--theme-light-black) / <alpha-value>)",
        "theme-black": "rgb(var(--theme-black) / <alpha-value>)",
        "theme-dark-black": "rgb(var(--theme-dark-black) / <alpha-value>)",
        "theme-light-gray": "rgb(var(--theme-light-gray) / <alpha-value>)",
        "theme-gray": "rgb(var(--theme-gray) / <alpha-value>)",
        "theme-dark-gray": "rgb(var(--theme-dark-gray) / <alpha-value>)",
        "theme-darker-gray": "rgb(var(--theme-darker-gray) / <alpha-value>)",
        "theme-yellow": "rgb(var(--theme-yellow) / <alpha-value>)",
        "theme-red": "rgb(var(--theme-red) / <alpha-value>)",
        "theme-blue": "rgb(var(--theme-blue) / <alpha-value>)"
      }
    },
  },
  plugins: [],
};
export default config;
