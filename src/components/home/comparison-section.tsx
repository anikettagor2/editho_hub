"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const features = [
    { name: "Monthly Fixed Cost", editohub: true, traditional: false },
    { name: "Dedicated Account Manager", editohub: true, traditional: false },
    { name: "Infinite Revisions", editohub: true, traditional: "Usually Paid" },
    { name: "Global Talent Pool", editohub: true, traditional: "Localized" },
    { name: "Secure Collaboration Dashboard", editohub: true, traditional: false },
    { name: "High-Speed S3 Uploads", editohub: true, traditional: false },
];

export function ComparisonSection() {
    return (
        <section className="py-24 bg-[#F8FAFC]">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-4">Why Us?</h2>
                    <p className="text-4xl font-black text-zinc-900 tracking-tight">Better than traditional hiring</p>
                </div>

                <div className="bg-white rounded-[32px] border border-zinc-200 overflow-hidden shadow-2xl shadow-blue-900/5">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                                <th className="p-8 text-sm font-bold text-zinc-500 uppercase tracking-wider">Features</th>
                                <th className="p-8 text-lg font-black text-blue-600">EditoHub</th>
                                <th className="p-8 text-lg font-black text-zinc-400">Freelancers/Agency</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feature, i) => (
                                <tr key={i} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50 transition-colors">
                                    <td className="p-8 font-semibold text-zinc-700">{feature.name}</td>
                                    <td className="p-8">
                                        {feature.editohub === true ? (
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                <Check className="w-5 h-5 font-bold" />
                                            </div>
                                        ) : (
                                            <span className="text-blue-600 font-bold">{feature.editohub}</span>
                                        )}
                                    </td>
                                    <td className="p-8">
                                        {feature.traditional === false ? (
                                            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400">
                                                <X className="w-5 h-5" />
                                            </div>
                                        ) : (
                                            <span className="text-zinc-400 font-medium">{feature.traditional}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
