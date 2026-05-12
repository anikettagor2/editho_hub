"use client";

import { motion } from "framer-motion";
import { Upload, MessageSquare, Video, Download } from "lucide-react";

const steps = [
    {
        title: "Upload Your Footage",
        description: "Send us your raw files through our secure dashboard. We support high-speed S3 accelerated uploads for maximum efficiency.",
        icon: Upload,
        color: "bg-blue-500",
        bg: "bg-[#E6F4FF]"
    },
    {
        title: "Collaborate with Editors",
        description: "Discuss the creative vision directly with your dedicated editor. Leave timestamped comments on draft versions.",
        icon: MessageSquare,
        color: "bg-purple-500",
        bg: "bg-[#FCECEC]"
    },
    {
        title: "Review & Refine",
        description: "Watch high-quality previews in our custom player. Request as many revisions as you need until it's perfect.",
        icon: Video,
        color: "bg-emerald-500",
        bg: "bg-[#E6F9F0]"
    },
    {
        title: "Instant Download",
        description: "Once approved, download your final high-resolution video instantly. No waiting, no hassle.",
        icon: Download,
        color: "bg-amber-500",
        bg: "bg-[#FFF9E6]"
    }
];

export function ProcessSection() {
    return (
        <section id="how-it-works" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20">
                    <h2 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4">Our Process</h2>
                    <p className="text-4xl md:text-5xl font-black text-zinc-900 tracking-tight">How EditoHub Powers Your Content</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`${step.bg} p-8 rounded-3xl border border-black/5 hover:shadow-xl transition-all group`}
                        >
                            <div className={`${step.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                                <step.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 mb-4">{step.title}</h3>
                            <p className="text-zinc-600 leading-relaxed text-sm">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
