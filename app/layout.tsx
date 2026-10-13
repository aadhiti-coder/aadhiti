import type { Metadata, Viewport } from "next";
import { Baloo_2, Mukta, Tiro_Devanagari_Marathi } from "next/font/google";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import WebAnalytics from "@/components/WebAnalytics";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

// Both cover Latin and Devanagari (Marathi & Hindi).
const body = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

// Serif for editorial headlines on the home page.
const serif = Tiro_Devanagari_Marathi({
  subsets: ["latin", "devanagari"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-tiro",
});

const heading = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "आधी ती · AADHI TI — तिच्या प्रत्येक प्रश्नासाठी",
  description: "A Women's Information & Support Assistant in Marathi, English and Hindi — safety, health, rights, education, income and family.",
};

export const viewport: Viewport = {
  themeColor: "#7e1738",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mr" className={`${body.variable} ${heading.variable} ${serif.variable}`}>
      <body className="bg-mesh min-h-screen pb-20 font-sans antialiased lg:pb-0">
        <LangProvider>
          <Navbar />
          <main className="mx-auto max-w-6xl px-4">{children}</main>
          <Footer />
          <BottomNav />
        </LangProvider>
        <WebAnalytics />
      </body>
    </html>
  );
}
