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
    Download,
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
    Play,
    PlusSquare,
    CheckCircle,
    Building2,
    Hash,
    CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ReviewSystemModal } from "./review-system-modal";
import { preloadVideosIntoMemory, warmVideoInMemory } from "@/lib/video-preload";
import { VideoPlayer } from "@/components/video-player";
import { UploadService, UploadProgress } from "@/lib/services/upload-service";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_GB } from "@/lib/constants";
import { handleRevisionUploaded } from "@/app/actions/notification-actions";
import { useVideoTranscodeStatus } from "@/hooks/use-video-transcode-status";
import { respondToAssignment } from "@/app/actions/admin-actions";
import { updateEditorPayoutDetails } from "@/app/actions/payout-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// --- Components ---

function StatusBadge({ status }: { status: string }) {
    const colors = {
        active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        in_production: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        in_review: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        completed_pending_payment: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        editor_assigned: "bg-sky-500/10 text-sky-500 border-sky-500/20",
        editor_not_assigned: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    } as any;

    const label = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    return (
        <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all hover:brightness-110", colors[status] || "bg-muted text-muted-foreground")}>
            {label}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, subValue, trend, variant = "default" }: any) {
    return (
        <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className={cn(
                "p-6 rounded-[32px] bg-card border border-border/50 shadow-xl shadow-black/5 relative overflow-hidden group transition-all",
                variant === "primary" && "bg-primary/5 border-primary/20"
            )}
        >
            <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all group-hover:rotate-12 group-hover:scale-110">
                <Icon size={120} />
            </div>
            <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-3",
                        variant === "primary" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-primary/10 text-primary"
                    )}>
                        <Icon size={24} />
                    </div>
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</div>
                </div>
                <div>
                    <div className="text-3xl font-black text-foreground tracking-tighter flex items-baseline gap-2">
                        {value}
                        {trend && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{trend}</span>}
                    </div>
                    {subValue && <div className="text-xs font-bold text-muted-foreground mt-1 opacity-70">{subValue}</div>}
                </div>
            </div>
        </motion.div>
    );
}

// --- Main Dashboard ---

