"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

const plans = [
    {
        name: "Standard",
        price: "Custom",
        desc: "Perfect for social media creators",
        features: ["1 Active Project", "48hr Turnaround", "Infinite Revisions", "Standard Watermarking", "Dashboard Access"],
        color: "blue"
    },
    {
        name: "Pro",
        price: "Custom",
        desc: "For growing YouTube channels",
        features: ["3 Active Projects", "24hr Turnaround", "Priority Support", "Custom Branding", "Collaboration Tools"],
        popular: true,
        color: "indigo"
    },
    {
        name: "Enterprise",
        price: "Custom",
        desc: "Full production teams",
        features: ["Unlimited Projects", "Same-day Delivery", "Custom Workflows", "API Access", "SSO Integration"],
        color: "zinc"
    }
];

export function PricingSection() {
    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4">Pricing</h2>
                    <p className="text-4xl font-black text-zinc-900 tracking-tight">Simple, Transparent Pricing</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={`relative p-10 rounded-[40px] border ${plan.popular ? 'border-blue-600 shadow-2xl shadow-blue-200' : 'border-zinc-200'} bg-white flex flex-col`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">{plan.name}</h3>
                                <p className="text-zinc-500 text-sm">{plan.desc}</p>
                            </div>

                            <div className="mb-8 flex items-baseline gap-1">
                                <span className="text-5xl font-black text-zinc-900">{plan.price}</span>
                            </div>

                            <div className="space-y-4 mb-10 flex-grow">
                                {plan.features.map((feature, j) => (
                                    <div key={j} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                            <Check className="w-3 h-3 font-bold" />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-700">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Link href="/signup">
                                <button className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group ${plan.popular ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'}`}>
                                    Get Started
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
