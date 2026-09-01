import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Controle de dívida",
    template: "%s · Controle de dívida",
  },
  description: "Acompanhamento de pagamentos, saldo devedor e quitação.",
  // Plataforma privada: fora dos buscadores.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} min-h-screen bg-slate-50 font-sans text-slate-900 antialiased print:bg-white`}>
        {children}
      </body>
    </html>
  );
}
