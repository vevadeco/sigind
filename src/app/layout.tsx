import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEXC Trading Scanner",
  description: "Automated MEXC futures trading signal scanner and chart analyzer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-terminal-bg text-terminal-lime antialiased">{children}</body>
    </html>
  );
}
