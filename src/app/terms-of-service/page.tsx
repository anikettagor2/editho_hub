"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import { FileText, Calendar, Mail, MapPin, Scale } from "lucide-react";

export default function TermsOfServicePage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <LenisProvider>
      <main className="bg-white text-zinc-900 overflow-x-hidden selection:bg-primary/20 selection:text-primary">
        <Navbar />
        
        {/* Header */}
        <section className="relative pt-40 pb-20 bg-zinc-50 border-b border-zinc-100 text-center px-6">
          <div className="absolute inset-0 bg-[radial-gradient(#0066FF08_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
          <div className="max-w-4xl mx-auto space-y-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest"
            >
              <Scale className="h-4.5 w-4.5" /> Legal Agreement
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight leading-tight">
              Terms of Service
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground pt-4 border-t border-zinc-200/60 max-w-md mx-auto">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Last Updated: {lastUpdated}</span>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-zinc max-w-none space-y-12">
              
              {/* Introduction */}
              <div className="space-y-4">
                <p className="text-zinc-600 text-base leading-relaxed">
                  Welcome to <strong>EditoHub</strong>. These Terms of Service ("Terms") govern your access to and use of the EditoHub website, client dashboards, video review systems, and all professional creative services provided by EditoHub ("we," "us," or "our"), owned by <strong>Divyanshu Yadav</strong>.
                </p>
                <p className="text-zinc-600 text-base leading-relaxed">
                  By registering an account, placing an order, uploading media, or using our platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.
                </p>
              </div>

              {/* 1. Acceptance of Terms */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">1. Acceptance of Terms</h2>
                <p className="text-zinc-600 leading-relaxed">
                  These Terms represent a legally binding agreement between you ("Client," "User," or "Creator") and EditoHub. We reserve the right to amend, update, or replace these Terms at any time without prior individual notice. All modifications take effect immediately upon their publication on this page. Your continued use of our platform constitutes explicit acceptance of any modified Terms.
                </p>
              </div>

              {/* 2. Services Description */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">2. Description of Services</h2>
                <p className="text-zinc-600 leading-relaxed">
                  EditoHub is a premium remote post-production studio providing elite creative services, including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li><strong>Short-Form Video Production:</strong> Dynamic editing, motion text, graphics, and sound design tailored for TikTok, Instagram Reels, and YouTube Shorts.</li>
                  <li><strong>Long-Form Video Editing:</strong> Retentive structure editing, B-roll integrations, and color grading for high-performance YouTube channels.</li>
                  <li><strong>Scriptwriting:</strong> Development of hook-focused outlines and engaging verbal narratives.</li>
                  <li><strong>Thumbnail Design:</strong> High-impact, click-enticing graphics to optimize click-through rates.</li>
                </ul>
                <p className="text-zinc-600 leading-relaxed">
                  All draft versions, revision logs, voice feedback, annotations, and final MP4 files are facilitated directly through our secure client review dashboard.
                </p>
              </div>

              {/* 3. Payment Terms & Razorpay Settlements */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">3. Payment Terms & Financial Dues</h2>
                <p className="text-zinc-600 leading-relaxed">
                  To maintain operations, we require compliance with the following billing guidelines:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li><strong>Standard Billing:</strong> Standard checkout requires a 50% upfront payment (GST-exclusive base cost in project ledger plus 18% GST in invoice metadata) and a 50% balance payment upon draft completion.</li>
                  <li><strong>Pay Later Feature:</strong> Select eligible clients may be granted a "Pay Later" privilege by our administrators. This allows clients to check out without immediate payment up to a specified credit limit (default ceiling: ₹5,000). Outstanding upfront amounts are recorded under the user's `pendingDues` tally.</li>
                  <li><strong>Final Balance Settlement:</strong> Final video downloads are securely locked until the balance billing has been fully paid and verified. For clients with active Pay Later privileges, the balance can be paid proactively from their dashboard at any time, but standard clients must complete the transaction before downloading files.</li>
                  <li><strong>Razorpay:</strong> All transactions are executed securely via PCI-compliant Razorpay scripts. Once payment is confirmed, system records are instantly updated, and client receivables are settled dynamically in the administrator portal.</li>
                </ul>
              </div>

              {/* 4. Revisions & Annotations Policy */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">4. Revisions & Timeline Annotations</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We are dedicated to visual excellence. Revisions must be submitted directly through our interactive timeline review modal:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li>Clients submit textual instructions, voice recordings, or annotated image attachments pinned to specific timeline timestamps.</li>
                  <li>We provide revisions within the standard turnaround period specified by the plan.</li>
                  <li>Revision requests must remain within the scope of the original project brief. Requests representing a fundamental change in creative direction, duration, or script represent a new project task and will be billed separately.</li>
                </ul>
              </div>

              {/* 5. Intellectual Property Rights */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">5. Intellectual Property</h2>
                <p className="text-zinc-600 leading-relaxed">
                  Unless otherwise negotiated and agreed in writing, intellectual property parameters are defined as follows:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li><strong>Raw Footage:</strong> The client retains all ownership and copyright of their uploaded raw footage, script concepts, voiceovers, and asset folders.</li>
                  <li><strong>Completed Videos:</strong> Upon successful transaction completion and receipt of the full payment, copyright of the edited, rendered final MP4 video is transferred entirely to the client.</li>
                  <li><strong>Creative Portfolio:</strong> Unless explicitly restricted by a signed Non-Disclosure Agreement (NDA), the client grants EditoHub a non-exclusive, perpetual, worldwide license to display snippets or case studies of the completed videos in our public portfolios and social media channels to demonstrate quality of service.</li>
                </ul>
              </div>

              {/* 6. Limitation of Liability */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">6. Limitation of Liability</h2>
                <p className="text-zinc-600 leading-relaxed">
                  In no event shall EditoHub, its owner Divyanshu Yadav, its employees, scriptwriters, or editors be liable for any indirect, incidental, special, consequential, or punitive damages (including loss of profits, advertising costs, audience drop-off, data corruption, or platform bans) arising from or relating to your use of our edited videos, site dashboards, or custom playbacks.
                </p>
              </div>

              {/* 7. Termination of Service */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">7. Termination</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We reserve the absolute right to lock, suspend, or terminate your dashboard access, project cards, and database logs without prior warning if you violate these Terms, engage in payment bypass attempts, execute unauthorized downloads of watermarked drafts, or harass our editors or managers.
                </p>
              </div>

              {/* 8. Governing Law & Jurisdiction */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">8. Governing Law & Jurisdiction</h2>
                <p className="text-zinc-600 leading-relaxed">
                  These Terms, operational transactions, and any dispute arising under this agreement shall be governed by and construed in accordance with the laws of the <strong>Republic of India</strong>, without regard to conflict of law principles. Any legal actions or proceedings arising out of these Terms must be filed exclusively in the competent courts located in <strong>Ballia, Uttar Pradesh, India</strong>.
                </p>
              </div>

              {/* 9. Contact Information */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">9. Contact Us</h2>
                <p className="text-zinc-600 leading-relaxed">
                  If you have questions, feedback, or need clarification regarding these Terms of Service, please contact our administrative representative:
                </p>
                <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-2 text-sm text-zinc-700 w-fit">
                  <p><strong>Company:</strong> EditoHub</p>
                  <p><strong>Owner:</strong> Divyanshu Yadav</p>
                  <p><strong>Email:</strong> <a href="mailto:support@editohub.com" className="text-primary hover:underline font-semibold">support@editohub.com</a></p>
                  <p><strong>Address:</strong> 01, Divyanshu Bhavan, Basarikhpur, Sisotar, Maniyar Road, Sikander Pur, Uttar Pradesh, Ballia, Pin 277303</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        <Footer />
      </main>
    </LenisProvider>
  );
}
