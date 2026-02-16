import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#7da03c"
        },
        brand: {
          green: "#7da03c",
          orange: "#e55f15",
          deep: "#21502c",
          red: "#f52e18",
          yellow: "#f9b61a"
        }
      }
    }
  },
  plugins: []
} satisfies Config;
