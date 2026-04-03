import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drippay — Smart Payment Streams",
  description: "Stream USDC over time with smart conditions. Powered by Arc Network.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
