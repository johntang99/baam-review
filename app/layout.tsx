import type { Metadata } from "next";
import { Fraunces, Onest } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BAAM Review",
  description:
    "The easiest way for a local business to turn happy customers into Google reviews.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-text">
        {children}
      </body>
    </html>
  );
}
