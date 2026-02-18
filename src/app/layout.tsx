import type { Metadata, Viewport } from "next";
import { inter, spaceGrotesk, righteous } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Localist — Buenos Aires",
  description: "Your AI-powered social life planner for Buenos Aires",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${righteous.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
