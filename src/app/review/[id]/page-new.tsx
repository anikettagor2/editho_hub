"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Loader2, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ReviewSystemModal } from "@/app/dashboard/components/review-system-modal";

type RevisionDoc = {
    id: string;
    projectId: string;
    version?: number;
    videoUrl?: string;
    hlsUrl?: string;
    fileSize?: number;
    description?: string;
    createdAt?: number;
};

export default function GuestReviewPage() {
    const params = useParams();
    const revisionId = (Array.isArray(params?.id) ? params?.id[0] : params?.id) as string;

    const [revision, setRevision] = useState<RevisionDoc | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Guest info state
    const [guestName, setGuestName] = useState("");
    const [isIdentified, setIsIdentified] = useState(false);

    useEffect(() => {
        if (!revisionId) return;

        const unsub = onSnapshot(
            doc(db, "revisions", revisionId),
            async (revSnap) => {
                if (!revSnap.exists()) {
                    toast.error("Review link is invalid or expired.");
                    setLoading(false);
                    return;
                }
                const revData = { id: revSnap.id, ...revSnap.data() } as RevisionDoc;
                
                setRevision(revData);

                if (!project) {
                    try {
                        const projSnap = await getDoc(doc(db, "projects", revData.projectId));
                        if (projSnap.exists()) {
                            setProject({ id: projSnap.id, ...projSnap.data() });
                        }
                    } catch { /* non-critical */ }
                }

                setLoading(false);
            },
            (error) => {
                console.error("Failed to load review data:", error);
                toast.error("Error loading review system.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [revisionId]);

    // Watermark
    useEffect(() => {
        const name = project?.clientName || project?.name;
        if (!name) return;
        document.body.dataset.watermarkName = name;
        return () => { delete document.body.dataset.watermarkName; };
    }, [project]);

    const handleIdentify = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName.trim()) {
            toast.error("Please enter your name to continue.");
            return;
        }
        setIsIdentified(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm font-medium">Initializing Secure Review Link...</p>
                </div>
            </div>
        );
    }

    if (!revision) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-4">
                    <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                        <ShieldAlert className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Review Link Expired</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        This review link is no longer valid. Please contact the project administrator for a new shareable link.
                    </p>
                </div>
            </div>
        );
    }

    if (!isIdentified) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm"
                >
                    <div className="text-center space-y-2 mb-8">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Access Shared Review</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{project?.name || "Video Project"}</p>
                    </div>

                    <form onSubmit={handleIdentify} className="space-y-4 bg-muted/20 p-8 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
                            <input 
                                autoFocus
                                type="text" 
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Enter your full name"
                                className="w-full h-11 bg-black/40 border border-white/10 rounded-lg px-4 text-sm focus:outline-none focus:border-primary/50 transition-all"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full h-11 bg-primary text-primary-foreground rounded-lg text-sm font-bold uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all"
                        >
                            Start Reviewing
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    return (
        <ReviewSystemModal
            isOpen={true}
            onClose={() => {}}
            project={project}
            allowUploadDraft={false}
            guestPreview={true}
            guestName={guestName}
            defaultRevisionId={revisionId}
        />
    );
}