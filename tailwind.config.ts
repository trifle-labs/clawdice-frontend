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
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#E879A0",
          dark: "#D35D8A",
          light: "#F5A0C0",
        },
        accent: {
          DEFAULT: "#B8A9E8",
          dark: "#9B8AD4",
          light: "#D4C8F5",
        },
        mint: {
          DEFAULT: "#A8E6CF",
          dark: "#7DD4B0",
          light: "#C8F5E5",
        },
        cream: {
          DEFAULT: "#FFF5E6",
          dark: "#FFE8CC",
          light: "#FFFAF2",
        },
        claw: {
          DEFAULT: "#C94B4B",
          dark: "#A83939",
          light: "#E06565",
        },
        success: "#7DD4B0",
        danger: "#E06565",
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        display: ["Fredoka One", "cursive"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-left": "slideLeft 30s linear infinite",
        "sparkle": "sparkle 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 3s linear infinite",
      },
      keyframes: {
        slideLeft: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        sparkle: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
