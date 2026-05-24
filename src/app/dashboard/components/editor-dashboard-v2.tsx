"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { localFileManager } from "@/lib/local-file-manager";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, limit, setDoc, deleteDoc } from "firebase/firestore";
import { Project, Revision, VideoJob } from "@/types/schema";
import { cn } from "@/lib/utils";
import { 
    Loader2,
    Eye,
    CheckCircle2,
    Clock,
    AlertCircle,
    MessageCircle,
    Film,
    Check,
    RefreshCw,
    History,
    FileVideo,
    Briefcase,
    Banknote,
    User,
    Mail,
    Users,
    ArrowRight,
    ExternalLink,
    UploadCloud,
    ChevronRight,
    Gauge,
    Timer,
    Layers,
    ShieldCheck,
    X,
    LayoutDashboard,
    Wallet,
    Bell,
    Settings,
    LogOut,
    Plus,
    PlusSquare,
    CheckCircle,
    Building2,
    Hash,
    CreditCard,
    LayoutGrid,
    List,
    FileText,
    Link2,
    Music
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewSystemModal } from "./review-system-modal";
import { preloadVideosIntoMemory } from "@/lib/video-preload";
import { FilePreview } from "@/components/file-preview";
import { UploadService, UploadProgress } from "@/lib/services/upload-service";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_GB } from "@/lib/constants";
import { handleRevisionUploaded } from "@/app/actions/notification-actions";
import { respondToAssignment } from "@/app/actions/admin-actions";
import { updateEditorPayoutDetails } from "@/app/actions/payout-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// --- Components ---

const inrFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

function formatCurrency(value?: number | null) {
    return inrFormatter.format(value || 0);
}

function getEditorDisplayStatus(status?: string, editorPaid?: boolean) {
    if (!status) return "active";
    if (status === "completed" && !editorPaid) return "completed_pending_payment";
    if (status === "approved") return "in_review";
    if (status === "review") return "in_review";
    return status;
}

function isEditorCompletedProject(project: Pick<Project, "status">) {
    return project.status === "completed" || project.status === "archived";
}

function isEditorDeliveredProject(project: Pick<Project, "status">) {
    return isEditorCompletedProject(project) || project.status === "completed_pending_payment";
}

function StatusBadge({ status, editorPaid }: { status: string; editorPaid?: boolean }) {
    const colors = {
        active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        in_production: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        in_review: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        completed_pending_payment: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        editor_assigned: "bg-sky-500/10 text-sky-500 border-sky-500/20",
        editor_not_assigned: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    } as any;

    const resolvedStatus = getEditorDisplayStatus(status, editorPaid);
    const label = resolvedStatus === "completed_pending_payment"
        ? "Completed"
        : resolvedStatus.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    return (
        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all hover:brightness-110", colors[resolvedStatus] || "bg-muted text-muted-foreground")}>
            {label}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, subValue, trend, variant = "default" }: any) {
    return (
        <motion.div 
            whileHover={{ y: -4, scale: 1.01 }}
            className={cn(
                "p-3 sm:p-4 rounded-xl bg-card border border-border/50 shadow-lg shadow-black/5 relative overflow-hidden group transition-all",
                variant === "primary" && "bg-primary/5 border-primary/20"
            )}
        >
            <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-all group-hover:rotate-12 group-hover:scale-110 hidden sm:block">
                <Icon size={100} />
            </div>
            <div className="relative z-10 space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn(
                        "h-7 w-7 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center transition-transform group-hover:rotate-3 shrink-0",
                        variant === "primary" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-primary/10 text-primary"
                    )}>
                        <Icon className="h-3.5 w-3.5 sm:h-[18px] sm:w-[18px]" />
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">{label}</div>
                </div>
                <div className="space-y-0.5">
                    <div className="text-base sm:text-xl font-bold text-foreground tracking-tighter flex flex-wrap items-baseline gap-1 sm:gap-2">
                        <span className="truncate">{value}</span>
                        {trend && <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full truncate">{trend}</span>}
                    </div>
                    {subValue && <div className="text-[8px] sm:text-[10px] font-bold text-muted-foreground mt-0.5 opacity-70 truncate" title={subValue}>{subValue}</div>}
                </div>
            </div>
        </motion.div>
    );
}

function summarizeProjectResources(project: Project) {
    const scriptText = (project as any).scriptText;
    const bRoleFiles = ((project as any).bRoleFiles || []) as { name?: string }[];
    const clientReferenceFiles = (project.referenceFiles || []).filter((file: any) => !file?.uploadedBy);
    const pmReferenceFiles = (project.referenceFiles || []).filter((file: any) => Boolean(file?.uploadedBy));

    return [
        {
            label: "Raw Footage",
            icon: FileVideo,
            value: (project.rawFiles?.length || 0) > 0 || (project.footageLinks?.length || 0) > 0 || project.footageLink
                ? `${project.rawFiles?.length || 0} file${(project.rawFiles?.length || 0) === 1 ? "" : "s"}${(project.footageLinks?.length || 0) > 0 || project.footageLink ? ` â€¢ ${(project.footageLinks?.length || 0) + (project.footageLink ? 1 : 0)} link${((project.footageLinks?.length || 0) + (project.footageLink ? 1 : 0)) === 1 ? "" : "s"}` : ""}`
                : "Client has not uploaded raw footage",
            hasData: Boolean((project.rawFiles?.length || 0) > 0 || (project.footageLinks?.length || 0) > 0 || project.footageLink),
        },
        {
            label: "Scripts",
            icon: FileText,
            value: (project.scripts?.length || 0) > 0 || Boolean(scriptText)
                ? `${project.scripts?.length || 0} file${(project.scripts?.length || 0) === 1 ? "" : "s"}${scriptText ? " â€¢ pasted brief included" : ""}`
                : "Client has not uploaded scripts or directions",
            hasData: Boolean((project.scripts?.length || 0) > 0 || scriptText),
        },
        {
            label: "Audio",
            icon: Music,
            value: (project.audioFiles?.length || 0) > 0
                ? `${project.audioFiles?.length || 0} audio file${(project.audioFiles?.length || 0) === 1 ? "" : "s"}`
                : "Client has not uploaded audio files",
            hasData: Boolean((project.audioFiles?.length || 0) > 0),
        },
        {
            label: "Style References",
            icon: Link2,
            value: clientReferenceFiles.length > 0 || (project.referenceLinks?.length || 0) > 0 || project.referenceLink
                ? `${clientReferenceFiles.length} file${clientReferenceFiles.length === 1 ? "" : "s"}${(project.referenceLinks?.length || 0) > 0 || project.referenceLink ? ` â€¢ ${(project.referenceLinks?.length || 0) + (project.referenceLink ? 1 : 0)} link${((project.referenceLinks?.length || 0) + (project.referenceLink ? 1 : 0)) === 1 ? "" : "s"}` : ""}`
                : "Client has not uploaded style references",
            hasData: Boolean(clientReferenceFiles.length > 0 || (project.referenceLinks?.length || 0) > 0 || project.referenceLink),
        },
        {
            label: "B-Roll",
            icon: Layers,
            value: bRoleFiles.length > 0
                ? `${bRoleFiles.length} B-roll file${bRoleFiles.length === 1 ? "" : "s"}`
                : "Client has not uploaded B-roll assets",
            hasData: Boolean(bRoleFiles.length > 0),
        },
        {
            label: "PM Files",
            icon: Briefcase,
            value: (project.pmFiles?.length || 0) > 0 || pmReferenceFiles.length > 0
                ? `${(project.pmFiles?.length || 0) + pmReferenceFiles.length} manager file${((project.pmFiles?.length || 0) + pmReferenceFiles.length) === 1 ? "" : "s"}`
                : "PM has not uploaded additional files",
            hasData: Boolean((project.pmFiles?.length || 0) > 0 || pmReferenceFiles.length > 0),
        },
    ];
}

