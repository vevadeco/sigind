import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#2a2a2a",
          panel: "#333333",
          border: "#4a4a4a",
          lime: "#32cd32",
          "lime-bright": "#7fff00",
          muted: "#9bdc9b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
