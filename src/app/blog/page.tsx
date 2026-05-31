"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { blogPosts } from "@/lib/blog-data";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { BookOpen, Calendar, Clock, User, ArrowRight } from "lucide-react";

export default function BlogListingPage() {
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
              <BookOpen className="h-4.5 w-4.5" /> Creative Hub
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-black text-zinc-900 tracking-tight leading-tight">
              Insights & <span className="text-primary">Tactics</span>
            </h1>
            <p className="max-w-2xl text-zinc-600 text-base md:text-lg font-medium leading-relaxed mx-auto">
              Master the science of viewer retention, high-CTR thumbnail design, script structures, and professional video marketing workflows.
            </p>
          </div>
        </section>

        {/* Grid Section */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              
              {blogPosts.map((post, idx) => (
                <motion.div
                  key={post.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05, duration: 0.5 }}
                  className="group flex flex-col rounded-3xl border border-zinc-200 bg-white overflow-hidden hover:border-primary/20 hover:shadow-2xl hover:shadow-zinc-200/50 transition-all duration-300"
                >
                  {/* Card Thumbnail */}
                  <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-zinc-950">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                    />
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur text-primary text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-black/5 shadow-sm">
                      {post.category}
                    </div>
                  </Link>

                  {/* Card Body */}
                  <div className="p-8 flex flex-col flex-1 space-y-4">
                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {post.date}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {post.readTime}</span>
                    </div>

                    {/* Title */}
                    <Link href={`/blog/${post.slug}`} className="block">
                      <h3 className="text-xl font-bold text-zinc-900 tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                    </Link>

                    {/* Snippet */}
                    <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3">
                      {post.metaDesc}
                    </p>

                    {/* Footer */}
                    <div className="h-px bg-zinc-100 w-full pt-2" />
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black uppercase">
                          {post.author.charAt(0)}
                        </div>
                        <span className="text-[11px] font-bold text-zinc-700">{post.author}</span>
                      </div>
                      <Link 
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-primary group-hover:translate-x-1 transition-transform"
                      >
                        Read Article <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                </motion.div>
              ))}

            </div>
          </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}
