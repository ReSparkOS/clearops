import type { Metadata } from "next";
import { Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clearcloseiq.com"),
  title: {
    default: "Clear Close IQ",
    template: "%s | Clear Close IQ",
  },
  description: "Intelligent transaction coordination for real estate deal packets.",
  icons: {
    icon: [
      { url: "/brand/clearcloseiq-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/clearcloseiq-favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/brand/clearcloseiq-app-icon-light.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