// --- Main Dashboard ---

export function EditorDashboardV2({ preselectedProjectId }: { preselectedProjectId?: string }) {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any>({});
    const [projectRevisions, setProjectRevisions] = useState<Record<string, any>>({});
    const [activeTab, setActiveTab] = useState<'projects' | 'finance'>('projects');
    const [projectsView, setProjectsView] = useState<"grid" | "list">("list");
    const [projectFilter, setProjectFilter] = useState<"all" | "editing" | "in_review" | "pending" | "completed" | "pay_later" | "payment_due">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [isResponding, setIsResponding] = useState<string | null>(null); // projectId
    
    // Review/Modal States
    const [reviewProject, setReviewProject] = useState<Project | null>(null);
    const [selectedProjectAssets, setSelectedProjectAssets] = useState<Project | null>(null);
    
    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadProject, setUploadProject] = useState<Project | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
    const [uploadDescription, setUploadDescription] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProg, setUploadProg] = useState<UploadProgress | null>(null);
    const abortRef = useRef<(() => void) | null>(null);

    // Preselect and open project or review system for dynamic URLs
    useEffect(() => {
        if (preselectedProjectId && projects.length > 0) {
            const found = projects.find(p => p.id === preselectedProjectId);
            if (found) {
                const hasRevisions = !!projectRevisions[found.id];
                if (hasRevisions || found.status === 'in_review') {
                    setReviewProject(found);
                } else {
                    setSelectedProjectAssets(found);
                }
            }
        }
    }, [preselectedProjectId, projects, projectRevisions]);

    // Keep browser URL synchronized with open project modal states
    useEffect(() => {
        if (reviewProject?.id) {
            const targetPath = `/dashboard/${reviewProject.id}`;
            if (window.location.pathname !== targetPath) {
                window.history.pushState(null, '', targetPath);
            }
        } else if (selectedProjectAssets?.id) {
            const targetPath = `/dashboard/${selectedProjectAssets.id}`;
            if (window.location.pathname !== targetPath) {
                window.history.pushState(null, '', targetPath);
            }
        } else if (!reviewProject && !selectedProjectAssets) {
            if (window.location.pathname !== '/dashboard') {
                window.history.pushState(null, '', '/dashboard');
            }
        }
    }, [reviewProject, selectedProjectAssets]);

    const handleRespond = async (projectId: string, response: 'accepted' | 'rejected', reason?: string) => {
        try {
            setIsResponding(projectId);
            const res = await respondToAssignment(projectId, response, reason);
            if (res.success) {
                toast.success(response === 'accepted' ? "Project accepted!" : "Project declined.");
            } else {
                toast.error(res.error || "Failed to respond to assignment.");
            }
        } catch (err) {
            toast.error("An error occurred.");
        } finally {
            setIsResponding(null);
        }
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        // Fetch assigned projects
        const projectsRef = collection(db, "projects");
        const q = query(projectsRef, where("assignedEditorId", "==", user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProjects: Project[] = [];
            snapshot.forEach((pDoc) => {
                fetchedProjects.push({ id: pDoc.id, ...pDoc.data() } as Project);
            });
            
            fetchedProjects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setProjects(fetchedProjects);
            setLoading(false);

            // Fetch latest revisions
            fetchedProjects.forEach(project => {
                const revisionsRef = collection(db, "revisions");
                const revQ = query(revisionsRef, where("projectId", "==", project.id), orderBy("version", "desc"), limit(1));
                getDocs(revQ).then(snap => {
                    if (!snap.empty) {
                        setProjectRevisions(prev => ({
                            ...prev,
                            [project.id]: { id: snap.docs[0].id, ...snap.docs[0].data() }
                        }));
                    }
                });
            });
        });

        // User data
        const userUnsub = onSnapshot(doc(db, "users", user.uid), d => d.exists() && setUserData(d.data()));
        
        // All users for PM info
        const usersUnsub = onSnapshot(collection(db, "users"), snap => {
            const map = {} as any;
            snap.forEach(d => map[d.id] = d.data());
            setAllUsers(map);
        });

        return () => { unsubscribe(); userUnsub(); usersUnsub(); };
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setUploadFile(f);
        if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
        setUploadPreviewUrl(URL.createObjectURL(f));
    };

    const handleStartUpload = async () => {
        if (!uploadFile || !user || !uploadProject) {
            toast.error("Please select a file first.");
            return;
        }

        if (uploadFile.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`File is too large. Max size allowed is ${MAX_FILE_SIZE_GB}GB.`);
            return;
        }

        setIsUploading(true);
        setUploadProg(null);

        let createdRevisionId: string | null = null;
        
        try {
            const projectId = uploadProject.id;
            const revisionsRef = collection(db, "revisions");
            const snap = await getDocs(query(revisionsRef, where("projectId", "==", projectId)));
            let nextVersion = 1;
            if (!snap.empty) {
                const revisions = snap.docs.map(doc => doc.data() as Revision);
                nextVersion = Math.max(...revisions.map(r => r.version || 0)) + 1;
            }

            const revisionId = doc(revisionsRef).id;
            createdRevisionId = revisionId; // Store for cleanup if needed
            const revisionRef = doc(db, "revisions", revisionId);
            const jobRef = doc(db, "video_jobs", revisionId);

            // Create initial records
            await setDoc(revisionRef, {
                id: revisionId,
                projectId,
                version: nextVersion,
                videoUrl: "",
                status: "active",
                uploadedBy: user.uid,
                createdAt: Date.now(),
                description: uploadDescription,
            });

            await setDoc(jobRef, {
                id: revisionId, projectId, revisionId, status: "uploading", createdAt: Date.now(), updatedAt: Date.now()
            });

            await UploadService.uploadFileUnified(uploadFile, {
                projectId,
                revisionId,
                type: 'revision',
                onProgress: setUploadProg,
                onCancelRef: cancel => abortRef.current = cancel
            });

            await handleRevisionUploaded(projectId);
            
            // Register for local download
            localFileManager.registerFile(revisionId, uploadFile);
            
            toast.success("Revision uploaded successfully!");
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadDescription("");
            if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
            setUploadPreviewUrl(null);
        } catch (err) {
            const isAbort = err instanceof Error && (err.name === "AbortError" || err.message?.includes("abort"));
            
            if (!isAbort) {
                console.error("Upload failed:", err);
                toast.error("Upload failed. Please try again.");
            } else {
                console.log("Upload aborted by user.");
            }

            // CLEANUP: Delete the records since the upload didn't finish
            if (createdRevisionId) {
                try {
                    const revisionRef = doc(db, "revisions", createdRevisionId);
                    const jobRef = doc(db, "video_jobs", createdRevisionId);
                    await Promise.all([
                        deleteDoc(revisionRef),
                        deleteDoc(jobRef)
                    ]);
                    console.log("[Cleanup] Successfully removed failed/aborted upload records.");
                } catch (cleanupErr) {
                    console.error("[Cleanup] Failed to remove records during cleanup:", cleanupErr);
                }
            }
        } finally {
            setIsUploading(false);
            abortRef.current = null;
        }
    };

    const filteredProjects = projects.filter((p) => {
        const matchesSearch =
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            allUsers[p.assignedPMId || ""]?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (projectFilter === "all") return true;
        if (projectFilter === "editing") return ["active", "in_production", "editor_assigned"].includes(p.status);
        if (projectFilter === "in_review") return ["review", "in_review"].includes(p.status);
        if (projectFilter === "pending") return p.assignmentStatus !== "accepted" && p.assignmentStatus !== "rejected";
        if (projectFilter === "completed") return isEditorDeliveredProject(p);
        if (projectFilter === "pay_later") return Boolean(p.isPayLaterRequest);
        if (projectFilter === "payment_due") return p.status === "completed_pending_payment" && !p.editorPaid;
        return true;
    });
    const completedProjects = projects.filter((p) => isEditorCompletedProject(p));
    const financeProjects = projects.filter((p) => isEditorDeliveredProject(p));
    const totalPaid = financeProjects.filter(p => p.editorPaid).reduce((acc, p) => acc + (p.editorPrice || 0), 0);
    const pendingEarnings = financeProjects.filter(p => !p.editorPaid).reduce((acc, p) => acc + (p.editorPrice || 0), 0);
    const totalProjectPages = Math.max(1, Math.ceil(filteredProjects.length / rowsPerPage));
    const paginatedProjects = filteredProjects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const activeProjectCount = projects.filter(p => ['active', 'in_production', 'in_review'].includes(p.status)).length;
    const pendingAssignmentCount = projects.filter(p => p.assignmentStatus !== "accepted" && p.assignmentStatus !== "rejected").length;

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, projectsView, projectFilter, searchQuery, rowsPerPage]);

    useEffect(() => {
        if (currentPage > totalProjectPages) {
            setCurrentPage(totalProjectPages);
        }
    }, [currentPage, totalProjectPages]);

    if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* --- Premium Header --- */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                            <Film size={18} />
                        </div>
                        <h1 className="text-lg font-black tracking-tight text-foreground hidden sm:block">Editor Dashboard</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Status Toggle */}
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border/50">
                            <div className={cn("h-2 w-2 rounded-full", userData?.availabilityStatus === 'online' ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                            <select 
                                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
                                value={userData?.availabilityStatus || 'offline'}
                                onChange={(e) => updateDoc(doc(db, "users", user!.uid), { availabilityStatus: e.target.value })}
                            >
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="sleep">Sleep</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shadow-inner">
                                {user?.displayName?.charAt(0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8 space-y-5">
                {/* --- Stats Overview --- */}
                <div className="grid grid-cols-2 gap-2.5 md:gap-3 xl:grid-cols-4">
                    <StatCard icon={Gauge} label="Active Projects" value={activeProjectCount} trend={pendingAssignmentCount > 0 ? `${pendingAssignmentCount} pending` : undefined} variant="primary" />
                    <StatCard icon={CheckCircle2} label="Completed" value={completedProjects.length} subValue="Paid and closed projects" />
                    <StatCard icon={Banknote} label="Paid Earnings" value={formatCurrency(totalPaid)} subValue="Successfully settled" />
                    <StatCard icon={Wallet} label="Pending" value={formatCurrency(pendingEarnings)} subValue="Awaiting admin settlement" />
                </div>

                {/* --- Project Controls --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
                            <button 
                                onClick={() => setActiveTab('projects')}
                                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", activeTab === 'projects' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                            >
                                <LayoutDashboard size={13} /> Projects
                            </button>
                            <button 
                                onClick={() => setActiveTab('finance')}
                                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", activeTab === 'finance' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                            >
                                <Wallet size={13} /> Finance
                            </button>
                        </div>

                        {activeTab === "projects" && (
                            <div className="flex p-1 bg-muted/40 rounded-xl border border-border/50 w-fit">
                                <button
                                    onClick={() => setProjectsView("grid")}
                                    className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", projectsView === "grid" ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                                    title="Grid view"
                                >
                                    <LayoutGrid size={13} /> Blocks
                                </button>
                                <button
                                    onClick={() => setProjectsView("list")}
                                    className={cn("px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", projectsView === "list" ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                                    title="List view"
                                >
                                    <List size={13} /> List
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="relative group flex-1 md:max-w-xl">
                        <input 
                            type="text"
                            placeholder="Search projects by name..."
                            className="w-full h-10 pl-11 pr-5 rounded-xl bg-card border border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none text-xs"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <Eye className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
                    </div>
                </div>

                {activeTab === "projects" && (
                    <div className="rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/5 overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
                            <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground whitespace-nowrap">
                                <List size={14} className="text-primary shrink-0" />
                                <span className="hidden xs:inline">Viewing: Projects</span>
                                <span className="xs:hidden">Viewing</span>
                            </div>
                            <div className="relative w-[150px] sm:w-[220px]">
                                <select
                                    value={projectFilter}
                                    onChange={(e) => setProjectFilter(e.target.value as typeof projectFilter)}
                                    className="w-full appearance-none rounded-xl border border-border/50 bg-muted/30 px-3 sm:px-4 py-2 pr-9 text-[10px] font-black uppercase tracking-widest text-foreground outline-none cursor-pointer transition-all hover:bg-muted/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                                >
                                    <option value="all" className="bg-card text-foreground">All</option>
                                    <option value="editing" className="bg-card text-foreground">Editing</option>
                                    <option value="in_review" className="bg-card text-foreground">In Review</option>
                                    <option value="pending" className="bg-card text-foreground">Pending</option>
                                    <option value="completed" className="bg-card text-foreground">Completed</option>
                                    <option value="payment_due" className="bg-card text-foreground">Completed (Payment Pending)</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground">
                                    <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Project List --- */}
                <AnimatePresence mode="wait">
                    {activeTab === 'projects' ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className={cn(projectsView === "grid" ? "grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3" : "")}
                        >
                            {projectsView === "grid" ? paginatedProjects.map((project, idx) => (
                                    <ProjectCard 
                                        key={project.id} 
                                        project={project} 
                                        idx={idx} 
                                        pm={project.assignedPMId ? allUsers[project.assignedPMId] : undefined}
                                        latestRevision={projectRevisions[project.id]}
                                        onUpload={() => { setUploadProject(project); setIsUploadModalOpen(true); }}
                                        onReview={() => setReviewProject(project)}
                                        onAssets={() => setSelectedProjectAssets(project)}
                                        onRespond={handleRespond}
                                        isResponding={isResponding === project.id}
                                    />
                                )) : (
                                    <ProjectTable
                                        projects={paginatedProjects}
                                        allUsers={allUsers}
                                        projectRevisions={projectRevisions}
                                        startIndex={(currentPage - 1) * rowsPerPage}
                                        onUpload={(project: Project) => { setUploadProject(project); setIsUploadModalOpen(true); }}
                                        onReview={(project: Project) => setReviewProject(project)}
                                        onAssets={(project: Project) => setSelectedProjectAssets(project)}
                                        onRespond={handleRespond}
                                        isResponding={isResponding}
                                    />
                                )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="space-y-12"
                        >
                            {/* Payout Settings Section */}
                            <div className="bg-card border border-border/50 rounded-[32px] p-8 lg:p-12 shadow-2xl shadow-black/5">
                                <div className="flex flex-col lg:flex-row gap-12">
                                    <div className="lg:w-1/3 space-y-4">
                                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Building2 size={28} />
                                        </div>
                                        <h2 className="text-2xl font-black text-foreground tracking-tight">Payout Settings</h2>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Configure how you receive your earnings. We support Direct Bank Transfer (IMPS) and UPI.
                                        </p>
                                        <div className="pt-4 flex items-center gap-2">
                                            <div className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                userData?.payoutDetails?.payoutStatus === 'active' 
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                            )}>
                                                {userData?.payoutDetails?.payoutStatus === 'active' ? 'Verified' : 'Verification Pending'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <PayoutSettingsForm 
                                            userId={user!.uid} 
                                            initialData={{
                                                bankDetails: userData?.bankDetails,
                                                upiDetails: userData?.upiDetails
                                            }} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-foreground tracking-tight">Earning History</h3>
                                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1 rounded-full border border-border/50">
                                        {financeProjects.length} Delivered Projects
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-3.5">
                                    {financeProjects.map((p, index) => (
                                        <FinanceRow key={p.id} project={p} index={index} />
                                    ))}
                                    {financeProjects.length === 0 && (
                                        <div className="py-20 text-center space-y-6 bg-muted/10 rounded-[32px] border border-dashed border-border/50">
                                            <div className="h-20 w-20 bg-muted/20 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground">
                                                <Banknote size={32} />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-lg font-black text-foreground">No earnings records</h3>
                                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Complete projects to start building your earning history.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {activeTab === "projects" && filteredProjects.length > 0 && (
                    <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card px-4 py-4 shadow-xl shadow-black/5 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-medium">Rows per page</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                className="h-9 rounded-lg border border-border/50 bg-background px-3 text-sm font-semibold text-foreground outline-none"
                            >
                                {[10, 20, 30].map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-40"
                                aria-label="Previous page"
                            >
                                <ChevronRight className="h-4 w-4 rotate-180" />
                            </button>

                            {Array.from({ length: totalProjectPages }, (_, index) => index + 1)
                                .slice(Math.max(0, currentPage - 3), Math.max(5, currentPage + 2))
                                .map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            "flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-all",
                                            currentPage === page
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border/50 bg-background text-foreground hover:border-primary/40 hover:text-primary"
                                        )}
                                    >
                                        {page}
                                    </button>
                                ))}

                            <button
                                onClick={() => setCurrentPage((page) => Math.min(totalProjectPages, page + 1))}
                                disabled={currentPage === totalProjectPages}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/50 bg-background text-primary transition-all hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* --- Modals --- */}
            <ReviewSystemModal 
                isOpen={!!reviewProject} 
                onClose={() => setReviewProject(null)} 
                project={reviewProject as any} 
                allowUploadDraft={reviewProject?.assignmentStatus === 'accepted'}
            />

            <AnimatePresence>
                {selectedProjectAssets && (
                    <AssetModal 
                        project={selectedProjectAssets} 
                        onClose={() => setSelectedProjectAssets(null)} 
                        onRespond={handleRespond}
                        isResponding={isResponding === selectedProjectAssets.id}
                    />
                )}
                {isUploadModalOpen && (
                    <UploadModal 
                        project={uploadProject!} 
                        onClose={() => setIsUploadModalOpen(false)} 
                        file={uploadFile}
                        onFileChange={handleFileChange}
                        description={uploadDescription}
                        setDescription={setUploadDescription}
                        onUpload={handleStartUpload}
                        isUploading={isUploading}
                        progress={uploadProg}
                        onCancel={abortRef.current}
                        previewUrl={uploadPreviewUrl}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Subcomponents ---

function ProjectCard({ project, pm, latestRevision, onUpload, onReview, onAssets, onRespond, isResponding }: any) {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (project.assignmentStatus === 'accepted' || project.assignmentStatus === 'rejected' || !project.assignmentExpiresAt) {
            setTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = project.assignmentExpiresAt - now;
            if (diff <= 0) {
                setTimeLeft("EXPIRED");
                clearInterval(interval);
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [project.assignmentStatus, project.assignmentExpiresAt]);

    const isPending = project.assignmentStatus !== 'accepted' && project.assignmentStatus !== 'rejected';
    const isAccepted = project.assignmentStatus === 'accepted';
    const isDeliveryLocked = isEditorDeliveredProject(project);

    return (
        <motion.div 
            whileHover={{ y: -6 }}
            className={cn(
                "group bg-card border border-border/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/5 hover:shadow-primary/10 transition-all flex flex-col relative",
                isPending && !isDeliveryLocked && "ring-4 ring-primary/30 bg-primary/[0.03] animate-pulse-subtle"
            )}
        >
            {/* Top Bar for status/timer */}
            <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-b border-border/50">
                <StatusBadge status={project.status} editorPaid={project.editorPaid} />
                {isPending && !isDeliveryLocked && timeLeft && (
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                        <Timer size={12} className={cn(timeLeft === 'EXPIRED' ? 'text-rose-500' : 'animate-pulse')} />
                        {timeLeft === 'EXPIRED' ? 'INVITATION EXPIRED' : `EXPIRES IN ${timeLeft}`}
                    </div>
                )}
                {!isPending && !isDeliveryLocked && project.deadline && (
                    <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest">
                        <Clock size={12} />
                        Due {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                )}
            </div>

            <div className="p-5 flex-1 space-y-4">
                {/* Header Section */}
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                        <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight line-clamp-1">
                            {project.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">
                            <span className="flex items-center gap-1.5"><User size={11} className="text-primary" /> {pm?.displayName || "System Manager"}</span>
                            <span className="flex items-center gap-1.5"><Users size={11} className="text-primary" /> {project.clientName || "Direct Client"}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black text-primary tracking-tighter">{formatCurrency(project.editorPrice)}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-50">Payout</div>
                    </div>
                </div>

                {/* Progress/Activity Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-0.5">
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Last Activity</div>
                        <div className="text-xs font-bold text-foreground truncate">
                            {latestRevision ? `Draft ${latestRevision.version}` : "No Drafts Uploaded"}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-0.5">
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Created On</div>
                        <div className="text-xs font-bold text-foreground">
                            {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                {/* Action Section */}
                <div className="flex items-center gap-2 pt-1">
                    {isDeliveryLocked ? (
                        <div className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-4 py-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Editor Share</span>
                            <span className={cn("text-[10px] font-black uppercase tracking-widest", project.editorPaid ? "text-emerald-500" : "text-amber-500")}>
                                {project.editorPaid ? "Paid by Admin" : "Payment Pending"}
                            </span>
                        </div>
                    ) : isPending ? (
                        <button 
                            onClick={onAssets}
                            className="flex-1 h-11 rounded-xl bg-primary text-white font-black text-xs shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 group/btn"
                        >
                            <Briefcase size={16} className="group-hover/btn:rotate-12 transition-transform" />
                            Review
                        </button>
                    ) : (
                        <>
                            {latestRevision && (
                                <button 
                                    onClick={onReview}
                                    className="flex-[3] h-11 rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <MessageCircle size={16} /> 
                                    Review
                                </button>
                            )}
                            <button 
                                onClick={onAssets}
                                className="h-11 w-11 rounded-lg bg-muted/50 border border-border/50 text-foreground flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                                title="Project Details & Assets"
                            >
                                <FileText size={16} />
                            </button>
                            {isAccepted && (
                                <button 
                                    onClick={onUpload}
                                    className="h-11 w-11 rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center"
                                    title="Upload New Draft"
                                >
                                    <Plus size={18} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function ProjectTable({ projects, allUsers, projectRevisions, startIndex = 0, onUpload, onReview, onAssets, onRespond, isResponding }: any) {
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(0);

    useEffect(() => {
        const tableContainer = tableContainerRef.current;
        const topScroll = topScrollRef.current;
        if (!tableContainer || !topScroll) return;

        const syncFromTable = () => {
            if (topScroll.scrollLeft !== tableContainer.scrollLeft) {
                topScroll.scrollLeft = tableContainer.scrollLeft;
            }
        };

        const syncFromTop = () => {
            if (tableContainer.scrollLeft !== topScroll.scrollLeft) {
                tableContainer.scrollLeft = topScroll.scrollLeft;
            }
        };

        tableContainer.addEventListener("scroll", syncFromTable);
        topScroll.addEventListener("scroll", syncFromTop);

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setTableWidth(entry.target.scrollWidth);
            }
        });

        observer.observe(tableContainer);
        setTableWidth(tableContainer.scrollWidth);
        syncFromTable();

        return () => {
            tableContainer.removeEventListener("scroll", syncFromTable);
            topScroll.removeEventListener("scroll", syncFromTop);
            observer.disconnect();
        };
    }, [projects, projectRevisions]);

    return (
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl shadow-black/5">
            <div
                ref={topScrollRef}
                className="overflow-x-auto overflow-y-hidden h-[6px] w-full transition-opacity duration-300"
                style={{ opacity: tableWidth > (tableContainerRef.current?.offsetWidth || 0) ? 1 : 0 }}
            >
                <div style={{ width: tableWidth, height: "1px" }} />
            </div>
            <div ref={tableContainerRef} className="overflow-x-auto">
                <table className="min-w-[1080px] w-full table-fixed text-left">
                    <colgroup>
                        <col className="w-[54px]" />
                        <col className="w-[230px]" />
                        <col className="w-[118px]" />
                        <col className="w-[118px]" />
                        <col className="w-[150px]" />
                        <col className="w-[118px]" />
                        <col className="w-[150px]" />
                        <col className="w-[112px]" />
                        <col className="w-[170px]" />
                    </colgroup>
                    <thead>
                        <tr className="bg-muted/30">
                            {["S.No", "Project", "Type", "PM", "Status", "Created", "Last Draft", "Editor Share", "Payment / Actions"].map((header) => (
                                <th key={header} className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {projects.map((project: Project, index: number) => (
                            <ProjectTableRow
                                key={project.id}
                                index={startIndex + index}
                                project={project}
                                pm={project.assignedPMId ? allUsers[project.assignedPMId] : undefined}
                                latestRevision={projectRevisions[project.id]}
                                onUpload={() => onUpload(project)}
                                onReview={() => onReview(project)}
                                onAssets={() => onAssets(project)}
                                onRespond={onRespond}
                                isResponding={isResponding === project.id}
                            />
                        ))}
                        {projects.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-6 py-16 text-center text-sm font-medium text-muted-foreground">
                                    No projects match this filter yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ProjectTableRow({ index, project, pm, latestRevision, onUpload, onReview, onAssets, onRespond, isResponding }: any) {
    const isPending = project.assignmentStatus !== "accepted" && project.assignmentStatus !== "rejected";
    const isAccepted = project.assignmentStatus === "accepted";
    const isDeliveryLocked = isEditorDeliveredProject(project);

    return (
        <tr className="align-top transition-colors hover:bg-muted/50 group">
            <td className="px-3 py-2 text-xs font-bold text-foreground/80 tabular-nums">{index + 1}</td>
            <td className="px-3 py-2">
                <div className="max-w-[230px]">
                    <p className="text-xs font-bold text-foreground leading-tight">{project.name}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">ID: {project.id.slice(0, 10)}</p>
                </div>
            </td>
            <td className="px-3 py-2 text-xs text-foreground font-semibold whitespace-nowrap">{project.videoFormat || project.videoType || "Not set"}</td>
            <td className="px-3 py-2 text-xs text-foreground font-semibold whitespace-nowrap">{pm?.displayName || "System Manager"}</td>
            <td className="px-3 py-2">
                <div className="space-y-1">
                    <StatusBadge status={project.status} editorPaid={project.editorPaid} />
                    {isPending && !isDeliveryLocked && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500">
                            <Clock size={12} className="animate-pulse" />
                            Awaiting Response
                        </div>
                    )}
                </div>
            </td>
            <td className="px-3 py-2 text-[11px] text-foreground/80 font-semibold whitespace-nowrap" suppressHydrationWarning>
                {project.createdAt
                    ? new Date(project.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                    })
                    : "N/A"}
            </td>
            <td className="px-3 py-2 text-xs font-semibold text-foreground">
                {latestRevision ? (
                    <div className="space-y-1">
                        <div>{`Draft ${latestRevision.version}`}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {latestRevision.description || "Revision uploaded"}
                        </div>
                    </div>
                ) : (
                    "No drafts yet"
                )}
            </td>
            <td className="px-3 py-2 text-xs font-black text-blue-400 whitespace-nowrap">{formatCurrency(project.editorPrice)}</td>
            <td className="px-3 py-2">
                <div className="flex min-w-[160px] flex-wrap gap-1.5">
                    {isDeliveryLocked ? (
                        <span className={cn(
                            "inline-flex rounded-lg border px-2.5 py-2 text-[10px] font-black uppercase tracking-widest",
                            project.editorPaid
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-500"
                        )}>
                            {project.editorPaid ? "Paid by Admin" : "Payment Pending"}
                        </span>
                    ) : isPending ? (
                        <button
                            onClick={onAssets}
                            className="h-8 px-3 rounded-lg bg-primary text-[10px] font-black uppercase tracking-widest text-white hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
                        >
                            <Briefcase size={12} />
                            Review
                        </button>
                    ) : (
                        <>
                            {latestRevision && (
                                <button onClick={onReview} className="h-8 rounded-lg bg-primary px-2.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                                    Review
                                </button>
                            )}
                            <button onClick={onAssets} className="h-8 rounded-lg border border-border/50 bg-muted/30 px-2.5 text-[10px] font-black uppercase tracking-widest text-foreground" title="View Project Details">
                                Details
                            </button>
                            {isAccepted && (
                                <button onClick={onUpload} className="h-8 rounded-lg bg-emerald-500 px-2.5 text-[10px] font-black uppercase tracking-widest text-white">
                                    Upload
                                </button>
                            )}
                        </>
                    )}
                    {!isPending && !isDeliveryLocked && (
                        <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                            Client details and uploads are available inside Assets.
                        </p>
                    )}
                </div>
            </td>
        </tr>
    );
}

function AssetSection({ title, icon: Icon, summary, children }: any) {
    return (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2.5 sm:gap-3">
                <div className={cn("mt-0.5 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl shrink-0", summary.hasData ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500")}>
                    <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-black text-foreground">{title}</h3>
                    <p className={cn("mt-0.5 sm:mt-1 text-[11px] sm:text-xs leading-relaxed truncate", summary.hasData ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400")} title={summary.value}>
                        {summary.value}
                    </p>
                </div>
            </div>
            {children}
        </div>
    );
}

function AssetModal({ project, onClose, onRespond, isResponding }: any) {
    const [showDeclineReason, setShowDeclineReason] = useState(false);
    const [reason, setReason] = useState("");
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (project.assignmentStatus === 'accepted' || project.assignmentStatus === 'rejected' || !project.assignmentExpiresAt) {
            setTimeLeft(null);
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = project.assignmentExpiresAt - now;
            if (diff <= 0) {
                setTimeLeft("EXPIRED");
                clearInterval(interval);
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [project.assignmentStatus, project.assignmentExpiresAt]);

    const isPending = project.assignmentStatus !== 'accepted' && project.assignmentStatus !== 'rejected';
    const resourceSummary = summarizeProjectResources(project);
    const scriptText = (project as any).scriptText;
    const clientReferenceFiles = (project.referenceFiles || []).filter((file: any) => !file?.uploadedBy);
    const pmReferenceFiles = (project.referenceFiles || []).filter((file: any) => Boolean(file?.uploadedBy));
    const groupedAssets = [
        {
            key: "raw",
            title: "Raw Footage",
            icon: FileVideo,
            summary: resourceSummary[0],
            files: project.rawFiles || [],
            links: [...(project.footageLinks || []), ...(project.footageLink ? [project.footageLink] : [])],
        },
        {
            key: "scripts",
            title: "Scripts & Directions",
            icon: FileText,
            summary: resourceSummary[1],
            files: project.scripts || [],
            links: [],
            text: scriptText,
        },
        {
            key: "pm_assets",
            title: "Manager Guidelines",
            icon: Briefcase,
            summary: resourceSummary[5],
            files: [...(project.pmFiles || []), ...pmReferenceFiles],
            links: [],
            remarks: project.pmRemarks,
        },
        {
            key: "audio",
            title: "Audio Assets",
            icon: Music,
            summary: resourceSummary[2],
            files: project.audioFiles || [],
            links: [],
        },
        {
            key: "references",
            title: "Style References",
            icon: Link2,
            summary: resourceSummary[3],
            files: clientReferenceFiles,
            links: [...(project.referenceLinks || []), ...(project.referenceLink ? [project.referenceLink] : [])],
        },
        {
            key: "broll",
            title: "B-Roll",
            icon: Layers,
            summary: resourceSummary[4],
            files: (project as any).bRoleFiles || [],
            links: [],
        },
    ];

    const handleAccept = async () => {
        await onRespond(project.id, 'accepted');
        onClose();
    };

    const handleDecline = async () => {
        if (!reason.trim()) {
            toast.error("Please provide a reason for declining.");
            return;
        }
        await onRespond(project.id, 'rejected', reason);
        onClose();
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-7xl bg-card border border-border/50 rounded-2xl shadow-3xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 sm:p-8 border-b border-border/50 flex items-center justify-between gap-4 sm:gap-6">
                    <div className="hidden sm:block flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-foreground">
                                {isPending ? "Project Assignment Briefing" : "Project Command Center"}
                            </h2>
                            {isPending && timeLeft && (
                                <div className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2",
                                    timeLeft === 'EXPIRED' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-primary/10 text-primary border-primary/20"
                                )}>
                                    <Timer size={12} className={timeLeft !== 'EXPIRED' ? "animate-pulse" : ""} />
                                    {timeLeft === 'EXPIRED' ? "Expired" : `Expires in ${timeLeft}`}
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 font-bold">{project.name}</p>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="px-4 py-3 rounded-xl border border-border/50 bg-muted/20">
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Brand/Client</p>
                                <p className="text-xs font-bold text-foreground truncate">{project.brand || project.clientName || "Direct Client"}</p>
                            </div>
                            <div className="px-4 py-3 rounded-xl border border-border/50 bg-muted/20">
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Video Type</p>
                                <p className="text-xs font-bold text-foreground truncate">{project.videoFormat || project.videoType || "Standard"}</p>
                            </div>
                            <div className="px-4 py-3 rounded-xl border border-border/50 bg-muted/20">
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-1">Status</p>
                                <div className="flex items-center gap-1.5">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", isPending ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                                    <p className="text-xs font-bold text-foreground">{isPending ? "Pending Assignment" : "Active Project"}</p>
                                </div>
                            </div>
                            <div className="px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
                                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-primary mb-1">Total Payout</p>
                                <p className="text-sm font-black text-primary">{formatCurrency(project.editorPrice)}</p>
                            </div>
                        </div>
                    </div>
                    {/* Compact mobile layout: title and brand box are hidden in favor of standard header row */}
                    <div className="sm:hidden flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate max-w-[150px]">
                                {project.brand || project.clientName || "Direct Client"}
                            </span>
                            {isPending && timeLeft && (
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0",
                                    timeLeft === 'EXPIRED' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-primary/10 text-primary border-primary/20"
                                )}>
                                    {timeLeft === 'EXPIRED' ? 'Expired' : timeLeft}
                                </span>
                            )}
                        </div>
                        <h2 className="text-sm font-black text-foreground truncate mt-0.5" title={project.name}>
                            {project.name}
                        </h2>
                    </div>
                    <div className="flex items-center shrink-0">
                        <button onClick={onClose} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center text-muted-foreground"><X size={18}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Project Description Section */}
                        <div className="md:col-span-2 rounded-2xl border border-border/50 bg-muted/5 p-4 sm:p-8 space-y-4 sm:space-y-6 relative overflow-hidden group">
                            {isPending && (
                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:opacity-[0.05] transition-all hidden sm:block">
                                    <FileText size={160} />
                                </div>
                            )}
                            <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </div>
                                Project Overview & Scope
                            </div>
                            <div className="space-y-3 sm:space-y-4 relative z-10">
                                <p className="text-sm sm:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
                                    {project.description || "No project description provided by the client."}
                                </p>
                                {isPending && (
                                    <div className="p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/10 text-[11px] sm:text-xs text-primary/80 font-bold flex items-center gap-2.5 sm:gap-3">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        Please review the scope and technical requirements before accepting this assignment.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Technical Specs Card */}
                        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-xl shadow-black/5">
                            <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </div>
                                Production Specs
                            </div>
                            <div className="space-y-3 sm:space-y-5">
                                {[
                                    { label: "Aspect Ratio", value: project.aspectRatio || "Not specified", icon: Layers },
                                    { label: "Est. Duration", value: project.duration ? `${project.duration} seconds` : "Flexible", icon: Clock },
                                    { label: "Final Format", value: project.videoFormat || "MP4/MOV", icon: Film },
                                    { label: "Deadline", value: project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : "ASAP", icon: Timer },
                                ].map((spec, i) => (
                                    <div key={i} className="flex items-center justify-between group/spec">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground group-hover/spec:text-primary transition-all group-hover/spec:scale-110 shrink-0">
                                                <spec.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            </div>
                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">{spec.label}</span>
                                        </div>
                                        <span className="text-xs font-black text-foreground">{spec.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                        {groupedAssets.map((section) => (
                            <AssetSection key={section.key} title={section.title} icon={section.icon} summary={section.summary}>
                                {section.remarks && (
                                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle size={14} className="text-amber-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">PM Remarks</p>
                                        </div>
                                        <p className="text-xs leading-relaxed text-foreground font-medium italic">"{section.remarks}"</p>
                                    </div>
                                )}
                                {section.text && (
                                    <div className="rounded-xl border border-border/50 bg-background/60 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pasted Brief</p>
                                        <p className="mt-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">{section.text}</p>
                                    </div>
                                )}
                                {section.links.length > 0 && (
                                    <div className="space-y-2">
                                        {section.links.map((link: string, index: number) => (
                                            <a
                                                key={section.key + '-link-' + index}
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-xs text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                                            >
                                                <Link2 size={14} className="shrink-0" />
                                                <span className="truncate">{link}</span>
                                                <ExternalLink size={12} className="ml-auto shrink-0" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {section.files.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {section.files.map((asset: any, index: number) => (
                                            <FilePreview key={section.key + '-file-' + index} file={asset} index={index} />
                                        ))}
                                    </div>
                                ) : !section.text && section.links.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border/50 bg-background/40 px-4 py-5 text-xs text-muted-foreground">
                                        {section.summary.value}
                                    </div>
                                ) : null}
                            </AssetSection>
                        ))}
                    </div>
                </div>

                {/* Assignment Response Footer */}
                {isPending && (
                    <div className="p-8 bg-muted/20 border-t border-border/50">
                        {showDeclineReason ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-2xl mx-auto">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reason for declining</label>
                                    <Textarea 
                                        placeholder="Please let us know why you are declining this project..."
                                        className="min-h-[100px] text-sm rounded-2xl bg-background border-border/50 focus:border-primary/50 shadow-inner p-4"
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setShowDeclineReason(false)}
                                        className="flex-1 h-14 rounded-2xl bg-muted text-foreground font-black text-xs hover:bg-muted/80 transition-all"
                                    >
                                        Go Back
                                    </button>
                                    <button 
                                        disabled={!reason.trim() || isResponding}
                                        onClick={handleDecline}
                                        className="flex-[2] h-14 rounded-2xl bg-destructive text-destructive-foreground font-black text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isResponding ? <Loader2 className="animate-spin" size={18} /> : "Confirm & Decline Assignment"}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button 
                                    disabled={isResponding}
                                    onClick={handleAccept}
                                    className="w-full sm:w-80 h-16 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
                                >
                                    {isResponding ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" /> 
                                            Accept & Start Project
                                        </>
                                    )}
                                </button>
                                <button 
                                    disabled={isResponding}
                                    onClick={() => setShowDeclineReason(true)}
                                    className="w-full sm:w-48 h-16 rounded-2xl bg-muted/50 border border-border/50 text-muted-foreground font-black text-xs hover:bg-muted active:scale-95 transition-all"
                                >
                                    Decline Project
                                </button>
                            </div>
                        )}
                        <p className="text-center text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-widest opacity-60">
                            Once accepted, the project will move to your active workspace and direct uploads will be enabled.
                        </p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

function FinanceRow({ project, index }: { project: Project; index: number }) {
    const formattedDate = project.updatedAt
        ? new Date(project.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "N/A";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.02, ease: "easeOut" }}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-border/50 bg-card hover:bg-muted/10 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
        >
            <div className="flex items-center gap-4 min-w-0">
                {/* Status Indicator Icon */}
                <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-105",
                    project.editorPaid 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                )}>
                    {project.editorPaid ? <CheckCircle2 size={22} /> : <Banknote size={22} />}
                </div>

                {/* Project Info */}
                <div className="min-w-0 space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors truncate">
                        {project.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-75">
                        <span className="flex items-center gap-1">
                            <Clock size={11} /> 
                            {project.editorPaid ? "Completed" : "Delivered"} {formattedDate}
                        </span>
                        {project.videoFormat && (
                            <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-bold">
                                {project.videoFormat}
                            </span>
                        )}
                        {project.category && (
                            <span className="hidden xs:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-bold">
                                {project.category}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Price & Status Badge */}
            <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-border/30 pt-3 sm:pt-0 sm:border-t-0">
                <div className="sm:text-right">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60 sm:hidden">Earnings</p>
                    <p className="text-base sm:text-lg font-black text-primary tracking-tighter">
                        {formatCurrency(project.editorPrice)}
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all",
                        project.editorPaid 
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                        {project.editorPaid ? "Paid by Admin" : "Not Paid"}
                    </span>
                </div>
            </div>
        </motion.div>
    );
}

function UploadModal({ project, onClose, file, onFileChange, description, setDescription, onUpload, isUploading, progress, onCancel, previewUrl }: any) {
    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-2xl bg-card border border-border/50 rounded-2xl shadow-3xl overflow-hidden p-10 space-y-8"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black text-foreground">Upload Revision</h2>
                    <p className="text-sm text-muted-foreground">Uploading for {project.name}</p>
                </div>

                {!isUploading ? (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Video File</Label>
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:bg-muted/30 hover:border-primary/50 transition-all group overflow-hidden relative">
                                {previewUrl ? (
                                    <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadCloud className="w-12 h-12 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <p className="mb-2 text-sm text-foreground font-bold">Click to upload or drag and drop</p>
                                        <p className="text-xs text-muted-foreground">MP4, MOV, WEBM (Max {MAX_FILE_SIZE_GB}GB)</p>
                                    </div>
                                )}
                                <input type="file" className="hidden" accept="video/*" onChange={onFileChange} />
                                {file && (
                                    <div className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-background/80 backdrop-blur-md border border-border/50 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-foreground truncate max-w-[200px]">{file.name}</span>
                                        <span className="text-[10px] font-black text-primary">{(file.size / (1024*1024)).toFixed(1)} MB</span>
                                    </div>
                                )}
                            </label>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Work Summary / Patch Notes</Label>
                            <Textarea 
                                placeholder="What changes were made in this draft?"
                                className="min-h-[120px] rounded-xl bg-muted/30 border-border/50 focus:border-primary/50"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button onClick={onClose} className="flex-1 h-14 rounded-2xl border border-border/50 font-bold text-sm hover:bg-muted transition-colors">Cancel</button>
                            <button 
                                onClick={onUpload}
                                disabled={!file}
                                className="flex-[2] h-14 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                            >
                                Start Upload Pipeline
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 py-10">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative h-32 w-32">
                                <svg className="h-full w-full" viewBox="0 0 100 100">
                                    <circle className="text-muted/20 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent" />
                                    <circle 
                                        className="text-primary stroke-current transition-all duration-500 ease-out" 
                                        strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent" 
                                        strokeDasharray="251.2" 
                                        strokeDashoffset={251.2 - (251.2 * (progress?.percent || 0)) / 100}
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black text-foreground">{Math.round(progress?.percent || 0)}%</span>
                                </div>
                            </div>

                            <div className="text-center space-y-1">
                                <p className="text-sm font-black text-foreground uppercase tracking-widest">Streaming to AWS S3</p>
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase">
                                    <span>{UploadService.formatSpeed(progress?.speedBps || 0)}</span>
                                    <span>{UploadService.formatEta(progress?.eta || 0)} remaining</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-muted-foreground">Total Transferred</span>
                                <span className="text-primary">{UploadService.formatBytes(progress?.transferred || 0)} / {UploadService.formatBytes(progress?.total || 0)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress?.percent || 0}%` }} />
                            </div>
                        </div>

                        <button 
                            onClick={onCancel as any}
                            className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
                        >
                            Abort Upload
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

function PayoutSettingsForm({ userId, initialData }: { userId: string, initialData: any }) {
    const [payoutMode, setPayoutMode] = useState<'bank' | 'upi'>(initialData.upiDetails?.vpa ? 'upi' : 'bank');
    const [bankDetails, setBankDetails] = useState(initialData.bankDetails || { accountHolderName: "", accountNumber: "", ifscCode: "" });
    const [upiDetails, setUpiDetails] = useState(initialData.upiDetails || { vpa: "" });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await updateEditorPayoutDetails(userId, {
                bankDetails: payoutMode === 'bank' ? bankDetails : undefined,
                upiDetails: payoutMode === 'upi' ? upiDetails : undefined
            });

            if (res.success) {
                toast.success("Payout details updated successfully!");
            } else {
                toast.error(res.error || "Failed to update details.");
            }
        } catch (err) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex p-1.5 bg-muted/40 rounded-2xl border border-border/50 w-full sm:w-fit">
                <button 
                    onClick={() => setPayoutMode('bank')}
                    className={cn("flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", payoutMode === 'bank' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                >
                    <CreditCard size={14} /> Bank Account
                </button>
                <button 
                    onClick={() => setPayoutMode('upi')}
                    className={cn("flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", payoutMode === 'upi' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                >
                    <Hash size={14} /> UPI ID
                </button>
            </div>

            <div className="space-y-6">
                {payoutMode === 'bank' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Holder Name</Label>
                            <Input 
                                placeholder="As per bank records"
                                value={bankDetails.accountHolderName}
                                onChange={e => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
                                className="h-12 bg-muted/20 border-border/50 rounded-xl px-4 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">IFSC Code</Label>
                            <Input 
                                placeholder="SBIN0001234"
                                value={bankDetails.ifscCode}
                                onChange={e => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                                className="h-12 bg-muted/20 border-border/50 rounded-xl px-4 font-bold uppercase"
                            />
                        </div>
                        <div className="col-span-full space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                            <div className="relative">
                                <Input 
                                    type="password"
                                    placeholder="Enter your account number"
                                    value={bankDetails.accountNumber}
                                    onChange={e => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                                    className="h-12 bg-muted/20 border-border/50 rounded-xl px-4 font-bold tracking-widest"
                                />
                                <CreditCard size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">UPI ID (VPA)</Label>
                        <div className="relative">
                            <Input 
                                placeholder="username@upi"
                                value={upiDetails.vpa}
                                onChange={e => setUpiDetails({ vpa: e.target.value })}
                                className="h-12 bg-muted/20 border-border/50 rounded-xl px-4 font-bold lowercase"
                            />
                            <Hash size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">Common suffixes: @okaxis, @okicici, @paytm, @ybl</p>
                    </div>
                )}
            </div>

            <Button 
                onClick={handleSave}
                disabled={isSaving}
                className="h-14 w-full sm:w-64 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all gap-3"
            >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                Save Details
            </Button>
        </div>
    );
}

