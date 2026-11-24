import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ahorro Energético Comunitario",
    template: "%s · Ahorro Energético Comunitario",
  },
  description:
    "Calcula tu consumo eléctrico, recibe recomendaciones personalizadas y participa en retos semanales de ahorro con tu comunidad (ODS 7).",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
