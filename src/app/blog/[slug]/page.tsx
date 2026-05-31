"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { blogPosts } from "@/lib/blog-data";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Clock, User, MessageCircle, ArrowRight } from "lucide-react";

export default function BlogPostDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const router = useRouter();

  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return notFound();
  }

  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />

        {/* Back Link & Header */}
        <section className="relative pt-40 pb-16 bg-zinc-50 border-b border-zinc-100 px-6">
          <div className="absolute inset-0 bg-[radial-gradient(#0066FF08_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <Link 
              href="/blog"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors mb-4 group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Insights
            </Link>
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
              {post.category}
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight leading-tight">
              {post.title}
            </h1>

            {/* Author Block */}
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-zinc-200/60 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="flex items-center gap-2 text-zinc-800">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black">
                  {post.author.charAt(0)}
                </div>
                <span>{post.author}</span>
              </span>
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {post.date}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {post.readTime}</span>
            </div>
          </div>
        </section>

        {/* Article Visual Banner */}
        <section className="max-w-5xl mx-auto px-6 -mt-8 relative z-20">
          <div className="relative aspect-[21/9] w-full rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200/80 bg-zinc-950">
            <Image
              src={post.image}
              alt={post.title}
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-primary/5" />
          </div>
        </section>

        {/* Dynamic prose content */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            
            {/* Custom rich article renderer */}
            <article 
              className="prose prose-zinc lg:prose-lg max-w-none text-zinc-800 leading-relaxed space-y-8
                prose-headings:font-black prose-headings:tracking-tight prose-headings:text-zinc-900 prose-headings:mt-12
                prose-h2:text-2xl prose-h2:md:text-3xl prose-h2:border-b prose-h2:border-zinc-100 prose-h2:pb-3
                prose-h3:text-xl
                prose-p:text-base prose-p:md:text-lg prose-p:leading-relaxed prose-p:text-zinc-600
                prose-ul:list-disc prose-ul:pl-6 prose-ul:space-y-2 prose-ul:text-zinc-600 prose-ul:text-base
                prose-strong:font-bold prose-strong:text-zinc-950
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-zinc-700
              "
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Premium CTA box at bottom */}
            <div className="mt-20 p-10 md:p-12 rounded-[36px] bg-zinc-50 border border-zinc-200 text-center space-y-6 max-w-3xl mx-auto">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Partner with EditoHub</h4>
              <h3 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">Ready to Elevate Your Visual Branding?</h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-lg mx-auto">
                Stop wasting time with amateur cuts. Partner with our elite video editors and scriptwriters to scale your CTR, viewer retention, and subscriber growth today.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Link href="/signup">
                  <button className="h-12 px-8 rounded-full bg-primary text-white text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <a 
                  href="https://wa.me/919096563651"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-12 px-6 rounded-full bg-white border border-zinc-200 hover:border-emerald-500 hover:text-emerald-600 text-zinc-800 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4 fill-current text-emerald-500" /> WhatsApp
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
