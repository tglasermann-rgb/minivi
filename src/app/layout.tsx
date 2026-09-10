import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono, Jost } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jost",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "minivi os", template: "%s · minivi os" },
  description: "Portal interno de MiniVi Jewelry",
  icons: { icon: "/isotipo.svg" },
};

export const viewport: Viewport = {
  themeColor: "#221C17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jost.variable} ${dmSans.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
