"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { Bell, CalendarClock, CheckCircle2, Code2, Loader2, Power, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TargetRole = "admin" | "project_manager" | "editor" | "client";

type DashboardPopup = {
  id: string;
  title: string;
  message: string;
  targetRoles: TargetRole[];
  active: boolean;
  startAt?: number | null;
  endAt?: number | null;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
};

const ROLE_OPTIONS: { value: TargetRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "project_manager", label: "Project Manager" },
  { value: "editor", label: "Editor" },
  { value: "client", label: "Client" },
];

function toInputValue(timestamp?: number | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromInputValue(value: string) {
  return value ? new Date(value).getTime() : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function DeveloperDashboard() {
  const { firebaseUser } = useAuth();
  const [popups, setPopups] = useState<DashboardPopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRoles, setTargetRoles] = useState<TargetRole[]>(["admin"]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [active, setActive] = useState(true);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await firebaseUser?.getIdToken();
    if (!token) throw new Error("Developer session is not ready. Please refresh and try again.");
    return { Authorization: `Bearer ${token}` };
  }, [firebaseUser]);

  const loadPopups = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const response = await fetch("/api/dashboard-popups", {
        headers: await getAuthHeaders(),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load popup messages");
      }
      setPopups(result.popups || []);
    } catch (error: unknown) {
      console.error("Failed to load dashboard popups:", error);
      toast.error(getErrorMessage(error, "Failed to load popup messages"));
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, getAuthHeaders]);

  useEffect(() => {
    void loadPopups();
  }, [loadPopups]);

  const activeCount = useMemo(
    () => popups.filter((popup) => popup.active).length,
    [popups],
  );

  const toggleRole = (role: TargetRole) => {
    setTargetRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setTargetRoles(["admin"]);
    setStartAt("");
    setEndAt("");
    setActive(true);
  };

  const createPopup = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Add both title and message.");
      return;
    }

    if (targetRoles.length === 0) {
      toast.error("Select at least one user type.");
      return;
    }

    const startTime = fromInputValue(startAt);
    const endTime = fromInputValue(endAt);
    if (startTime && endTime && endTime < startTime) {
      toast.error("End date must be after start date.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/dashboard-popups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetRoles,
          active,
          startAt: startTime,
          endAt: endTime,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to create popup");
      }

      toast.success("Popup message created");
      resetForm();
      await loadPopups();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to create popup"));
    } finally {
      setSaving(false);
    }
  };

  const togglePopupActive = async (popup: DashboardPopup) => {
    try {
      const response = await fetch("/api/dashboard-popups", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          id: popup.id,
          active: !popup.active,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to update popup");
      }

      toast.success(!popup.active ? "Popup turned on" : "Popup turned off");
      await loadPopups();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update popup"));
    }
  };

  const deletePopup = async (popup: DashboardPopup) => {
    if (!confirm(`Delete "${popup.title}"? This cannot be undone.`)) return;

    try {
      const response = await fetch("/api/dashboard-popups", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ id: popup.id }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to delete popup");
      }

      toast.success("Popup deleted");
      await loadPopups();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete popup"));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Code2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-foreground">Developer Dashboard</h1>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Dashboard popup control center
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Popups</div>
            <div className="text-2xl font-black text-primary">{activeCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">Create Popup</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Show a dashboard message by role and date
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Maintenance notice"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary/60"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the popup message users should see..."
                className="min-h-32 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Show To</label>
              <div className="grid gap-2 sm:grid-cols-4">
                {ROLE_OPTIONS.map((role) => {
                  const selected = targetRoles.includes(role.value);
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => toggleRole(role.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors",
                        selected
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start Date</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">End Date</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary/60"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <span className="text-xs font-black uppercase tracking-widest text-foreground">Turn popup on now</span>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>

            <button
              onClick={createPopup}
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {saving ? "Creating..." : "Create Popup"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-foreground">Popup Messages</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manage live and scheduled popups</p>
              </div>
            </div>
          </div>

          <div className="max-h-[640px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : popups.length === 0 ? (
              <div className="flex h-48 items-center justify-center p-6 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                No popup messages yet
              </div>
            ) : (
              popups.map((popup) => (
                <div key={popup.id} className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-black text-foreground">{popup.title}</h3>
                        <span className={cn(
                          "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                          popup.active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground",
                        )}>
                          {popup.active ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{popup.message}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => togglePopupActive(popup)}
                        className={cn(
                          "flex h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-colors",
                          popup.active
                            ? "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white",
                        )}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {popup.active ? "Off" : "On"}
                      </button>
                      <button
                        onClick={() => deletePopup(popup)}
                        className="flex h-9 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-widest text-red-400 transition-colors hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {popup.targetRoles.map((role) => role.replace("_", " ")).join(", ")}
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-3.5 w-3.5 text-primary" />
                      {toInputValue(popup.startAt) || "Now"} - {toInputValue(popup.endAt) || "No end"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
