import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { AppDownloadBanner } from "@/components/shared/app-download-banner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "TuitionTrack",
    template: "%s | TuitionTrack",
  },
  description:
    "Production-ready tuition homework, attendance, fees, and progress tracking for tutors, coaching centers, teachers, parents, and students.",
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
        <AppDownloadBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
