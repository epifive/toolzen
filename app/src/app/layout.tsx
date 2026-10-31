import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";

// Fonts ship with the project (SIL Open Font License) so no third-party CDN is contacted.
const body = localFont({
  src: "../fonts/instrument-sans.woff2",
  variable: "--font-body",
  weight: "400 700",
  display: "swap",
});

const display = localFont({
  src: "../fonts/bricolage-grotesque.woff2",
  variable: "--font-display-face",
  weight: "200 800",
  display: "swap",
});

const code = localFont({
  src: "../fonts/jetbrains-mono.woff2",
  variable: "--font-code",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${body.variable} ${display.variable} ${code.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
