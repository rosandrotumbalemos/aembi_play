import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Mesma tipografia do painel (PROJECT_BRIEF.md seção 9.3): Geist para texto
// e títulos, Geist Mono para os poucos detalhes técnicos (ciclo, hash etc).
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aembi Play — Sinalização digital em rede",
  description:
    "Cadastre anunciantes, monte a programação de cada tela e acompanhe tudo em um único painel — mesmo se a internet cair.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
