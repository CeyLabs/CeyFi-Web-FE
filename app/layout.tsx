import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { Frame, Toast } from "@/components/shell";
import { PrivyAuth } from "@/components/signin";
import { AddBankDialog } from "@/components/account/add-bank";
import { Providers } from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
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
  title: "CeyFi",
  description: "Sell USDT to your bank, send rupees home, and pay bills with USDT through Binance, Bybit or KuCoin Pay.",
  applicationName: "CeyFi",
  // Opaque bar: the layout has no top safe-area padding, so a translucent one would sit over content.
  appleWebApp: { capable: true, title: "CeyFi", statusBarStyle: "black" },
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
        {/* Base UI popups portal outside this root; isolating it keeps them above any z-index inside. */}
        <div className="isolate">
          <Providers>
            <NuqsAdapter>
              <Suspense>
                <Frame>{children}</Frame>
              </Suspense>
              <PrivyAuth />
              <AddBankDialog />
              <Toast />
              <ServiceWorker />
            </NuqsAdapter>
          </Providers>
        </div>
      </body>
    </html>
  );
}
