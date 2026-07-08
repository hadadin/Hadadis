import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { PwaRegister } from "@/components/PwaRegister";

// Deliberately system fonts, not next/font/google — one less external
// network dependency for a household PWA that needs to load reliably.

export const metadata: Metadata = {
  title: "House Hadadi",
  description: "Household dashboard — food, cleaning, finance, tasks, notepad.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "House Hadadi",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-paper text-ink">
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
