import type { Config } from "tailwindcss";

/* Paleta do projeto: fundo claro com azul, verde e cinza. Usa as escalas
   padrão do Tailwind (slate, blue, emerald, amber, red) — sem tokens
   próprios, para manter o CSS pequeno e previsível. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
