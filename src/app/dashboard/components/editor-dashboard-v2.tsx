"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs, limit, setDoc } from "firebase/firestore";
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
    Play
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

// --- Components ---

function StatusBadge({ status }: { status: string }) {
    const colors = {
        active: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        in_review: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        completed_pending_payment: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    } as any;

    const label = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    return (
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", colors[status] || "bg-muted text-muted-foreground")}>
            {label}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, subValue, trend }: any) {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-3xl bg-card border border-border/50 shadow-xl shadow-black/5 relative overflow-hidden group"
        >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                <Icon size={80} />
            </div>
            <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Icon size={24} />
                </div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
            </div>
            <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-foreground tracking-tight">{value}</div>
                {trend && <div className="text-xs font-bold text-emerald-500">{trend}</div>}
            </div>
            {subValue && <div className="text-sm text-muted-foreground mt-1">{subValue}</div>}
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
            await setDoc(doc(revisionsRef, revisionId), {
                id: revisionId,
                projectId,
                version: nextVersion,
                videoUrl: "",
                status: "active",
                uploadedBy: user.uid,
                createdAt: Date.now(),
                description: uploadDescription,
            });

            await setDoc(doc(db, "video_jobs", revisionId), {
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
            toast.success("Revision uploaded successfully!");
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadDescription("");
            if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
            setUploadPreviewUrl(null);
        } catch (err) {
            console.error("Upload failed:", err);
            toast.error("Upload failed. Check your connection.");
        } finally {
            setIsUploading(false);
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
                        <h1 className="text-xl font-black tracking-tight text-foreground">Editor Dashboard</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Status Toggle */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                            <div className={cn("h-2 w-2 rounded-full", userData?.availabilityStatus === 'online' ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                            <select 
                                className="bg-transparent text-[10px] font-bold uppercase tracking-widest outline-none cursor-pointer"
                                value={userData?.availabilityStatus || 'offline'}
                                onChange={(e) => updateDoc(doc(db, "users", user!.uid), { availabilityStatus: e.target.value })}
                            >
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="sleep">Sleep</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-foreground">{user?.displayName}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Master Editor</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                                {user?.displayName?.charAt(0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 pt-10 space-y-10">
                {/* --- Stats Overview --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={Gauge} label="Active Projects" value={projects.filter(p => p.status === 'active').length} trend="+2 this week" />
                    <StatCard icon={CheckCircle2} label="Completed" value={earnings.length} trend="+12 total" />
                    <StatCard icon={Banknote} label="Paid Earnings" value={`₹${totalPaid.toLocaleString()}`} trend="Withdrawal Ready" />
                    <StatCard icon={Wallet} label="Pending Payment" value={`₹${pendingEarnings.toLocaleString()}`} subValue="Awaiting client approval" />
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
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
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
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="bg-card border border-border/50 rounded-[32px] overflow-hidden shadow-2xl"
                        >
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 border-b border-border/50">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project Name</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Editor Price</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Completion Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {earnings.map((p) => (
                                        <tr key={p.id} className="hover:bg-muted/10 transition-colors group">
                                            <td className="px-8 py-6">
                                                <p className="text-sm font-bold text-foreground">{p.name}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">ID: {p.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="px-8 py-6 font-black text-foreground">₹{p.editorPrice?.toLocaleString()}</td>
                                            <td className="px-8 py-6">
                                                {p.editorPaid ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-500 font-bold text-xs">
                                                        <CheckCircle2 size={14} /> Paid
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                                                        <Clock size={14} /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-sm text-muted-foreground">
                                                {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {earnings.length === 0 && (
                                <div className="py-20 text-center space-y-4">
                                    <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                                        <Banknote size={32} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No financial records found yet.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* --- Modals --- */}
            <ReviewSystemModal 
                isOpen={!!reviewProject} 
                onClose={() => setReviewProject(null)} 
                project={reviewProject as any} 
                allowUploadDraft={true}
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

function ProjectCard({ project, pm, latestRevision, onUpload, onReview, onAssets }: any) {
    return (
        <motion.div 
            whileHover={{ y: -4 }}
            className="group bg-card border border-border/50 rounded-[32px] p-6 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-primary/5 transition-all space-y-6"
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <StatusBadge status={project.status} />
                    <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors">{project.name}</h3>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(project.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1.5"><User size={12} /> {pm?.displayName || "System"}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="text-xs font-black text-foreground">₹{project.editorPrice?.toLocaleString()}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-tighter">Assigned Rate</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Latest Revision</div>
                    <div className="text-xs font-bold text-foreground">
                        {latestRevision ? `Version ${latestRevision.version}` : "No drafts yet"}
                    </div>
                </div>
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-1">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Client Contact</div>
                    <div className="text-xs font-bold text-foreground truncate">{project.clientName || "Protected"}</div>
                </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
                <button 
                    onClick={onReview}
                    className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-xs shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <MessageCircle size={16} /> Open Action Center
                </button>
                <button 
                    onClick={onAssets}
                    className="h-12 px-6 rounded-2xl bg-muted/50 border border-border/50 text-foreground font-bold text-xs hover:bg-muted active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Layers size={16} /> Assets
                </button>
                <button 
                    onClick={onUpload}
                    className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center justify-center"
                    title="Upload New Draft"
                >
                    <Plus size={20} />
                </button>
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
                className="w-full max-w-5xl bg-card border border-border/50 rounded-[40px] shadow-3xl overflow-hidden flex flex-col max-h-[80vh]"
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

function AssetItem({ asset, onPreview }: any) {
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(asset.name) || asset.type?.startsWith('video/');
    const transcode = useVideoTranscodeStatus(asset.url || "", asset.name || "");

    return (
        <div className="group border border-border/50 rounded-[24px] overflow-hidden bg-muted/10 hover:bg-muted/20 transition-all flex flex-col">
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
                className="w-full max-w-2xl bg-card border border-border/50 rounded-[40px] shadow-3xl overflow-hidden p-10 space-y-8"
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
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/50 rounded-[32px] cursor-pointer hover:bg-muted/30 hover:border-primary/50 transition-all group overflow-hidden relative">
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
                                placeholder="What changes were made in this version?"
                                className="min-h-[120px] rounded-[24px] bg-muted/30 border-border/50 focus:border-primary/50"
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
                    accentColor="#3b82f6"
                    className="w-full h-full"
                />
            </div>
        </motion.div>
    );
}
