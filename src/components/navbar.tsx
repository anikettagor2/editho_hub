"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/context/auth-context";
import { useBranding } from "@/lib/context/branding-context";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const { logoUrl } = useBranding();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Services", href: "/services" },
    { name: "Portfolio", href: "/portfolio" },
  ];

  return (
    <>
      {/* Brand Logo - Fixed Top Left */}
      <div className="fixed top-8 left-8 z-150 pointer-events-auto">
        <Link href="/" className="flex items-center gap-3 group">
          {logoUrl ? (
            <div className="relative h-14 w-56">
              <Image src={logoUrl} alt="Logo" fill className="object-contain object-left" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-105 group-hover:rotate-3">E</div>
              <span className="text-3xl font-black text-zinc-900 tracking-tighter">EditoHub</span>
            </div>
          )}
        </Link>
      </div>

      {/* Mobile Menu Trigger - Fixed Top Right */}
      <div className="fixed top-8 right-8 z-150 md:hidden pointer-events-auto">
        <button 
          onClick={() => setIsOpen(true)}
          className="w-12 h-12 rounded-2xl bg-white border border-black/10 flex items-center justify-center text-zinc-900 shadow-lg shadow-black/5 hover:bg-zinc-50 transition-all"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Floating Pill Navbar - Desktop Only */}
      <div className="fixed top-8 left-0 right-0 z-100 hidden md:flex justify-center px-6 pointer-events-none">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "pointer-events-auto flex items-center gap-8 px-8 py-3 rounded-full border border-black/10 bg-white/80 backdrop-blur-2xl transition-all duration-500 hover:bg-white",
            scrolled ? "shadow-[0_20px_40px_rgba(15,23,42,0.12)] border-black/15" : "bg-white/60 border-black/5"
          )}
        >
          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 h-full">
            {navLinks.map((link) => (
              <div key={link.name} className="relative group h-full flex items-center">
                <Link
                  href={link.href}
                  className={cn(
                    "text-sm font-medium transition-all hover:text-zinc-900 py-4",
                    pathname === link.href ? "text-zinc-900" : "text-zinc-600"
                  )}
                >
                  {link.name}
                </Link>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 ml-4">
            {user ? (
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-5 py-2 bg-white text-black text-sm font-medium rounded-full hover:bg-primary hover:text-white transition-all">
                  Dashboard <ArrowUpRight className="h-4 w-4" />
                </button>
              </Link>
            ) : (
              <Link href="/login">
                 <button className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-full hover:brightness-110 transition-all">
                  Get Started <ArrowUpRight className="h-4 w-4" />
                </button>
              </Link>
            )}
          </div>
        </motion.nav>
      </div>

      {/* Modern Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-900/30 backdrop-blur-md z-200 md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[85%] sm:w-[400px] bg-white z-210 p-10 flex flex-col md:hidden border-l border-black/10"
            >
              <button 
                onClick={() => setIsOpen(false)}
                className="self-end h-12 w-12 rounded-2xl border border-black/10 flex items-center justify-center text-zinc-900 mb-12 hover:bg-zinc-50 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Auth Buttons at Top for Mobile */}
              <div className="flex flex-col gap-4 mb-12">
                {user ? (
                  <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                    <button className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20">
                      Go to Dashboard
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setIsOpen(false)}>
                      <button className="w-full py-4 bg-zinc-100 text-zinc-900 font-bold rounded-2xl hover:bg-zinc-200 transition-all">
                        Log In
                      </button>
                    </Link>
                    <Link href="/signup" onClick={() => setIsOpen(false)}>
                      <button className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                        Sign Up
                      </button>
                    </Link>
                  </>
                )}
              </div>

              {/* Navigation Links */}
              <div className="space-y-6">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-4">Navigation</span>
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "block text-3xl font-black tracking-tighter transition-all hover:translate-x-2",
                      pathname === link.href ? "text-primary" : "text-zinc-400 hover:text-zinc-900"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>

              <div className="mt-auto pt-10 border-t border-zinc-100">
                <p className="text-zinc-400 text-sm font-medium">© {new Date().getFullYear()} EditoHub</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SubNavLink({ title, desc }: { title: string, desc: string }) {
  return (
    <Link href="/#services" className="group/sub flex flex-col gap-1.5 p-3 rounded-xl hover:bg-white/3 border border-transparent hover:border-white/5 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-300 group-hover/sub:text-primary transition-colors">{title}</span>
        <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover/sub:opacity-100 transition-all">
          <ArrowUpRight className="h-3 w-3 text-primary" />
        </div>
      </div>
      <span className="text-[9px] text-zinc-500 font-medium leading-relaxed group-hover/sub:text-zinc-400 transition-colors">{desc}</span>
    </Link>
  );
}
