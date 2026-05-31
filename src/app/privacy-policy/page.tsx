"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LenisProvider } from "@/components/home/lenis-provider";
import { motion } from "framer-motion";
import { ShieldCheck, Calendar, Mail, MapPin, User } from "lucide-react";

export default function PrivacyPolicyPage() {
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
              <ShieldCheck className="h-4.5 w-4.5" /> Legal Document
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black text-zinc-900 tracking-tight leading-tight">
              Privacy Policy
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
                  Welcome to <strong>EditoHub</strong>. We respect your privacy and are committed to protecting the personal data you share with us. This Privacy Policy outlines how EditoHub ("we," "us," or "our"), owned by <strong>Divyanshu Yadav</strong>, collects, protects, uses, and shares your personal information.
                </p>
                <p className="text-zinc-600 text-base leading-relaxed">
                  By accessing or using our website, services, or reviewing dashboards, you agree to the practices described in this Privacy Policy. If you do not agree with this policy, please do not use our services.
                </p>
              </div>

              {/* Company Info Box */}
              <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Company Details</h4>
                  <div className="space-y-2 text-sm text-zinc-600">
                    <p className="flex items-center gap-2"><User className="h-4 w-4 text-zinc-400" /> <strong>Owner:</strong> Divyanshu Yadav</p>
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-zinc-400" /> <strong>Support Email:</strong> support@editohub.com</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Physical Address</h4>
                  <p className="flex items-start gap-2 text-sm text-zinc-600 leading-relaxed">
                    <MapPin className="h-4 w-4 text-zinc-400 mt-1 shrink-0" />
                    <span>
                      01, Divyanshu Bhavan, Basarikhpur, Sisotar,<br />
                      Maniyar Road, Sikander Pur, Uttar Pradesh,<br />
                      Ballia, Pin 277303, India
                    </span>
                  </p>
                </div>
              </div>

              {/* 1. Information We Collect */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">1. Information We Collect</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We collect information that you voluntarily provide to us and information collected automatically when you visit our website:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li><strong>Account Registration & Prefill Information:</strong> Your name, business name, contact email address, billing address, and WhatsApp contact details when you create an account or initiate a project.</li>
                  <li><strong>Creative & Media Uploads:</strong> Video files, audio files, voice comments, reference documents, script outlines, and review comments submitted during production cycles.</li>
                  <li><strong>Transaction Data:</strong> Details of orders placed, billing particulars, and invoices. Please note: payment processing is completed securely through external PCI-compliant gateways (Razorpay), and we do not store your raw credit card numbers.</li>
                  <li><strong>Automatically Collected Information:</strong> We automatically collect certain system metadata such as your IP address, browser type, device information, operating system, and browsing habits on our platform.</li>
                </ul>
              </div>

              {/* 2. How We Use It */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">2. How We Use Your Information</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We leverage the collected information to execute, improve, and secure our operations:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li>To provide, manage, and facilitate our premium video editing, scriptwriting, and thumbnail design services.</li>
                  <li>To verify payment orders, manage credit limits (Pay Later features), and process secure Razorpay transactions.</li>
                  <li>To send real-time automated system updates, notifications, and review logs via email or WhatsApp integration.</li>
                  <li>To optimize video performance, load times, and dynamic player responsiveness using CDN caches and Mux stream parameters.</li>
                  <li>To comply with regulatory audit requirements and protect our platform from systemic fraud or unauthorized video downloads.</li>
                </ul>
              </div>

              {/* 3. Cookies & Tracking Technologies */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">3. Cookies & Tracking Technologies</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We use cookies (small text files placed on your device) to recognize your browser, persist user sessions, secure video streaming states, and analyze user interactions. You can adjust your browser configurations to decline cookies, but doing so may limit your access to key interactive features of our review dashboards.
                </p>
              </div>

              {/* 4. Google AdSense & DoubleClick Cookie Disclosure */}
              <div className="space-y-4 p-8 rounded-3xl bg-blue-50/20 border border-blue-500/10">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight text-blue-600 flex items-center gap-2">
                  4. Google AdSense & DoubleClick Disclosures
                </h2>
                <p className="text-zinc-700 leading-relaxed text-sm">
                  We partner with Google AdSense to serve advertisements on certain pages of our website. Please read the following disclosures regarding how Google uses data on our website:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-zinc-700 text-sm">
                  <li><strong>Third-Party Vendor Cookies:</strong> Google and other third-party vendors use cookies to serve advertisements based on a user's prior visits to our website or other sites across the internet.</li>
                  <li><strong>The DoubleClick Cookie:</strong> Google's use of advertising cookies enables it and its partners to serve ads to our users based on their visit to our site and/or other sites on the Internet.</li>
                  <li><strong>Opting Out:</strong> Users may opt out of personalized advertising by visiting <a href="https://settings.google.com/ads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Google Ads Settings</a>. Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting the <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Network Advertising Initiative</a> consumer opt-out portal.</li>
                </ul>
              </div>

              {/* 5. Third Party Services */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">5. Third-Party Services</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We employ third-party tools to optimize service delivery, analytics, and messaging infrastructure:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-zinc-600 text-sm">
                  <li><strong>Hosting & Databases:</strong> Vercel and Google Firebase (Cloud Firestore, Storage, and Functions) for secure hosting, state preservation, and asset distribution.</li>
                  <li><strong>Video Processing:</strong> Mux Video APIs for transcoding draft files, streaming high-speed HLS playbacks, and generating watermarks.</li>
                  <li><strong>Payments:</strong> Razorpay payment gateway to authorize secure transaction parameters.</li>
                  <li><strong>Analytics & Ads:</strong> Google Analytics and Google AdSense to audit system traffic and serve targeted, safe advertisements.</li>
                </ul>
              </div>

              {/* 6. Data Security */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">6. Data Security</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We enforce industry-standard security metrics (including database rule validation, HTTPS encryption, token authentication, and signed CDN download links) to ensure your raw media assets, reviews, and client balances are protected. However, no data transmission across the public internet can be guaranteed as 100% secure, and you share information at your own risk.
                </p>
              </div>

              {/* 7. Children's Privacy */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">7. Children's Privacy</h2>
                <p className="text-zinc-600 leading-relaxed">
                  Our services are not intended for or marketed to individuals under the age of 13. We do not knowingly collect personal data from children under 13. If we discover that a child under 13 has shared personal data with us, we will immediately purge it from our systems.
                </p>
              </div>

              {/* 8. Changes to This Policy */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">8. Changes to This Policy</h2>
                <p className="text-zinc-600 leading-relaxed">
                  We reserve the right to modify this Privacy Policy at any time. When updates are published, we will adjust the "Last Updated" date at the top of this document. We encourage you to review this policy periodically to stay informed about how we protect your personal data.
                </p>
              </div>

              {/* 9. Contact Us */}
              <div className="space-y-4">
                <h2 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">9. Contact Us</h2>
                <p className="text-zinc-600 leading-relaxed">
                  For any inquiries, feedback, or data privacy requests, please contact our support team at:
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
