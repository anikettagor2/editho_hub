"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import Image from "next/image";

export default function PortfolioPage() {
  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />
        
        {/* Portfolio Hero */}
        <section className="relative min-h-[60vh] flex items-center justify-center pt-32 pb-20 px-6 bg-zinc-50/50">
            <div className="absolute inset-0 bg-[radial-gradient(#0066FF08_1px,transparent_1px)] [background-size:32px_32px] opacity-50" />
            <div className="relative z-10 max-w-7xl mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-primary font-bold text-sm uppercase tracking-[0.2em] mb-6"
                >
                    Case Studies
                </motion.div>
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-8xl font-black text-zinc-900 leading-tight tracking-tight mb-8"
                >
                    Our Work in <br />
                    <span className="text-primary italic">Action</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-zinc-600 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed"
                >
                    A curated selection of high-impact video projects that helped our clients achieve massive growth and engagement.
                </motion.p>
            </div>
        </section>

        {/* Portfolio Grid */}
        <section className="py-32 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <PortfolioItem 
                        title="Hyper-Growth SaaS" 
                        category="Commercial"
                        image="https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=2072"
                        index={1}
                    />
                    <PortfolioItem 
                        title="Luxe Real Estate" 
                        category="Cinematic Tour"
                        image="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070"
                        index={2}
                    />
                    <PortfolioItem 
                        title="Fintech Revolution" 
                        category="Explainer"
                        image="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070"
                        index={3}
                    />
                    <PortfolioItem 
                        title="Lifestyle Brand" 
                        category="Social Campaign"
                        image="https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=2099"
                        index={4}
                    />
                </div>
            </div>
        </section>
        
        {/* Simple Call to Action */}
        <section className="py-32 px-6 border-t border-zinc-100">
            <div className="max-w-4xl mx-auto text-center space-y-10">
                <h2 className="text-4xl md:text-6xl font-bold text-zinc-900 tracking-tight">Let's create your next <span className="text-primary">masterpiece</span>.</h2>
                <p className="text-zinc-600 text-xl">We handle the technical heavy lifting, you handle the vision.</p>
                <div className="flex justify-center">
                    <button className="px-12 py-6 bg-primary text-white font-bold rounded-full hover:brightness-110 transition-all shadow-2xl shadow-primary/30 text-lg">
                        Start Your Project
                    </button>
                </div>
            </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}

function PortfolioItem({ title, category, image, index }: { title: string, category: string, image: string, index: number }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="group cursor-pointer"
        >
            <div className="relative aspect-video rounded-3xl overflow-hidden mb-6 shadow-xl shadow-zinc-200">
                <Image 
                    src={image} 
                    alt={title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
            </div>
            <div className="space-y-1">
                <span className="text-primary text-xs font-bold uppercase tracking-widest">{category}</span>
                <h3 className="text-2xl font-bold text-zinc-900 group-hover:text-primary transition-colors">{title}</h3>
            </div>
        </motion.div>
    );
}
