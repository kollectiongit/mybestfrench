import Navbar from "@/components/navbar/navbar";
import { Toaster } from "@/components/ui/sonner";
import { ProfileProvider } from "@/contexts/profile-context";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "My Best French",
    template: "%s | My Best French",
  },
  description: "Devenez un boss en français",
  metadataBase: new URL("https://mybestfrench.com"),
  icons: {
    icon: [
      { url: "/favicon.ico" }, // legacy catch-all
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" }, // optional, great if you have SVG
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: "My Best French",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="apple-mobile-web-app-title" content="My Best French" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ProfileProvider
          initialProfile={null}
          initialProfiles={[]}
          serverSideAuthChecked={false}
        >
          <Navbar />
          {children}
          <Toaster />
        </ProfileProvider>
      </body>
    </html>
  );
}
