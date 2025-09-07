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
  title: "Deviens un boss en français 🤓🇫🇷💪",
  description: "Devenez un boss en français",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
