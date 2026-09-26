import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { BottomNav, Header, Toast, View } from "@/components/shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "CeyPay: Sell, Send & Buy",
  description: "Sell USDT to your own bank account, or send rupees to family. Paid out by CEFT to any Sri Lankan bank.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NuqsAdapter>
          <Header />
          <main id="app" aria-live="polite" className="relative mx-auto max-w-[1080px] px-5 pt-5 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-[60px]">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-glow" />
            <Suspense>
              <View>{children}</View>
            </Suspense>
          </main>
          <Suspense>
            <BottomNav />
          </Suspense>
          <Toast />
        </NuqsAdapter>
      </body>
    </html>
  );
}
