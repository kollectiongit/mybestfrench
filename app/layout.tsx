import Navbar from "@/components/navbar/navbar";
import { ServerProfileProvider } from "@/components/server-profile-provider";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/contexts/session-context";
import { auth } from "@/lib/auth";
import {
  CurrentProfile,
  getCurrentProfile,
  getUserProfiles,
} from "@/lib/current-profile";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch session and profile data server-side
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let currentProfile = null;
  let allProfiles: CurrentProfile[] = [];

  if (session) {
    // Only fetch profiles if user is authenticated
    currentProfile = await getCurrentProfile();
    allProfiles = await getUserProfiles();
  }

  return (
    <html lang="fr">
      <head>
        <meta name="apple-mobile-web-app-title" content="My Best French" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider session={session}>
          <ServerProfileProvider
            initialProfile={currentProfile}
            initialProfiles={allProfiles}
            session={session}
          >
            <Navbar />
            {children}
            <Toaster />
          </ServerProfileProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
