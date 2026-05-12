"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MarketingHero } from "@/components/home/marketing-hero";
import { ProcessSection } from "@/components/home/process-section";
import { EditingTimeline } from "@/components/home/editing-timeline";
import { ComparisonSection } from "@/components/home/comparison-section";
import { PricingSection } from "@/components/home/pricing-section";
import { FAQSection } from "@/components/home/faq-section";
import { FuturisticCTA } from "@/components/futuristic-cta";

export default function Home() {
  return (
    <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-blue-600 selection:text-white relative font-sans">
      <Navbar />

      <MarketingHero />
      
      <ProcessSection />

      <ComparisonSection />
      
      <PricingSection />
      
      <FAQSection />

      <FuturisticCTA />

      <EditingTimeline />

      <Footer />
    </main>
  );
}
