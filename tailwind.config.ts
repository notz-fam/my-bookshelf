import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shelf: {
          wood: "#8B5E3C",
          woodDark: "#5C3D1E",
          woodLight: "#C49A6C",
          shadow: "#3B1F0E",
        },
      },
    },
  },
  plugins: [],
};

export default config;
