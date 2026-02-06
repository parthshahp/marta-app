import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARTA Realtime",
  description: "Realtime MARTA rail arrivals by station and line.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