export function EditorDashboardV2() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [allUsers, setAllUsers] = useState<any>({});
    const [projectRevisions, setProjectRevisions] = useState<Record<string, any>>({});
    const [activeTab, setActiveTab] = useState<'projects' | 'finance'>('projects');
    const [searchQuery, setSearchQuery] = useState("");
    const [isResponding, setIsResponding] = useState<string | null>(null); // projectId
    
    // Review/Modal States
    const [reviewProject, setReviewProject] = useState<Project | null>(null);
    const [selectedProjectAssets, setSelectedProjectAssets] = useState<Project | null>(null);
    const [previewVideo, setPreviewVideo] = useState<any | null>(null);
    
    // Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadProject, setUploadProject] = useState<Project | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
    const [uploadDescription, setUploadDescription] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProg, setUploadProg] = useState<UploadProgress | null>(null);
    const abortRef = useRef<(() => void) | null>(null);

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

    const filteredProjects = projects.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const earnings = projects.filter(p => ['completed', 'approved', 'completed_pending_payment'].includes(p.status));
    const totalPaid = earnings.filter(p => p.editorPaid).reduce((acc, p) => acc + (p.editorPrice || 0), 0);
    const pendingEarnings = earnings.filter(p => !p.editorPaid).reduce((acc, p) => acc + (p.editorPrice || 0), 0);

    if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* --- Premium Header --- */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                            <Film size={20} />
                        </div>
                        <h1 className="text-xl font-black tracking-tight text-foreground hidden sm:block">Editor Dashboard</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Status Toggle */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
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
                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shadow-inner">
                                {user?.displayName?.charAt(0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 pt-10 space-y-10">
                {/* --- Stats Overview --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={Gauge} label="Active Projects" value={projects.filter(p => ['active', 'in_production', 'in_review'].includes(p.status)).length} trend="+2 new" variant="primary" />
                    <StatCard icon={CheckCircle2} label="Completed" value={earnings.length} trend="All Time" />
                    <StatCard icon={Banknote} label="Paid Earnings" value={`₹${totalPaid.toLocaleString()}`} subValue="Successfully settled" />
                    <StatCard icon={Wallet} label="Pending" value={`₹${pendingEarnings.toLocaleString()}`} subValue="Awaiting client settlement" />
                </div>

                {/* --- Project Controls --- */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex p-1.5 bg-muted/40 rounded-2xl border border-border/50 w-fit">
                        <button 
                            onClick={() => setActiveTab('projects')}
                            className={cn("px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'projects' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                        >
                            <LayoutDashboard size={14} /> Projects
                        </button>
                        <button 
                            onClick={() => setActiveTab('finance')}
                            className={cn("px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", activeTab === 'finance' ? "bg-background text-primary shadow-lg shadow-black/5" : "text-muted-foreground hover:text-foreground")}
                        >
                            <Wallet size={14} /> Finance
                        </button>
                    </div>

                    <div className="relative group flex-1 md:max-w-md">
                        <input 
                            type="text"
                            placeholder="Search projects by name..."
                            className="w-full h-12 pl-12 pr-6 rounded-2xl bg-card border border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <Eye className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                    </div>
                </div>

                {/* --- Project List --- */}
                <AnimatePresence mode="wait">
                    {activeTab === 'projects' ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 xl:grid-cols-2 gap-8"
                        >
                            {filteredProjects.map((project, idx) => (
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
                            ))}
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
                                        {earnings.length} Projects
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {earnings.map((p) => (
                                        <FinanceCard key={p.id} project={p} />
                                    ))}
                                    {earnings.length === 0 && (
                                        <div className="col-span-full py-20 text-center space-y-6 bg-muted/10 rounded-[32px] border border-dashed border-border/50">
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
                    <AssetModal project={selectedProjectAssets} onClose={() => setSelectedProjectAssets(null)} onPreview={setPreviewVideo} />
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
                {previewVideo && (
                    <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Subcomponents ---

function ProjectCard({ project, pm, latestRevision, onUpload, onReview, onAssets, onRespond, isResponding }: any) {
    const [showDeclineReason, setShowDeclineReason] = useState(false);
    const [reason, setReason] = useState("");
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        if (project.assignmentStatus !== 'pending' || !project.assignmentExpiresAt) {
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

    const isPending = project.assignmentStatus === 'pending';
    const isAccepted = project.assignmentStatus === 'accepted';

    return (
        <motion.div 
            whileHover={{ y: -6 }}
            className={cn(
                "group bg-card border border-border/50 rounded-2xl overflow-hidden shadow-2xl shadow-black/5 hover:shadow-primary/10 transition-all flex flex-col relative",
                isPending && "ring-4 ring-primary/30 bg-primary/[0.03] animate-pulse-subtle"
            )}
        >
            {/* Top Bar for status/timer */}
            <div className="flex items-center justify-between px-8 py-4 bg-muted/20 border-b border-border/50">
                <StatusBadge status={project.status} />
                {isPending && timeLeft && (
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                        <Timer size={14} className={cn(timeLeft === 'EXPIRED' ? 'text-rose-500' : 'animate-pulse')} />
                        {timeLeft === 'EXPIRED' ? 'INVITATION EXPIRED' : `EXPIRES IN ${timeLeft}`}
                    </div>
                )}
                {!isPending && project.deadline && (
                    <div className="flex items-center gap-2 text-rose-500 font-black text-[10px] uppercase tracking-widest">
                        <Clock size={14} />
                        Due {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                )}
            </div>

            <div className="p-8 flex-1 space-y-8">
                {/* Header Section */}
                <div className="flex items-start justify-between gap-6">
                    <div className="space-y-2 flex-1">
                        <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight line-clamp-1">
                            {project.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">
                            <span className="flex items-center gap-1.5"><User size={12} className="text-primary" /> {pm?.displayName || "System Manager"}</span>
                            <span className="flex items-center gap-1.5"><Users size={12} className="text-primary" /> {project.clientName || "Direct Client"}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-primary tracking-tighter">₹{project.editorPrice?.toLocaleString()}</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-50">Payout</div>
                    </div>
                </div>

                {/* Progress/Activity Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Last Activity</div>
                        <div className="text-sm font-bold text-foreground truncate">
                            {latestRevision ? `Draft ${latestRevision.version}` : "No Drafts Uploaded"}
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
                        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Created On</div>
                        <div className="text-sm font-bold text-foreground">
                            {new Date(project.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                {/* Action Section */}
                {isPending ? (
                    <div className="space-y-4 pt-2">
                        {showDeclineReason ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                                <Textarea 
                                    placeholder="Briefly explain why you are declining..."
                                    className="min-h-[100px] text-sm rounded-xl bg-background border-border/50 focus:border-primary/50 shadow-inner p-4"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setShowDeclineReason(false)}
                                        className="flex-1 h-12 rounded-xl bg-muted text-foreground font-black text-xs hover:bg-muted/80 transition-all"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        disabled={!reason.trim() || isResponding}
                                        onClick={() => onRespond(project.id, 'rejected', reason)}
                                        className="flex-[2] h-12 rounded-xl bg-destructive text-destructive-foreground font-black text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                    >
                                        {isResponding ? <Loader2 className="animate-spin" size={18} /> : "Confirm Decline"}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button 
                                    disabled={isResponding}
                                    onClick={() => onRespond(project.id, 'accepted')}
                                    className="flex-[3] h-16 rounded-xl bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
                                >
                                    {isResponding ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" /> 
                                            Accept Project
                                        </>
                                    )}
                                </button>
                                <button 
                                    disabled={isResponding}
                                    onClick={() => setShowDeclineReason(true)}
                                    className="flex-1 h-16 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground font-black text-xs hover:bg-muted active:scale-95 transition-all"
                                >
                                    Decline
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-3 pt-2">
                        {latestRevision && (
                            <button 
                                onClick={onReview}
                                className="flex-[3] h-14 rounded-xl bg-primary text-primary-foreground font-black text-xs shadow-xl shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <MessageCircle size={18} /> 
                                Review
                            </button>
                        )}
                        <button 
                            onClick={onAssets}
                            className="h-14 w-14 rounded-xl bg-muted/50 border border-border/50 text-foreground flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                            title="Project Assets"
                        >
                            <Layers size={18} />
                        </button>
                        {isAccepted && (
                            <button 
                                onClick={onUpload}
                                className="h-14 w-14 rounded-xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center"
                                title="Upload New Draft"
                            >
                                <Plus size={24} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function AssetModal({ project, onClose, onPreview }: any) {
    const assets = [...(project.rawFiles || []), ...(project.pmFiles || [])];

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-5xl bg-card border border-border/50 rounded-2xl shadow-3xl overflow-hidden flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-border/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Project Assets</h2>
                        <p className="text-sm text-muted-foreground mt-1">{project.name} • {assets.length} Files</p>
                    </div>
                    <button onClick={onClose} className="h-12 w-12 rounded-2xl bg-muted hover:bg-muted/80 transition-colors flex items-center justify-center"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assets.map((asset, i) => (
                        <AssetItem key={i} asset={asset} onPreview={() => onPreview(asset)} />
                    ))}
                    {assets.length === 0 && <div className="col-span-full py-20 text-center text-muted-foreground">No assets found for this project.</div>}
                </div>
            </motion.div>
        </motion.div>
    );
}

function FinanceCard({ project }: any) {
    return (
        <div className="bg-card border border-border/50 rounded-xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Banknote size={24} />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Earnings</p>
                    <p className="text-xl font-black text-foreground">₹{project.payout || "0"}</p>
                </div>
            </div>
            <div className="space-y-1">
                <h4 className="font-bold text-foreground truncate">{project.name}</h4>
                <p className="text-xs text-muted-foreground">Completed on {new Date(project.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-500 uppercase">Paid</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{project.category}</span>
            </div>
        </div>
    );
}


function AssetItem({ asset, onPreview }: any) {
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(asset.name) || asset.type?.startsWith('video/');
    const transcode = useVideoTranscodeStatus(asset.url || "", asset.name || "");

    return (
        <div className="group border border-border/50 rounded-xl overflow-hidden bg-muted/10 hover:bg-muted/20 transition-all flex flex-col">
            <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
                {isVideo ? (
                    <>
                        <video src={transcode.videoUrl || asset.url} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <button 
                                onClick={onPreview}
                                className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                            >
                                <Play size={20} fill="currentColor" />
                            </button>
                        </div>
                        {transcode.status === 'processing' && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20">
                                <Loader2 className="animate-spin text-white" size={20} />
                                <span className="text-[9px] font-black text-white uppercase tracking-widest">Optimizing...</span>
                            </div>
                        )}
                    </>
                ) : (
                    <FileVideo size={40} className="text-muted-foreground/30" />
                )}
            </div>
            <div className="p-4 space-y-2">
                <p className="text-xs font-bold text-foreground truncate">{asset.name}</p>
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-black">{(asset.size / (1024*1024)).toFixed(1)} MB</span>
                    <a 
                        href={asset.url} 
                        download={asset.name}
                        className="h-8 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all hover:text-white"
                        onClick={e => e.stopPropagation()}
                    >
                        <Download size={12} /> Save
                    </a>
                </div>
            </div>
        </div>
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

function VideoPreviewModal({ video, onClose }: any) {
    const transcode = useVideoTranscodeStatus(video.url || "", video.name || "");
    const isMux = video.storagePath?.startsWith("mux://") || video.url?.startsWith("mux://");
    const playbackId = (transcode.status === "ready" && isMux) ? transcode.videoUrl : null;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden shadow-4xl" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-6 right-6 h-12 w-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-xl z-50 transition-all active:scale-95"><X size={24}/></button>
                <VideoPlayer 
                    videoPath={transcode.videoUrl || video.url}
                    playbackId={playbackId || undefined}
                    title={video.name}
                    autoPlay={true}
                />
            </div>
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
