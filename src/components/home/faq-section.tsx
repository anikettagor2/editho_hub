"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";

const faqs = [
    {
        q: "What types of videos do you edit?",
        a: "We handle everything from YouTube content, Instagram Reels, and TikToks to corporate interviews, podcasts, and online courses. If you have footage, we can edit it."
    },
    {
        q: "How does the 'Infinite Revisions' work?",
        a: "We want you to be 100% happy with your video. You can request as many changes as needed through our dashboard using timestamped comments. We'll refine the draft until it meets your vision."
    },
    {
        q: "How do I communicate with my editor?",
        a: "You'll have a dedicated dashboard where you can upload files, track progress, and chat directly with your assigned editor and account manager."
    },
    {
        q: "Can I cancel my subscription anytime?",
        a: "Yes, our monthly plans are flexible. You can cancel or pause your subscription at any time through your account settings, and you'll retain access until the end of your billing cycle."
    }
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-24 bg-[#F8FAFC]">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4">FAQ</h2>
                    <p className="text-4xl font-black text-zinc-900 tracking-tight">Got Questions?</p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full p-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors"
                            >
                                <span className="font-bold text-zinc-900">{faq.q}</span>
                                {openIndex === i ? (
                                    <Minus className="w-5 h-5 text-blue-600" />
                                ) : (
                                    <Plus className="w-5 h-5 text-zinc-400" />
                                )}
                            </button>
                            <AnimatePresence>
                                {openIndex === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className="px-6 pb-6 text-zinc-600 leading-relaxed text-sm">
                                            {faq.a}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
