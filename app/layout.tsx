import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ფსიქოლოგიური ქეისების პორტალი",
  description: "კლიენტების დაცული ქეისები, ფსიქომეტრიული ტესტები, QEEG და PDF ანგარიშები",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ka">
      <body className="antialiased">{children}</body>
    </html>
  );
}
