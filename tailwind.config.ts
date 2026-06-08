import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pf: {
          blue: "#2563eb",
          up: "#e5484d",
          down: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
