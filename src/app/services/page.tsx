"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import { Video, Sparkles, Layers, Zap, MousePointer2, Smartphone } from "lucide-react";

export default function ServicesPage() {
  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />
        
        {/* Service Hero */}
        <section className="relative min-h-[60vh] flex items-center justify-center pt-32 pb-20 px-6 bg-zinc-50/50">
            <div className="absolute inset-0 bg-[radial-gradient(#0066FF08_1px,transparent_1px)] [background-size:32px_32px] opacity-50" />
            <div className="relative z-10 max-w-7xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-primary font-bold text-sm uppercase tracking-[0.2em] mb-6"
                >
                    Solutions
                </motion.div>
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-8xl font-black text-zinc-900 leading-tight tracking-tight mb-8"
                >
                    Premium Video <br />
                    <span className="text-primary">Post-Production</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-zinc-600 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed"
                >
                    We provide end-to-end video solutions that help brands scale their content production without the overhead of a traditional agency.
                </motion.p>
            </div>
        </section>

        {/* Service Grid */}
        <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <ServiceCard 
                        icon={<Video className="w-6 h-6" />}
                        title="Cinematic Editing" 
                        desc="Advanced storytelling with precise pacing, narrative flow, and high-impact transitions."
                        index={1}
                    />
                    <ServiceCard 
                        icon={<Sparkles className="w-6 h-6" />}
                        title="VFX & Motion" 
                        desc="Dynamic motion graphics and visual effects that bring your abstract concepts to life."
                        index={2}
                    />
                    <ServiceCard 
                        icon={<Layers className="w-6 h-6" />}
                        title="Color Grading" 
                        desc="Professional color correction and grading to give your content a consistent, premium look."
                        index={3}
                    />
                    <ServiceCard 
                        icon={<Zap className="w-6 h-6" />}
                        title="Social Scaling" 
                        desc="Batch processing your long-form content into high-performance short-form clips."
                        index={4}
                    />
                    <ServiceCard 
                        icon={<MousePointer2 className="w-6 h-6" />}
                        title="Interactive Ads" 
                        desc="Direct response video ads engineered for high conversion rates and engagement."
                        index={5}
                    />
                    <ServiceCard 
                        icon={<Smartphone className="w-6 h-6" />}
                        title="Vertical Content" 
                        desc="Native 9:16 content optimized for TikTok, Reels, and YouTube Shorts."
                        index={6}
                    />
                </div>
            </div>
        </section>
        
        {/* Call to Action Section */}
        <section className="py-20 px-6 bg-zinc-50">
            <div className="max-w-4xl mx-auto text-center space-y-8">
                <h2 className="text-3xl md:text-5xl font-bold text-zinc-900">Ready to transform your content?</h2>
                <p className="text-zinc-600 text-lg">Join 50+ brands that trust EditoHub for their daily content needs.</p>
                <div className="flex justify-center">
                    <button className="px-10 py-5 bg-primary text-white font-bold rounded-full hover:brightness-110 transition-all shadow-xl shadow-primary/20">
                        Get a Free Quote
                    </button>
                </div>
            </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}

function ServiceCard({ title, desc, index, icon }: { title: string, desc: string, index: number, icon: React.ReactNode }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="p-10 rounded-3xl bg-white border border-zinc-100 hover:border-primary/20 hover:shadow-2xl hover:shadow-zinc-200 transition-all duration-500 group"
        >
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-8 group-hover:bg-primary group-hover:text-white transition-all">
                {icon}
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-4 group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-zinc-600 text-base leading-relaxed">{desc}</p>
        </motion.div>
    );
}
