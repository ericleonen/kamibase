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
        "theme-white": "var(--theme-white)",
        "theme-black": "var(--theme-black)",
        "theme-light-gray": "var(--theme-light-gray)",
        "theme-gray": "var(--theme-gray)",
        "theme-dark-gray": "var(--theme-dark-gray)",
        "theme-darker-gray": "var(--theme-darker-gray)",
        "theme-yellow": "var(--theme-yellow)"
      }
    },
  },
  plugins: [],
};
export default config;
