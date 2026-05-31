"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import { Briefcase, Mail, Send, Award, Zap, Heart, Compass } from "lucide-react";

export default function CareersPage() {
  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />

        {/* Hero Section */}
        <section className="relative pt-40 pb-20 bg-zinc-50 border-b border-zinc-100 text-center px-6">
          <div className="absolute inset-0 bg-[radial-gradient(#0066FF08_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest"
            >
              <Briefcase className="h-4.5 w-4.5" /> Careers
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-black text-zinc-900 tracking-tight leading-tight">
              Join the <span className="text-primary">EditoHub</span> Team
            </h1>
            <p className="max-w-2xl text-zinc-600 text-base md:text-lg font-medium leading-relaxed mx-auto">
              We are always looking for visionary video editors, motion designers, and retention-focused scriptwriters who want to elevate the standards of visual storytelling.
            </p>
          </div>
        </section>

        {/* Key Values / Qualities Section */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Our Core Values</h2>
              <p className="text-3xl font-black text-zinc-900 tracking-tight">What We Seek In Our Team Members</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              
              {/* Quality 1 */}
              <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-105 transition-all">
                  <Award className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-2">Commitment to Craft</h4>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  We look for deep passion and meticulous execution. An editor who treats cuts like brushstrokes and scriptwriters who treat words like architecture.
                </p>
              </div>

              {/* Quality 2 */}
              <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-105 transition-all">
                  <Zap className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-2">Retention Obsession</h4>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  In a digital world driven by infinite scrolling, you understand retention graphs, pacing shifts, hook writing, and how to stop user attention instantly.
                </p>
              </div>

              {/* Quality 3 */}
              <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-6 group-hover:scale-105 transition-all">
                  <Heart className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-2">Emotional Intelligence</h4>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  Excellent remote collaboration, active communication with project managers, and the maturity to implement client revisions with creative grace.
                </p>
              </div>

              {/* Quality 4 */}
              <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-100 hover:border-primary/20 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-6 group-hover:scale-105 transition-all">
                  <Compass className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-2">Continuous Learning</h4>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  You actively study viral trends, visual grading techniques, audio balancing curves, and visual templates to continuously upgrade your personal gold standards.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* Recruitment Status */}
        <section className="py-24 px-6 bg-zinc-50 border-t border-b border-zinc-100">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tight">Active Opportunities</h2>
            <p className="text-zinc-600 text-base md:text-lg leading-relaxed font-medium">
              We are currently in a highly selective curation period. While there are no immediate open vacancies, we are always recruiting outstanding remote freelancers to join our elite roster.
            </p>

            <div className="p-10 rounded-[32px] border border-zinc-200 bg-white max-w-2xl mx-auto space-y-6">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Open Roster Submission</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">
                If you have editing timelines, script portfolios, or motion designs that exceed standard industry benchmarks, we want to see them.
              </p>
              <div className="h-px bg-zinc-100 w-full" />
              <div className="space-y-4">
                <p className="text-sm font-bold text-zinc-900">
                  Submit your resume & creative portfolio links to:
                </p>
                <a 
                  href="mailto:info@editohub.com"
                  className="inline-flex items-center gap-2 text-lg font-black text-primary hover:underline"
                >
                  <Mail className="h-5 w-5 text-primary" /> info@editohub.com
                </a>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}
