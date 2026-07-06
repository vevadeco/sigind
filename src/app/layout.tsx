import { VevadeFooter } from "@/components/VevadeFooter";
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
      <body className="flex min-h-screen flex-col bg-terminal-bg text-terminal-lime antialiased">
        {children}
        <VevadeFooter />
      </body>
    </html>
  );
}
