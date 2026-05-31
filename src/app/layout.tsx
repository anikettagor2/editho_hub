import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

import { Outfit } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EditoHub | Premium Video Editing Agency",
  description: "Transform your raw footage into cinematic masterpieces. Professional video editing, scriptwriting, and thumbnail design.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

import { SmoothScroll } from "@/components/smooth-scroll";
import { ContactProvider } from "@/providers/contact-provider";
import { ContactModal } from "@/components/contact-modal";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { GlobalVideoWatermark } from "@/components/global-video-watermark";
import { GlobalVideoOptimizer } from "@/components/global-video-optimizer";
import { CacheConsentPopup } from "@/components/cache-consent";
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-1784252024159170" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1784252024159170"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          inter.variable,
          poppins.variable,
          outfit.variable,
          "antialiased bg-background text-foreground min-h-screen selection:bg-primary/20 selection:text-primary font-sans"
        )}
      >
        <Providers>
          <ContactProvider>
             <GlobalVideoOptimizer />
             <GlobalVideoWatermark />
             <SmoothScroll />
             <ContactModal />
             <Toaster position="top-center" richColors />
             <CacheConsentPopup />
             <Analytics />
             {children}
          </ContactProvider>
        </Providers>
      </body>
    </html>
  );
}
