"use client";

import { motion } from "framer-motion";
import { Target, Lightbulb, Quote, ArrowRight } from "lucide-react";
import Image from "next/image";

export function AboutContent() {
  return (
    <div className="bg-white text-zinc-900 selection:bg-primary/20 selection:text-primary">
      {/* Clean Marketing Hero */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 overflow-hidden bg-zinc-50/50">
        <div className="absolute inset-0 bg-[radial-gradient(#0066FF10_1px,transparent_1px)] [background-size:40px_40px] opacity-30" />
        
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-primary font-bold text-sm uppercase tracking-[0.2em] mb-6"
        >
            The Origin Story
        </motion.div>
        
        <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl md:text-8xl font-black text-zinc-900 leading-tight tracking-tight mb-10"
        >
            Crafting the <br />
            <span className="text-primary">Next Generation</span>
        </motion.h1>
        
        <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-2xl text-zinc-600 text-lg md:text-xl font-medium leading-relaxed mx-auto"
        >
            We founded EditoHub on a simple realization: in the age of attention, video isn't just about editing—it's about the heartbeat of your brand.
        </motion.p>
      </section>

      {/* Philosophy Section - Clean & Minimal */}
      <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
              <div className="w-full md:w-1/2 relative aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200">
                  <Image 
                    src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000" 
                    alt="Creative Hub" 
                    fill 
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-primary/5" />
              </div>
              <div className="w-full md:w-1/2 space-y-10">
                  <div className="space-y-6">
                      <h2 className="text-4xl md:text-6xl font-bold text-zinc-900 tracking-tight leading-tight">The Edito<span className="text-primary">Hub</span> Philosophy</h2>
                      <p className="text-zinc-600 text-lg leading-relaxed">
                          We recognized that creators and brands didn't just need cuts; they needed a partner who understands retention, emotion, and pace. Today, we empower brands globally with high-performance video production.
                      </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                          <Target className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                          <h4 className="text-lg font-bold text-zinc-900 mb-2">Our Mission</h4>
                          <p className="text-zinc-600 text-sm">Empowering brands with surgical precision and cinematic edge.</p>
                      </div>
                      <div className="p-8 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                          <Lightbulb className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                          <h4 className="text-lg font-bold text-zinc-900 mb-2">Our Vision</h4>
                          <p className="text-zinc-600 text-sm">Setting the global gold standard for remote video production.</p>
                      </div>
                  </div>
              </div>
          </div>
      </section>

      {/* Founder Section - Professional & Minimal */}
      <section className="py-32 px-6 bg-zinc-50">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
              <div className="w-full lg:w-2/5 relative aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200 group">
                  <Image 
                    src="/founder.jpg" 
                    alt="Divyanshu Yadav" 
                    fill 
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/40 via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8">
                      <h3 className="text-2xl font-bold text-white">Divyanshu Yadav</h3>
                      <p className="text-white/80 font-semibold tracking-wider text-xs mt-1">Founding Architect</p>
                  </div>
              </div>

              <div className="w-full lg:w-3/5 space-y-8">
                  <Quote className="w-12 h-12 text-primary/20" />
                  <div className="space-y-6">
                      <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 leading-tight">
                          "Editing is where the <span className="text-primary italic">Soul</span> enters the frame."
                      </h2>
                      <p className="text-zinc-600 text-lg leading-relaxed italic">
                          At EditoHub, we don't just edit videos; we engineer experiences. In a world of infinite scrolling, we create the moment that makes the world stop and watch.
                      </p>
                  </div>

                  <div className="flex flex-wrap gap-6 items-center pt-4">
                      <button className="flex items-center gap-3 px-8 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded-full hover:brightness-110 transition-all shadow-lg shadow-primary/25">
                          Founder's Story <ArrowRight className="h-4 w-4" />
                      </button>
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:border-primary/30 hover:text-primary cursor-pointer transition-all">
                            <span className="text-xs font-bold">In</span>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:border-primary/30 hover:text-primary cursor-pointer transition-all">
                            <span className="text-xs font-bold">X</span>
                        </div>
                      </div>
                  </div>
              </div>
          </div>
      </section>
    </div>
  );
}
