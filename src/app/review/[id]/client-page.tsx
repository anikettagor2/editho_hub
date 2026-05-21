"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Loader2, ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ReviewSystemModal } from "@/app/dashboard/components/review-system-modal";

type RevisionData = {
    id: string;
    projectId: string;
    version?: number;
    videoUrl?: string;
    hlsUrl?: string;
    playbackId?: string;
    fileSize?: number;
    description?: string;
    createdAt?: number;
};

type ReviewProject = {
    id: string;
    name?: string;
    clientName?: string;
    totalCost?: number;
    amountPaid?: number;
    paymentStatus?: string;
    editorRating?: number;
    editorReview?: string;
    ownerId?: string;
    clientId?: string;
    assignedEditorId?: string;
    assignedPMId?: string;
    createdAt?: number;
    isPayLaterRequest?: boolean;
};

interface GuestReviewPageClientProps {
    revisionId: string;
}

export default function GuestReviewPageClient({ revisionId }: GuestReviewPageClientProps) {
    const [revision, setRevision] = useState<RevisionData | null>(null);
    const [project, setProject] = useState<ReviewProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [guestName, setGuestName] = useState("");
    const [isIdentified, setIsIdentified] = useState(false);
    const [cToken, setCToken] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("cToken");
            if (token) {
                setCToken(token);
            }
        }
    }, []);

    useEffect(() => {
        if (!project || !cToken) return;

        if (project.clientId && cToken === project.clientId) {
            console.log("[Auto-Login] Client token matched! Bypassing name entry form and granting client access.");
            setGuestName(project.clientName || "Client");
            setIsIdentified(true);
        }
    }, [project, cToken]);

    useEffect(() => {
        if (!revisionId) return;

        const unsub = onSnapshot(
            doc(db, "revisions", revisionId),
            async (revSnap) => {
                if (!revSnap.exists()) {
                    toast.error("Review link is invalid or expired.");
                    setRevision(null);
                    setLoading(false);
                    return;
                }

                const revData = { id: revSnap.id, ...revSnap.data() } as RevisionData;
                setRevision(revData);

                try {
                    const projSnap = await getDoc(doc(db, "projects", revData.projectId));
                    if (projSnap.exists()) {
                        setProject({ id: projSnap.id, ...projSnap.data() } as ReviewProject);
                    }
                } catch {
                    // Project metadata is helpful but not required for the invalid-link state.
                }

                setLoading(false);
            },
            (error) => {
                console.error("Failed to load review data:", error);
                toast.error("Error loading review.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [revisionId]);

    useEffect(() => {
        const name = project?.clientName || project?.name;
        if (!name) return;
        document.body.dataset.watermarkName = name;
        return () => {
            delete document.body.dataset.watermarkName;
        };
    }, [project]);

    const handleIdentify = (event: React.FormEvent) => {
        event.preventDefault();
        if (!guestName.trim()) {
            toast.error("Please enter your name to continue.");
            return;
        }
        setGuestName(guestName.trim());
        setIsIdentified(true);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Initializing Secure Review Link...</p>
                </div>
            </div>
        );
    }

    if (!revision || !project) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center">
                <div className="max-w-md space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                        <ShieldAlert className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Review Link Expired</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        This review link is no longer valid. Please contact the project administrator for a new link.
                    </p>
                </div>
            </div>
        );
    }

    if (!isIdentified) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm"
                >
                    <div className="mb-8 space-y-2 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-white">Access Shared Review</h2>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {project.name || "Video Project"}
                        </p>
                    </div>

                    <form onSubmit={handleIdentify} className="space-y-4 rounded-2xl border border-white/5 bg-muted/20 p-8 backdrop-blur-sm">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
                            <input
                                autoFocus
                                type="text"
                                value={guestName}
                                onChange={(event) => setGuestName(event.target.value)}
                                placeholder="Enter your full name"
                                className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm text-white transition-all focus:border-primary/50 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            className="h-11 w-full rounded-lg bg-primary text-sm font-bold uppercase tracking-widest text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                        >
                            Start Reviewing
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    const hasClientAccess = Boolean(project && cToken && project.clientId && cToken === project.clientId);

    return (
        <ReviewSystemModal
            isOpen={true}
            onClose={() => {}}
            project={project}
            allowUploadDraft={false}
            guestPreview={!hasClientAccess}
            guestName={guestName}
            defaultRevisionId={revision.id}
            clientAccess={hasClientAccess}
        />
    );
}
