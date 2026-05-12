"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

export function MarketingHero() {
    const { user } = useAuth();

    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-[#E6F4FF]">
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-blue-100 shadow-sm mb-8"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Premium Video Editing Service</span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black text-zinc-900 leading-[1.1] tracking-tight mb-8"
                    >
                        Scale your content with 
                        <span className="text-blue-600 block">Expert Video Editors</span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg md:text-xl text-zinc-600 mb-10 leading-relaxed max-w-2xl mx-auto"
                    >
                        Focus on creating, we'll handle the rest. Get a dedicated post-production team to turn your raw footage into high-converting videos. No hiring stress, just results.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
                    >
                        <Link href={user ? "/dashboard" : "/signup"}>
                            <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group">
                                {user ? "Go to Dashboard" : "Get Started Now"}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                        <Link href="#how-it-works">
                            <button className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 font-bold rounded-2xl border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2">
                                <Play className="w-4 h-4 fill-current" />
                                See How It Works
                            </button>
                        </Link>
                    </motion.div>

                    {/* Trust Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-12 border-t border-blue-100"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-zinc-600">24hr Turnaround</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-zinc-600">Infinite Revisions</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-zinc-600">Dedicated Manager</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="text-sm font-semibold text-zinc-600">Fixed Monthly Price</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
