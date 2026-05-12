"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AboutContent } from "@/components/about-content";
import { LenisProvider } from "@/components/home/lenis-provider";
import { CustomCursor } from "@/components/home/custom-cursor";
import { ImmersiveBackground } from "@/components/home/immersive-background";

export default function AboutPage() {
  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />
        <AboutContent />
        <Footer />
      </main>
    </LenisProvider>
  );
}
