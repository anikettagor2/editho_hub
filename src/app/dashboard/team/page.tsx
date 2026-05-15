"use client";

import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Project, User } from "@/types/schema";
import { useEffect, useMemo, useState } from "react";
import { Users, Loader2, IndianRupee, FolderOpen, Mail } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ClientPriorityManager } from "./client-priority-manager";

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editors, setEditors] = useState<User[]>([]);
  const [salesExecs, setSalesExecs] = useState<User[]>([]);
  // Full users list (for SE name lookup fallback even if role changed)
  const [allUsers, setAllUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!user?.uid || !user?.role) return;

    let projectsQ;

    if (user.role === "admin") {
      const clientsQ = query(
        collection(db, "users"),
        where("role", "==", "client")
      );
      projectsQ = query(
        collection(db, "projects"),
        orderBy("createdAt", "desc")
      );

      const unsubClients = onSnapshot(clientsQ, (snap) => {
        setClients(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
        setLoading(false);
      });

      const unsubProjects = onSnapshot(projectsQ, (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
      });

      const editorsQ = query(collection(db, "users"), where("role", "==", "editor"));
      const unsubEditors = onSnapshot(editorsQ, (snap) => {
        setEditors(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      const salesExecsQ = query(collection(db, "users"), where("role", "==", "sales_executive"));
      const unsubSalesExecs = onSnapshot(salesExecsQ, (snap) => {
        setSalesExecs(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      const allUsersQ = collection(db, "users");
      const unsubAllUsers = onSnapshot(allUsersQ, (snap) => {
        setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      return () => {
        unsubClients();
        unsubProjects();
        unsubEditors();
        unsubSalesExecs();
        unsubAllUsers();
      };
    } else {
      // PM view: query by managedByPM (primary) AND assignedManagerId (fallback for legacy/missed clients)
      // Two separate queries merged and deduplicated client-side.
      const clientsByPMQ = query(
        collection(db, "users"),
        where("role", "==", "client"),
        where("managedByPM", "==", user.uid)
      );
      const clientsByManagerIdQ = query(
        collection(db, "users"),
        where("role", "==", "client"),
        where("assignedManagerId", "==", user.uid)
      );

      projectsQ = query(
        collection(db, "projects"),
        where("assignedPMId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      // Merge clients from both queries, deduplicating by uid
      const clientMap = new Map<string, User>();

      const unsubClientsByPM = onSnapshot(clientsByPMQ, (snap) => {
        snap.docs.forEach((d) => clientMap.set(d.id, { uid: d.id, ...d.data() } as User));
        setClients(Array.from(clientMap.values()));
        setLoading(false);
      });

      const unsubClientsByManagerId = onSnapshot(clientsByManagerIdQ, (snap) => {
        snap.docs.forEach((d) => clientMap.set(d.id, { uid: d.id, ...d.data() } as User));
        setClients(Array.from(clientMap.values()));
        setLoading(false);
      });

      const unsubProjects = onSnapshot(projectsQ, (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
      });

      const editorsQ = query(collection(db, "users"), where("role", "==", "editor"));
      const unsubEditors = onSnapshot(editorsQ, (snap) => {
        setEditors(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      const salesExecsQ = query(collection(db, "users"), where("role", "==", "sales_executive"));
      const unsubSalesExecs = onSnapshot(salesExecsQ, (snap) => {
        setSalesExecs(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      // Also listen for all users for SE name fallback
      const allUsersQ = collection(db, "users");
      const unsubAllUsers = onSnapshot(allUsersQ, (snap) => {
        setAllUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as User)));
      });

      return () => {
        unsubClientsByPM();
        unsubClientsByManagerId();
        unsubProjects();
        unsubEditors();
        unsubSalesExecs();
        unsubAllUsers();
      };
    }
  }, [user?.uid, user?.role]);

  const teamData = useMemo(() => {
    const byClient = new Map<string, {
      clientId: string;
      clientName: string;
      clientEmail: string;
      salesExecName?: string;
      assignedEditorPriority: { editorId: string; priority: number; targetPrice?: number; editorFee?: number }[];
      defaultEditorRate?: number;
      totalProjects: number;
      totalPendingDues: number;
      pendingProjects: { id: string; name: string; pending: number }[];
      salesExecEmail?: string;
    }>();

    for (const c of clients) {
      // SE name lookup: first check salesExecs (role=sales_executive), then fallback to allUsers
      const seId = (c as any).managedBy || c.createdBy;
      const seFromExecs = seId ? salesExecs.find(s => s.uid === seId) : undefined;
      const seFromAll = seId ? allUsers.find(u => u.uid === seId) : undefined;
      const seUser = seFromExecs || seFromAll;
      const salesExecName = seUser?.displayName || undefined;
      const salesExecEmail = seUser?.email || undefined;

      byClient.set(c.uid, {
        clientId: c.uid,
        clientName: c.displayName || "Unknown Client",
        clientEmail: c.email || "N/A",
        salesExecName,
        salesExecEmail,
        assignedEditorPriority: c.assignedEditorPriority || [],
        defaultEditorRate: c.defaultEditorRate,
        totalProjects: 0,
        totalPendingDues: 0,
        pendingProjects: [],
      });
    }

    for (const p of projects) {
      const cid = p.clientId;
      if (!cid) continue;
      if (!byClient.has(cid)) {
        byClient.set(cid, {
          clientId: cid,
          clientName: p.clientName || "Unknown Client",
          clientEmail: "N/A",
          assignedEditorPriority: [],
          totalProjects: 0,
          totalPendingDues: 0,
          pendingProjects: [],
        });
      }

      const entry = byClient.get(cid)!;
      entry.totalProjects += 1;

      const pending = Math.max((p.totalCost || 0) - (p.amountPaid || 0), 0);
      if (pending > 0) {
        entry.totalPendingDues += pending;
        entry.pendingProjects.push({ id: p.id, name: p.name, pending });
      }
    }

    return Array.from(byClient.values()).sort((a, b) => b.totalPendingDues - a.totalPendingDues);
  }, [clients, projects, salesExecs, allUsers]);

  const totals = useMemo(() => {
    return teamData.reduce(
      (acc, c) => {
        acc.clients += 1;
        acc.projects += c.totalProjects;
        acc.pending += c.totalPendingDues;
        return acc;
      },
      { clients: 0, projects: 0, pending: 0 }
    );
  }, [teamData]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "project_manager" && user?.role !== "admin") {
    return <div className="p-8 text-sm text-muted-foreground">Access restricted to Project Managers and Admins.</div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Team Management</h1>
        <p className="text-muted-foreground mt-1">Assigned clients, their project volume, and pending dues breakdown.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Assigned Clients</div>
          <div className="text-3xl font-black text-foreground tabular-nums">{totals.clients}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Total Projects</div>
          <div className="text-3xl font-black text-foreground tabular-nums">{totals.projects}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Total Dues Left</div>
          <div className="text-3xl font-black text-amber-500 tabular-nums">₹{totals.pending.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Assigned Clients Overview</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{teamData.length} clients</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Total Projects</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Total Dues Left</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pending Dues by Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teamData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14 text-center text-sm text-muted-foreground">No assigned clients yet.</td>
                </tr>
              ) : (
                teamData.map((item) => (
                  <tr key={item.clientId} className="hover:bg-muted/20 transition-colors align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-foreground">{item.clientName}</div>
                      <div className="text-xs text-muted-foreground mb-1">{item.clientEmail}</div>
                      {item.salesExecName && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-[10px] font-semibold text-amber-600/90 dark:text-amber-500/90 bg-amber-500/10 inline-block px-1.5 py-0.5 rounded">
                            SE: {item.salesExecName}
                          </div>
                          {item.salesExecEmail && (
                            <a 
                              href={`mailto:${item.salesExecEmail}?subject=Pricing Configuration Required for ${item.clientName}`}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title={`Contact ${item.salesExecName} (${item.salesExecEmail})`}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.assignedEditorPriority.length > 0 ? (
                          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
                            Priority Set ({item.assignedEditorPriority.length})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full border border-border">
                            No Priority
                          </span>
                        )}

                        {(clients.find(c => c.uid === item.clientId)?.multiTierRates || clients.find(c => c.uid === item.clientId)?.customRates) ? (
                          <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                            Pricing Set
                          </span>
                        ) : (
                          <a 
                            href={item.salesExecEmail ? `mailto:${item.salesExecEmail}?subject=Pricing Configuration Required for ${item.clientName}` : "#"}
                            className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-all flex items-center gap-1 group"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            No Pricing
                            <span className="hidden group-hover:inline ml-1 opacity-70">- Click to contact SE</span>
                          </a>
                        )}
                      </div>

                      <div className={item.salesExecName ? "" : "mt-2"}>
                        <ClientPriorityManager 
                        clientId={item.clientId}
                        clientName={item.clientName}
                        assignedPriority={item.assignedEditorPriority}
                        defaultRate={item.defaultEditorRate}
                        editors={editors}
                        multiTierRates={clients.find(c => c.uid === item.clientId)?.multiTierRates}
                        customRates={clients.find(c => c.uid === item.clientId)?.customRates}
                        salesExecName={item.salesExecName}
                      />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-foreground tabular-nums">{item.totalProjects}</td>
                    <td className="px-4 py-4 text-sm font-bold tabular-nums text-amber-500">₹{item.totalPendingDues.toLocaleString()}</td>
                    <td className="px-4 py-4">
                      {item.pendingProjects.length === 0 ? (
                        <span className="text-xs text-emerald-500 font-semibold">No pending dues</span>
                      ) : (
                        <div className="space-y-2 max-w-[500px]">
                          {item.pendingProjects.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 border border-border">
                              <Link href={`/dashboard/projects/${p.id}`} className="text-xs font-semibold text-foreground hover:text-primary truncate">
                                {p.name}
                              </Link>
                              <span className="text-xs font-bold text-amber-500 tabular-nums whitespace-nowrap">₹{p.pending.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
