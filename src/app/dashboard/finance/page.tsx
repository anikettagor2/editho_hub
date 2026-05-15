"use client";

import { useAuth } from "@/lib/context/auth-context";
import { addProjectLog, settleProjectPayment } from "@/app/actions/admin-actions";
import { initiateEditorPayout, bulkInitiateEditorPayouts } from "@/app/actions/payout-actions";
import { db } from "@/lib/firebase/config";
import { Project } from "@/types/schema";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Loader2, IndianRupee, CheckCircle2, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PMFinancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payoutProcessing, setPayoutProcessing] = useState<Record<string, boolean>>({});
  const [isBulkSettleLoading, setIsBulkSettleLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "projects"),
      where("assignedPMId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const clientPendingProjects = useMemo(
    () => projects.filter((p) => p.paymentStatus !== "full_paid"),
    [projects]
  );

  const editorPendingProjects = useMemo(
    () => projects.filter((p) => p.assignedEditorId && p.clientHasDownloaded && !p.editorPaid),
    [projects]
  );

  const totalClientPending = clientPendingProjects.reduce((sum, p) => sum + Math.max((p.totalCost || 0) - (p.amountPaid || 0), 0), 0);
  const totalEditorPending = editorPendingProjects.reduce((sum, p) => sum + (p.editorPrice || 0), 0);

  const pmTransactions = useMemo(
    () =>
      projects
        .flatMap((project) => (project.logs || []).map((log) => ({ project, log })))
        .filter(({ log }) => ["PAYMENT_SETTLED", "PAYMENT_MARKED"].includes(log.event))
        .sort((a, b) => b.log.timestamp - a.log.timestamp),
    [projects]
  );

  const handleSettleClient = async (projectId: string) => {
    if (!user?.uid) return;
    if (!confirm("Mark this project as client payment settled?")) return;

    const res = await settleProjectPayment(projectId, user.uid, user.displayName || "PM", "project_manager");
    if (res.success) toast.success("Client payment settled");
    else toast.error(res.error || "Failed to settle payment");
  };

  const handleSettleEditor = async (projectId: string) => {
    if (payoutProcessing[projectId]) return;

    try {
      setPayoutProcessing(prev => ({ ...prev, [projectId]: true }));
      const result = await initiateEditorPayout(projectId);

      if (result.success) {
        toast.success("Payout initiated successfully via RazorpayX");
        await addProjectLog(
          projectId, 
          "PAYMENT_INITIATED", 
          { uid: user?.uid || 'system', displayName: user?.displayName || 'PM' }, 
          `Editor payout of ₹${result.payout?.amount ? result.payout.amount / 100 : 'unknown'} initiated via RazorpayX. Payout ID: ${result.payoutId}`
        );
      } else {
        toast.error(result.error || "Failed to initiate payout");
      }
    } catch (error: any) {
      console.error("Payout error:", error);
      toast.error(error.message || "An unexpected error occurred during payout");
    } finally {
      setPayoutProcessing(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleSettleAllEditor = async () => {
    if (!user?.uid) return;
    if (editorPendingProjects.length === 0) return;
    if (!confirm(`Settle all ${editorPendingProjects.length} pending editor payouts?`)) return;

    try {
      setIsBulkSettleLoading(true);
      const ids = editorPendingProjects.map((p) => p.id);
      const res = await bulkInitiateEditorPayouts(ids);
      if (res.success) toast.success(res.message);
      else toast.error("Failed to initiate automated payouts");
    } catch (err) {
      toast.error("An unexpected error occurred during bulk settlement");
    } finally {
      setIsBulkSettleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "project_manager") {
    return <div className="p-8 text-sm text-muted-foreground">Access restricted to Project Managers.</div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Finance</h1>
        <p className="text-muted-foreground mt-1">Handle client settlements and editor payouts for your assigned projects.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Client Dues Pending</div>
          <div className="text-3xl font-black text-amber-500 tabular-nums">₹{totalClientPending.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Editor Payout Pending</div>
          <div className="text-3xl font-black text-blue-400 tabular-nums">₹{totalEditorPending.toLocaleString()}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Transactions Logged</div>
          <div className="text-3xl font-black text-foreground tabular-nums">{pmTransactions.length}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Client Settlement Queue</h2>
          </div>
          <div className="max-h-[340px] overflow-y-auto divide-y divide-border">
            {clientPendingProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground uppercase tracking-widest font-bold">No client dues pending</div>
            ) : (
              clientPendingProjects.map((p) => {
                const due = Math.max((p.totalCost || 0) - (p.amountPaid || 0), 0);
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                    <div className="min-w-0">
                      <Link href={`/dashboard/projects/${p.id}`} className="text-sm font-semibold text-foreground hover:text-primary truncate block">
                        {p.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Due: ₹{due.toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => handleSettleClient(p.id)}
                      className="h-8 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white text-[10px] font-bold uppercase tracking-widest"
                    >
                      Settle
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Editor Payout Queue</h2>
            {editorPendingProjects.length > 0 && (
              <button
                onClick={handleSettleAllEditor}
                disabled={isBulkSettleLoading}
                className="h-8 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {isBulkSettleLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Settle All"}
              </button>
            )}
          </div>
          <div className="max-h-[340px] overflow-y-auto divide-y divide-border">
            {editorPendingProjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground uppercase tracking-widest font-bold">No editor payouts pending</div>
            ) : (
              editorPendingProjects.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <Link href={`/dashboard/projects/${p.id}`} className="text-sm font-semibold text-foreground hover:text-primary truncate block">
                      {p.name}
                    </Link>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Share: ₹{(p.editorPrice || 0).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => handleSettleEditor(p.id)}
                    disabled={payoutProcessing[p.id]}
                    className="h-8 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  >
                    {payoutProcessing[p.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : "Settle"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Transaction History (Assigned Projects)</h2>
        </div>
        <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
          {pmTransactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground uppercase tracking-widest font-bold">No transactions recorded yet</div>
          ) : (
            pmTransactions.map(({ project, log }) => {
              const isClientSettle = log.event === "PAYMENT_SETTLED";
              const amount = isClientSettle ? (project.totalCost || 0) : (project.editorPrice || 0);
              return (
                <div key={`${project.id}-${log.timestamp}-${log.event}`} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{project.name}</span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold tracking-widest",
                        isClientSettle ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {isClientSettle ? "Client Settlement" : "Editor Payout"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()} • by {log.userName || "System"}</div>
                  </div>
                  <div className="text-sm font-black text-foreground tabular-nums">₹{amount.toLocaleString()}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

