import type { Metadata } from "next";
import localFont from "next/font/local";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

const display = localFont({
  src: "../../assets/fonts/Heading.ttf",
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: [
    { path: "../../assets/fonts/Poppins-Regular.ttf", weight: "400" },
    { path: "../../assets/fonts/Poppins-Medium.ttf", weight: "500" },
    { path: "../../assets/fonts/Poppins-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Imagination Lab",
  description: "Captivate Imagination Lab: key visual in, shopper tool kit out.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body>
        <TopBar />
        <main>{children}</main>
      </body>
    </html>
  );
}
