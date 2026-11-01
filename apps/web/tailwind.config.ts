import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f19",
          900: "#111827",
          800: "#1f2937",
          700: "#374151",
        },
        accent: {
          DEFAULT: "#6366f1",
          soft: "#818cf8",
          muted: "#4f46e5",
        },
      },
      boxShadow: {
        panel: "0 8px 30px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;