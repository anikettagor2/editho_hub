"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Loader2, Menu, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useBranding } from "@/lib/context/branding-context";
import { rememberPostLoginRedirect } from "@/lib/auth-redirect";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Only redirect when Firebase session is truly gone.
    // This avoids false logouts during transient profile sync states.
    if (!loading && !firebaseUser) {
      const query = searchParams?.toString();
      const nextPath = `${pathname}${query ? `?${query}` : ""}`;
      rememberPostLoginRedirect(nextPath);
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [firebaseUser, loading, pathname, router, searchParams]);


  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router]);

  if (loading) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background selection:bg-primary/20 selection:text-primary relative transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Mobile Sidebar Toggle - Fixed Top Right */}
        {!isMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden fixed top-8 right-8 z-50 h-12 w-12 rounded-2xl border border-black/10 bg-white/90 backdrop-blur text-zinc-900 flex items-center justify-center shadow-lg shadow-black/5"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        {/* Mobile Navigation Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[100] md:hidden"
              />
              
              {/* Full-screen Menu Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-4 z-[110] md:hidden bg-background rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Header inside mobile menu */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/5 flex-shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Navigation Menu</span>
                    <span className="text-xs font-bold text-foreground">Welcome, {user?.displayName?.split(' ')[0]}</span>
                  </div>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="h-11 w-11 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-black/5 active:scale-95 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <DashboardSidebar />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar (Permanent) */}
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>

        <main className="flex-1 overflow-y-auto relative flex flex-col scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent p-4 md:p-6 lg:p-8">
          <div className="w-full flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
       <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
