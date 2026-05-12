"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, MessageCircle, Clock, Shield, Users } from "lucide-react";

export function FuturisticCTA() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden bg-[#F0F9FF]">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main CTA Card */}
        <div className="relative rounded-3xl p-8 md:p-16 overflow-hidden bg-linear-to-br from-white to-[#fbfaf7] border border-black/10 shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
          {/* Background Accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6"
              >
                Limited Availability
              </motion.span>

              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 mb-6 leading-tight"
              >
                Ready to scale your content production?
              </motion.h2>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg text-zinc-600 mb-8 leading-relaxed"
              >
                Join hundreds of creators and brands who trust us with their video editing. Start your first project today with no commitment.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link href="/signup">
                  <button className="group flex items-center justify-center gap-3 px-8 py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-all w-full sm:w-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/20">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="https://wa.me/919096563651" target="_blank">
                  <button className="flex items-center justify-center gap-3 px-8 py-4 bg-white border border-black/10 text-zinc-900 font-semibold rounded-xl hover:bg-zinc-50 transition-all w-full sm:w-auto shadow-sm hover:shadow-md">
                    <MessageCircle className="w-4 h-4" />
                    Talk to Us
                  </button>
                </Link>
              </motion.div>
            </div>

            {/* Right Side - Features */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="grid grid-cols-2 gap-4"
            >
              <FeatureCard 
                icon={<Clock className="w-5 h-5" />}
                title="Fast Delivery"
                desc="24-48 hour turnaround on most projects"
              />
              <FeatureCard 
                icon={<Shield className="w-5 h-5" />}
                title="Secure Files"
                desc="Enterprise-grade encryption for your content"
              />
              <FeatureCard 
                icon={<Users className="w-5 h-5" />}
                title="Dedicated Team"
                desc="Same editor on every project for consistency"
              />
              <FeatureCard 
                icon={<MessageCircle className="w-5 h-5" />}
                title="Direct Chat"
                desc="Real-time communication with your editor"
              />
            </motion.div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 px-0 md:px-2">
          <StatItem value="500+" label="Happy Clients" />
          <StatItem value="10,000+" label="Videos Delivered" />
          <StatItem value="1B+" label="Total Views Generated" />
          <StatItem value="4.9/5" label="Average Rating" />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/80 border border-black/10 hover:border-black/20 transition-all">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-zinc-900 font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center premium-light-surface rounded-2xl py-5 px-4">
      <div className="text-2xl md:text-3xl font-bold text-zinc-900 mb-1">{value}</div>
      <div className="text-sm text-zinc-600">{label}</div>
    </div>
  );
}
