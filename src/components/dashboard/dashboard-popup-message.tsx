"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";

type DashboardPopup = {
  id: string;
  title?: string;
  message?: string;
  targetRoles?: string[];
  active?: boolean;
  startAt?: number | null;
  endAt?: number | null;
  createdAt?: number;
};

function isPopupInWindow(popup: DashboardPopup, now: number) {
  if (!popup.active) return false;
  if (popup.startAt && popup.startAt > now) return false;
  if (popup.endAt && popup.endAt < now) return false;
  return true;
}

export function DashboardPopupMessage() {
  const { user, firebaseUser } = useAuth();
  const [popups, setPopups] = useState<DashboardPopup[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.role || user.role === "developer") {
      setPopups([]);
      return;
    }

    let cancelled = false;

    const loadPopups = async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        if (!token) return;

        const response = await fetch("/api/dashboard-popups", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || "Failed to load dashboard popup");
        }
        if (!cancelled) {
          setPopups(result.popups || []);
        }
      } catch (error) {
        console.error("Failed to load dashboard popup:", error);
      }
    };

    void loadPopups();
    const interval = window.setInterval(() => void loadPopups(), 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [firebaseUser, user?.role]);

  const activePopup = useMemo(() => {
    const now = Date.now();
    return popups
      .filter((popup) => isPopupInWindow(popup, now))
      .filter((popup) => !dismissedIds.includes(popup.id))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
  }, [dismissedIds, popups]);

  const dismissPopup = () => {
    if (!activePopup) return;
    const next = [...new Set([...dismissedIds, activePopup.id])];
    setDismissedIds(next);
  };

  if (!activePopup) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
        <button
          onClick={dismissPopup}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-5 p-7">
          <div className="flex items-start gap-4 pr-10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">EditoHub Notice</p>
              <h2 className="mt-1 text-xl font-black text-foreground">{activePopup.title || "Important update"}</h2>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
            {activePopup.message}
          </p>

          <button
            onClick={dismissPopup}
            className="h-11 w-full rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-[0.98]"
          >
            Okay, Got It
          </button>
        </div>
      </div>
    </div>
  );
}
