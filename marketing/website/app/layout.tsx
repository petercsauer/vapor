import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vapor — Terminal, dissolved.",
  description: "Frosted-glass macOS terminal with split panes, SSH and Docker detection, and a code editor that lives next to your shell.",
  keywords: ["terminal", "macos", "electron", "xterm", "split panes", "ssh", "docker"],
  authors: [{ name: "Peter Sauer" }],
  openGraph: {
    title: "Vapor — Terminal, dissolved.",
    description: "Frosted-glass macOS terminal with split panes, SSH and Docker detection, and a built-in editor.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
