"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API request delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setSubmitted(true);
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

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
              <Mail className="h-4.5 w-4.5" /> Reach Out
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-black text-zinc-900 tracking-tight leading-tight">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="max-w-2xl text-zinc-600 text-base md:text-lg font-medium leading-relaxed mx-auto">
              Have a project, a script outline, or an editing query? Drop us a line below, or chat with us instantly on WhatsApp.
            </p>
          </div>
        </section>

        {/* Two-Column Grid */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Left Column: Contact Cards */}
            <div className="lg:col-span-5 space-y-8">
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Contact Information</h2>
              <p className="text-zinc-600 text-sm leading-relaxed">
                Connect with EditoHub for premium post-production partnerships. Our support representatives are standing by to guide your creative assets.
              </p>

              <div className="space-y-6">
                
                {/* Email Card */}
                <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-start gap-4 hover:border-primary/20 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Email Address</h4>
                    <a href="mailto:support@editohub.com" className="text-base font-bold text-zinc-900 hover:text-primary transition-colors">
                      support@editohub.com
                    </a>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">24/7 client ticket response</p>
                  </div>
                </div>

                {/* Phone / WhatsApp Card */}
                <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-start gap-4 hover:border-primary/20 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">WhatsApp & Call</h4>
                    <a href="tel:+919096563651" className="text-base font-bold text-zinc-900 hover:text-emerald-500 transition-colors block">
                      +91 9096563651
                    </a>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Mon - Sat, 10 AM - 7 PM IST</p>
                    <div className="mt-4">
                      <a 
                        href="https://wa.me/919096563651"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20"
                      >
                        <MessageCircle className="h-4 w-4 fill-white" /> Talk on WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                {/* Physical Address Card */}
                <div className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex items-start gap-4 hover:border-primary/20 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Physical Address</h4>
                    <p className="text-sm font-bold text-zinc-900 leading-relaxed">
                      01, Divyanshu Bhavan, Basarikhpur, Sisotar, <br />
                      Maniyar Road, Sikander Pur, Uttar Pradesh, <br />
                      Ballia, Pin 277303, India
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Contact Form */}
            <div className="lg:col-span-7">
              <div className="p-8 md:p-10 rounded-[32px] border border-zinc-200 bg-white">
                
                {submitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16 space-y-6"
                  >
                    <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-100/50">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-zinc-900">Message Transmitted!</h3>
                      <p className="text-zinc-600 text-sm leading-relaxed max-w-sm mx-auto">
                        Thank you for reaching out. A representative from EditoHub will contact you via email within 24 hours.
                      </p>
                    </div>
                    <button 
                      onClick={() => setSubmitted(false)}
                      className="px-6 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Send Another Message
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-zinc-900">Send us a Message</h3>
                      <p className="text-xs text-zinc-500 font-medium">Use the form below to outline your project parameters.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Your Name</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. John Doe"
                          className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-zinc-400 font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="e.g. creator@channel.com"
                          className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-zinc-400 font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Subject</label>
                      <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="e.g. Scriptwriting & Short Editing Campaign"
                        className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-zinc-400 font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Message Description</label>
                      <textarea
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Tell us about your YouTube channel, brand objectives, custom video length, and reference ideas..."
                        className="w-full h-36 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm text-zinc-900 focus:outline-none focus:border-primary/50 transition-colors placeholder:text-zinc-400 font-medium resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-xl bg-primary hover:brightness-110 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                      {isSubmitting ? "Transmitting..." : (
                        <>
                          <Send className="h-4 w-4" /> Send Message <ArrowRight className="h-4.5 w-4.5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

              </div>
            </div>

          </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}
