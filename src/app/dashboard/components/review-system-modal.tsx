
"use client";
import { UploadDraftModal } from "./upload-draft-modal";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where, deleteDoc, limit, orderBy } from "firebase/firestore";
import { localFileManager } from "@/lib/local-file-manager";
import { Loader2, MessageSquare, Share2, Copy, Download, Star, X, Send, Image as ImageIcon, Clock, Users, Film, ChevronLeft, ChevronRight, MoreHorizontal, ListFilter, Smile, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { registerDownload, submitEditorRating } from "@/app/actions/project-actions";
import { handleNewComment } from "@/app/actions/notification-actions";
import { PaymentButton } from "@/components/payment-button";
import { uploadCommentImage } from "@/lib/firebase/storage-utils";
import { warmVideoInMemory } from "@/lib/video-preload";
import { VideoPlayer } from "@/components/video-player";
import { handleFileDownload } from "@/lib/download-utils";
import { safeJsonParse, cn } from "@/lib/utils";


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
};

type RevisionDoc = {
    id: string;
    projectId: string;
    version?: number;
    videoUrl?: string; // Firebase Storage
    playbackId?: string; // Mux Playback ID
    hlsUrl?: string; // Mux HLS URL
    fileSize?: number;
    description?: string;
    createdAt?: number;
};

type ReplyDoc = {
    id: string;
    userId: string;
    userName?: string;
    userRole?: string;
    content: string;
    imageUrl?: string;
    createdAt: number;
};

type CommentDoc = {
    id: string;
    projectId: string;
    revisionId: string;
    timestamp: number;
    content: string;
    imageUrl?: string;
    userName?: string;
    userRole?: string;
    userId: string;
    createdAt?: number;
    replies?: ReplyDoc[];
    isDirectConnection?: boolean;
};

type PendingComment = {
    id: string;
    content: string;
    timestamp: number;
    isDirectConnection: boolean;
    imageFile?: File;
    imagePreview?: string;
};

interface ReviewSystemModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ReviewProject | null;
    allowUploadDraft?: boolean;
    guestPreview?: boolean;
    guestName?: string;
    defaultRevisionId?: string;
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}


// Helper to extract playback source
function getVideoSource(revision: RevisionDoc | null | undefined): { playbackId?: string; videoUrl?: string } {
    if (!revision) return {};
    return {
        playbackId: revision.playbackId,
        videoUrl: revision.videoUrl
    };
}

export function ReviewSystemModal({ isOpen, onClose, project, allowUploadDraft, guestPreview = false, guestName, defaultRevisionId }: ReviewSystemModalProps) {
    // Track multiple open upload modals
    const [openDraftModals, setOpenDraftModals] = useState<Array<{ id: string }>>([]);
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const videoPlayerRef = useRef<any>(null);
    const isClient = user?.role === "client";
    const isAdmin = user?.role === "admin";
    const isStaff = ["manager", "sales_executive", "project_manager"].includes(user?.role || "") || isAdmin;
    const isEditor = user?.role === "editor";

    // Tab state
    const [activeTab, setActiveTab] = useState<'timeline' | 'direct'>('timeline');

    // Revision state
    const [loadingRevisions, setLoadingRevisions] = useState(false);
    const [revisions, setRevisions] = useState<RevisionDoc[]>([]);
    const [selectedRevisionId, setSelectedRevisionId] = useState<string>("");

    // Comment state
    const [comments, setComments] = useState<CommentDoc[]>([]);
    const [directConnections, setDirectConnections] = useState<CommentDoc[]>([]);
    const [newComment, setNewComment] = useState("");
    const [newReply, setNewReply] = useState<{ [commentId: string]: string }>({});
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [selectedImagePreview, setSelectedImagePreview] = useState<string>("");
    const [imageOverlayText, setImageOverlayText] = useState<string>("");
    const [annotatedImagePreview, setAnnotatedImagePreview] = useState<string>("");
    const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [savingComment, setSavingComment] = useState(false);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);

    // Video state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Payment & Feedback state

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [pendingDownloadAfterFlow, setPendingDownloadAfterFlow] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [editorRating, setEditorRating] = useState(0);
    const [editorReview, setEditorReview] = useState("");
    
    // Live state from Firestore
    const [liveTotalCost, setLiveTotalCost] = useState(project?.totalCost || 0);
    const [liveAmountPaid, setLiveAmountPaid] = useState(project?.amountPaid || 0);
    const [livePaymentStatus, setLivePaymentStatus] = useState(project?.paymentStatus || "");
    const [liveEditorRating, setLiveEditorRating] = useState(project?.editorRating || 0);
    const [liveEditorReview, setLiveEditorReview] = useState(project?.editorReview || "");

    const remainingAmount = Math.max(0, (liveTotalCost - liveAmountPaid) * 1.18);
    const remainingBaseAmount = Math.max(0, liveTotalCost - liveAmountPaid);
    const paidSoFarInclusive = liveAmountPaid * 1.18;
    const isPaymentComplete = livePaymentStatus === "full_paid" || liveAmountPaid >= liveTotalCost;
    const hasFeedback = liveEditorRating > 0;

    const selectedRevision = useMemo(
        () => revisions.find((r) => r.id === selectedRevisionId) || null,
        [revisions, selectedRevisionId]
    );


    const videoInfo = useMemo(() => getVideoSource(selectedRevision), [selectedRevision]);

    const pauseReviewVideo = () => {
        const player = videoPlayerRef.current;
        if (!player || typeof player.pause !== "function") return;
        player.pause();
    };

    const seekToCommentTime = (timestamp: number) => {
        if (activeTab !== 'timeline' || timestamp <= 0) return;
        const player = videoPlayerRef.current;
        if (!player) return;
        player.currentTime = timestamp;
        setCurrentTime(timestamp);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedImage(file);
        const preview = URL.createObjectURL(file);
        setSelectedImagePreview(preview);
        setAnnotatedImagePreview("");
        setImageOverlayText("");
    };

    const clearImageSelection = () => {
        if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
        setSelectedImage(null);
        setSelectedImagePreview("");
        setAnnotatedImagePreview("");
        setImageOverlayText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const drawTextOnImage = (imageSrc: string, text: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                if (text.trim()) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
                    ctx.fillStyle = 'white';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(text, canvas.width / 2, canvas.height - 25);
                }
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = imageSrc;
        });
    };

    useEffect(() => {
        if (selectedImagePreview && imageOverlayText.trim()) {
            drawTextOnImage(selectedImagePreview, imageOverlayText).then(setAnnotatedImagePreview);
        } else {
            setAnnotatedImagePreview("");
        }
    }, [selectedImagePreview, imageOverlayText]);

    const startDownload = async () => {
        console.log("[Download Flow] startDownload triggered", { selectedRevisionId, projectId: project?.id });
        if (!selectedRevisionId || !project?.id) {
            console.log("[Download Flow] Missing revision or project id");
            toast.error("No revision selected.");
            return;
        }

        setIsDownloading(true);
        const loadingToast = toast.loading("Preparing secure download link...");

        try {
            console.log("[Download Flow] Checking local memory for file");
            // 1. First check local memory for instant download
            const localFile = localFileManager.getFile(selectedRevisionId);
            if (localFile) {
                console.log("[Download Flow] Local file found, downloading from memory");
                toast.dismiss(loadingToast);
                await handleFileDownload(selectedRevisionId, localFile.name);
                await registerDownload(project.id, selectedRevisionId);
                return;
            }

            console.log("[Download Flow] Requesting download URL from server");
            // 2. If not in memory, get authorized URL and use utility to fetch & download
            const res = await registerDownload(project.id, selectedRevisionId);
            console.log("[Download Flow] Server response received", res);
            toast.dismiss(loadingToast);
            
            if (!res.success || !res.downloadUrl) {
                throw new Error(res.error || "Could not retrieve download URL.");
            }

            const fileName = `draft_v${selectedRevision?.version || "final"}.mp4`;
            console.log("[Download Flow] Proceeding to file download with URL");
            await handleFileDownload(res.downloadUrl, fileName);

        } catch (err: any) {
            console.error("[Download Flow] Download Error:", err);
            toast.dismiss(loadingToast);
            toast.error(err.message || "Failed to start download.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadClick = async () => {
        console.log("[Download Flow] Download button clicked!");
        console.log("[Download Flow] Context:", { isClient, isPaymentComplete, hasFeedback, selectedRevisionId });
        if (!project?.id || !selectedRevisionId) return;
        if (isClient) {
            if (!isPaymentComplete && !user?.payLater) {
                console.log("[Download Flow] Pending payment, opening payment modal");
                setPendingDownloadAfterFlow(true);
                setIsPaymentModalOpen(true);
                return;
            }
            if (!hasFeedback) {
                console.log("[Download Flow] Pending feedback, opening feedback modal");
                setPendingDownloadAfterFlow(true);
                setIsFeedbackModalOpen(true);
                return;
            }
        }
        await startDownload();
    };

    const handleSubmitFeedback = async () => {
        if (!project?.id) return;
        if (editorRating === 0) {
            toast.error("Please select a rating.");
            return;
        }
        setIsSubmittingFeedback(true);
        try {
            const res = await submitEditorRating(project.id, editorRating, editorReview.trim() || "No review provided.");
            if (!res.success) {
                toast.error(res.error || "Failed to submit feedback.");
                return;
            }
            await updateDoc(doc(db, "projects", project.id), {
                editorRating,
                editorReview: editorReview.trim(),
                updatedAt: Date.now(),
            });
            setLiveEditorRating(editorRating);
            setLiveEditorReview(editorReview.trim());
            toast.success("Feedback submitted.");
            setIsFeedbackModalOpen(false);
            if (pendingDownloadAfterFlow) {
                setPendingDownloadAfterFlow(false);
                await startDownload();
            }
        } catch (error) {
            console.error("Feedback submit error:", error);
            toast.error("Failed to submit feedback.");
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const buildDraftComment = async (): Promise<PendingComment | null> => {
        const content = newComment.trim();
        if (!content && !selectedImage) return null;
        let finalImageFile = selectedImage;
        let finalImagePreview = selectedImagePreview;
        if (selectedImage && imageOverlayText.trim() && selectedImagePreview) {
            try {
                const annotatedDataUrl = await drawTextOnImage(selectedImagePreview, imageOverlayText);
                const response = await fetch(annotatedDataUrl);
                const blob = await response.blob();
                finalImageFile = new File([blob], selectedImage.name, { type: 'image/jpeg' });
                finalImagePreview = annotatedDataUrl;
            } catch (error) {
                console.error('Failed to apply text overlay:', error);
            }
        }
        return {
            id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            content,
            timestamp: activeTab === 'timeline' ? currentTime : 0,
            isDirectConnection: activeTab === 'direct',
            imageFile: finalImageFile || undefined,
            imagePreview: finalImagePreview || undefined,
        };
    };

    const handleQueueComment = async () => {
        if (!project?.id || !selectedRevisionId) return;
        const draft = await buildDraftComment();
        if (!draft) {
            toast.error("Write a comment or upload an image.");
            return;
        }
        setPendingComments((prev) => [...prev, draft]);
        setNewComment("");
        clearImageSelection();
        toast.success(`Comment queued${draft.isDirectConnection ? " (Direct)" : ` at ${formatTime(draft.timestamp)}`}`);
    };

    const handleSendQueuedComments = async () => {
        if (!project?.id || !selectedRevisionId) return;
        const draft = await buildDraftComment();
        const commentsToSend = [...pendingComments, ...(draft ? [draft] : [])];
        if (commentsToSend.length === 0) {
            toast.error("Add at least one comment to send.");
            return;
        }
        setSavingComment(true);
        try {
            const failedQueue: PendingComment[] = [];
            let sentCount = 0;
            for (const queued of commentsToSend) {
                let imageUrl = "";
                if (queued.imageFile) {
                    setUploadingImage(true);
                    imageUrl = await uploadCommentImage(queued.imageFile, project.id, selectedRevisionId);
                    setUploadingImage(false);
                }
                try {
                    await addDoc(collection(db, "comments"), {
                        projectId: project.id,
                        revisionId: selectedRevisionId,
                        userId: user?.uid || "guest",
                        userName: user?.displayName || guestName || "User",
                        userRole: (user as any)?.role || "guest",
                        content: queued.content,
                        imageUrl: imageUrl || null,
                        timestamp: queued.timestamp,
                        createdAt: Date.now(),
                        status: "open",
                        replies: [],
                        isDirectConnection: queued.isDirectConnection,
                    });
                    await handleNewComment(project.id, user?.uid || "guest", user?.displayName || guestName || "User", (user as any)?.role || "guest", queued.content, selectedRevisionId);
                    if (queued.imagePreview) URL.revokeObjectURL(queued.imagePreview);
                    sentCount += 1;
                } catch (commentError) {
                    failedQueue.push(queued);
                }
            }
            setNewComment("");
            clearImageSelection();
            setPendingComments(failedQueue);
            if (sentCount > 0) toast.success(`${sentCount} sent.`);
        } finally {
            setUploadingImage(false);
            setSavingComment(false);
        }
    };

    const handleAddReply = async (commentId: string) => {
        if (!newReply[commentId]?.trim()) return;
        try {
            const commentDocRef = doc(db, "comments", commentId);
            const res = await getDocs(query(collection(db, "comments"), where("__name__", "==", commentId)));
            if (!res.empty) {
                const comment = res.docs[0].data();
                const replies = comment.replies || [];
                replies.push({
                    id: `reply_${Date.now()}`,
                    userId: user?.uid || "guest",
                    userName: user?.displayName || guestName || "User",
                    userRole: (user as any)?.role || "guest",
                    content: newReply[commentId].trim(),
                    imageUrl: null,
                    createdAt: Date.now(),
                });
                await updateDoc(commentDocRef, { replies });
                setNewReply((prev) => ({ ...prev, [commentId]: "" }));
                setReplyingTo(null);
                toast.success("Reply added.");
            }
        } catch (error) {
            toast.error("Failed to add reply.");
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!window.confirm("Delete this comment?")) return;
        try {
            const res = await fetch("/api/comments/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ commentId }),
            });
            const payload = await safeJsonParse(res);
            if (!res.ok || !payload?.success) throw new Error(payload?.message || "Failed");
            setComments(p => p.filter(c => c.id !== commentId));
            setDirectConnections(p => p.filter(c => c.id !== commentId));
            toast.success("Deleted.");
        } catch (error) {
            toast.error("Failed to delete.");
        }
    };

    // Revision Polling & Subscriptions
    useEffect(() => {
        if (!isOpen || !project?.id) return;
        setLoadingRevisions(true);
        const q = query(collection(db, "revisions"), where("projectId", "==", project.id));
        const unsub = onSnapshot(q, (snap) => {
            const next = snap.docs.map(d => ({ id: d.id, ...d.data() } as RevisionDoc)).sort((a,b) => (b.version || 0) - (a.version || 0));
            setRevisions(next);
            next.forEach(r => {
                // Preload video if videoUrl exists
                if (r.videoUrl) warmVideoInMemory(r.videoUrl);
            });
            if (next.length > 0) {
                setSelectedRevisionId(curr => {
                    if (curr && next.find(r => r.id === curr)) return curr;
                    return defaultRevisionId && next.find(r => r.id === defaultRevisionId) ? defaultRevisionId : next[0].id;
                });
            }
            setLoadingRevisions(false);
        });
        return () => unsub();
    }, [isOpen, project?.id, defaultRevisionId]);



    // Firestore project sync
    useEffect(() => {
        if (!isOpen || !project?.id) return;
        const unsub = onSnapshot(doc(db, "projects", project.id), (snap) => {
            if (!snap.exists()) return;
            const p = snap.data();
            setLiveTotalCost(p.totalCost || 0);
            setLiveAmountPaid(p.amountPaid || 0);
            setLivePaymentStatus(p.paymentStatus || "");
            setLiveEditorRating(p.editorRating || 0);
            setLiveEditorReview(p.editorReview || "");
        });
        return () => unsub();
    }, [isOpen, project?.id]);

    // Comments sync
    useEffect(() => {
        if (!isOpen || !selectedRevisionId) return;
        const q = query(collection(db, "comments"), where("revisionId", "==", selectedRevisionId));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as CommentDoc)).sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
            setComments(all.filter(c => !c.isDirectConnection));
            setDirectConnections(all.filter(c => c.isDirectConnection));
        });
        return () => unsub();
    }, [isOpen, selectedRevisionId]);

    const activeComments = activeTab === 'timeline' ? comments : directConnections;

    const uiContent = (
        <div className="flex h-full min-h-0 flex-col gap-0 bg-[#07080d] text-zinc-100 lg:grid lg:grid-cols-12 lg:gap-6 lg:bg-transparent">
            {/* Left Column: Video and Versions */}
            <div className="flex shrink-0 flex-col gap-0 lg:col-span-8 lg:min-h-0 lg:flex-1 lg:gap-4 lg:overflow-y-auto lg:pr-2 lg:pb-6 lg:no-scrollbar">
                <div className="flex items-center justify-between gap-3 bg-[#171925] px-4 py-3 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/10 lg:p-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-zinc-400 lg:hidden">
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="truncate">{selectedRevision?.description || `v${selectedRevision?.version || "?"}`}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="truncate text-zinc-100">{project?.name || "Review"}</span>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar">

                        {/* Version Switcher with Arrows */}
                        <div className="hidden lg:flex items-center gap-1.5 bg-background/50 p-1 rounded-xl border border-border/50 shadow-sm shrink-0">
                            <button
                                onClick={() => {
                                    const idx = revisions.findIndex(r => r.id === selectedRevisionId);
                                    if (idx < revisions.length - 1) setSelectedRevisionId(revisions[idx + 1].id);
                                }}
                                disabled={revisions.findIndex(r => r.id === selectedRevisionId) >= revisions.length - 1}
                                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all active:scale-90"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            
                            <div className="flex flex-col items-center px-3 border-x border-border/50 min-w-[60px]">
                                <span className="text-xs font-black text-foreground tabular-nums">v{selectedRevision?.version || "?"}</span>
                            </div>

                            <button
                                onClick={() => {
                                    const idx = revisions.findIndex(r => r.id === selectedRevisionId);
                                    if (idx > 0) setSelectedRevisionId(revisions[idx - 1].id);
                                }}
                                disabled={revisions.findIndex(r => r.id === selectedRevisionId) <= 0}
                                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all active:scale-90"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {allowUploadDraft && (
                            <button
                                onClick={() => setOpenDraftModals(prev => [...prev, { id: `draft-${Date.now()}` }])}
                                className="hidden h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 lg:flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                                title="Upload Draft"
                            >
                                <Film size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const url = `${(process.env.NEXT_PUBLIC_SHORT_LINK_BASE_URL || "https://previewvideo.online").replace(/\/+$/, "")}/r/${selectedRevisionId}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link copied!");
                            }}
                            className="hidden h-9 w-9 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:text-foreground lg:flex items-center justify-center transition-all"
                            title="Copy External Review Link"
                        >
                            <Share2 size={18} />
                        </button>
                        <button
                            onClick={handleDownloadClick}
                            disabled={!selectedRevisionId || isDownloading}
                            className="hidden h-9 w-9 rounded-xl bg-primary/10 text-primary lg:flex items-center justify-center hover:bg-primary/20 transition-all disabled:opacity-50"
                            title="Secure Download"
                        >
                            {isDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download size={18} />
                            )}
                        </button>
                        <button
                            onClick={() => {
                                const url = `${(process.env.NEXT_PUBLIC_SHORT_LINK_BASE_URL || "https://previewvideo.online").replace(/\/+$/, "")}/r/${selectedRevisionId}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link copied!");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded bg-[#5c52ff]/15 text-[#7b74ff] lg:hidden"
                            title="Copy External Review Link"
                        >
                            <Share2 size={15} />
                        </button>
                        <button
                            onClick={handleDownloadClick}
                            disabled={!selectedRevisionId || isDownloading}
                            className="flex h-7 w-7 items-center justify-center rounded bg-[#2f80ff]/15 text-[#7fb2ff] transition-all disabled:opacity-50 lg:hidden"
                            title="Secure Download"
                        >
                            {isDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Download size={15} />
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-zinc-300 transition-all hover:bg-white/10 hover:text-white lg:hidden"
                            title="Close review"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                <div
                    className="relative flex h-[36vh] min-h-[250px] max-h-[390px] items-center justify-center overflow-hidden bg-black shadow-none group/video lg:h-auto lg:min-h-0 lg:rounded-2xl lg:border lg:border-border/50 lg:shadow-2xl lg:max-h-[65vh]"
                    data-watermark-name={project?.clientName || project?.name}
                >
                    <VideoPlayer
                        ref={videoPlayerRef}
                        playbackId={videoInfo.playbackId}
                        videoPath={videoInfo.videoUrl}
                        title={`Draft v${selectedRevision?.version}`}
                        onTimeUpdate={setCurrentTime}
                        onLoadedMetadata={setDuration}
                        primaryColor="#ffffff"
                        accentColor="#2f80ff"
                        backwardSeekOffset={10}
                        forwardSeekOffset={10}
                        className="h-full w-full border-0 shadow-none"
                    />
                </div>
            </div>

            {/* Right Column: Comments */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-[#262a3a] bg-[#11131e] px-4 py-4 lg:col-span-4 lg:h-auto lg:border-t-0 lg:border-l lg:border-border/50 lg:bg-transparent lg:p-0 lg:pl-4">
                <div className="h-1 w-12 rounded-full bg-[#6b5cff] mx-auto lg:hidden" />
                <div className="flex gap-1 rounded-lg bg-[#222436] p-1 lg:rounded-xl lg:border lg:border-border/50 lg:bg-muted/40">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all lg:rounded-lg lg:text-xs",
                            activeTab === 'timeline' ? "bg-[#383a51] text-white shadow-sm lg:bg-background lg:text-primary" : "text-zinc-400 hover:text-foreground"
                        )}
                    >
                        <Clock className="hidden h-3.5 w-3.5 lg:block" /> Comments
                    </button>
                    <button
                        onClick={() => setActiveTab('direct')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all lg:rounded-lg lg:text-xs",
                            activeTab === 'direct' ? "bg-[#383a51] text-white shadow-sm lg:bg-background lg:text-primary" : "text-zinc-400 hover:text-foreground"
                        )}
                    >
                        <MessageSquare className="hidden h-3.5 w-3.5 lg:block" /> Fields
                    </button>
                </div>

                <div className="flex items-center justify-between text-sm font-bold text-zinc-200 lg:hidden">
                    <span>All comments</span>
                    <div className="flex items-center gap-4 text-zinc-400">
                        <button title="Filter comments"><ListFilter className="h-4 w-4" /></button>
                        <button title="Sort comments"><MessageSquare className="h-4 w-4" /></button>
                        <button title="More"><MoreHorizontal className="h-4 w-4" /></button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin lg:space-y-4">
                    {activeComments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                                <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">No comments yet.</p>
                            <p className="text-[10px] text-muted-foreground/60 uppercase mt-1">Be the first to leave feedback</p>
                        </div>
                    ) : (
                        activeComments.map((c, index) => (
                            <div
                                key={c.id}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('button, a, textarea, input')) return;
                                    seekToCommentTime(c.timestamp);
                                }}
                                className={cn(
                                    "group relative space-y-3 rounded-lg bg-[#181a27] p-3 transition-all hover:border-primary/20 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/20 lg:p-4",
                                    activeTab === 'timeline' && c.timestamp > 0 && "cursor-pointer hover:bg-[#202334] lg:hover:bg-muted/30"
                                )}
                                title={activeTab === 'timeline' && c.timestamp > 0 ? `Jump to ${formatTime(c.timestamp)}` : undefined}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ee54e8] text-[10px] font-black uppercase text-black lg:h-8 lg:w-8 lg:border lg:border-primary/20 lg:bg-primary/10 lg:text-primary">
                                            {c.userName?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 text-sm font-black text-zinc-100 lg:text-xs lg:text-foreground">
                                                {c.userName}
                                                <span className="text-xs font-bold text-zinc-500 lg:text-[9px]">{formatDate(c.createdAt || 0)}</span>
                                                {c.userRole && <span className="hidden text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold uppercase lg:inline">{c.userRole}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                {c.timestamp > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            seekToCommentTime(c.timestamp);
                                                        }}
                                                        className="rounded bg-[#4d4200] px-1.5 py-0.5 font-black text-[#ffd21f] transition-colors hover:bg-[#6a5a00]"
                                                    >
                                                        {formatTime(c.timestamp)}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-bold text-zinc-500 lg:hidden">
                                        #{index + 1}
                                    </div>
                                    {(user?.uid === c.userId || isAdmin || isStaff) && (
                                        <button onClick={() => handleDeleteComment(c.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all">
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                
                                <div className="whitespace-pre-wrap pl-10 text-sm font-semibold leading-relaxed text-zinc-200 lg:pl-1 lg:font-normal lg:text-foreground">
                                    {c.content}
                                </div>
                                <button
                                    onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                                    className="pl-10 text-xs font-bold text-zinc-300 transition-colors hover:text-white lg:pl-1 lg:text-muted-foreground lg:hover:text-foreground"
                                >
                                    Reply
                                </button>

                                {c.imageUrl && (
                                    <div className="relative rounded-xl border border-border/50 overflow-hidden bg-black/5 flex justify-center">
                                        <img src={c.imageUrl} className="max-h-60 object-contain w-full" alt="Comment attachment" />
                                        <a href={c.imageUrl} target="_blank" rel="noreferrer" className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-all">
                                            <Download className="h-3.5 w-3.5" />
                                        </a>
                                    </div>
                                )}

                                {c.replies && c.replies.length > 0 && (
                                    <div className="mt-3 pl-4 border-l-2 border-border/30 space-y-3">
                                        {c.replies.map((reply) => (
                                            <div key={reply.id} className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-foreground">{reply.userName}</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">{formatDate(reply.createdAt)}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {replyingTo === c.id && (
                                    <div className="ml-10 space-y-2 rounded-lg border border-[#34374c] bg-[#202232] p-2 lg:ml-4 lg:border-border/50 lg:bg-background/40">
                                        <textarea
                                            value={newReply[c.id] || ""}
                                            onFocus={pauseReviewVideo}
                                            onChange={(e) => setNewReply((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddReply(c.id);
                                                }
                                            }}
                                            placeholder="Write a reply..."
                                            className="min-h-12 w-full resize-none border-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none lg:text-foreground"
                                            autoFocus
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setReplyingTo(null);
                                                    setNewReply((prev) => ({ ...prev, [c.id]: "" }));
                                                }}
                                                className="h-8 px-3 text-xs font-bold text-zinc-400 transition-colors hover:text-white lg:text-muted-foreground lg:hover:text-foreground"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleAddReply(c.id)}
                                                disabled={!newReply[c.id]?.trim()}
                                                className="flex h-8 items-center gap-2 rounded-md bg-[#5b55b8] px-3 text-xs font-black text-white transition-all hover:brightness-110 disabled:opacity-50 lg:bg-primary lg:text-primary-foreground"
                                            >
                                                <Send className="h-3.5 w-3.5" />
                                                Send
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {/* Pending comments being queued */}
                    {pendingComments.filter(p => p.isDirectConnection === (activeTab === 'direct')).map((pc) => (
                        <div key={pc.id} className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3 opacity-70">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary uppercase">Q</div>
                                    <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Queued Comment {pc.timestamp > 0 && `@ ${formatTime(pc.timestamp)}`}</div>
                                </div>
                                <button onClick={() => setPendingComments(p => p.filter(x => x.id !== pc.id))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                            </div>
                            {pc.content && <p className="text-xs text-foreground/80">{pc.content}</p>}
                            {pc.imagePreview && <img src={pc.imagePreview} className="max-h-24 rounded-lg" />}
                        </div>
                    ))}
                </div>

                {/* Comment Input Area */}
                <div className="border-t border-[#25283a] pt-2 lg:border-border/50 lg:pt-3">
                    <div className="space-y-3 rounded-lg bg-[#2a2d40] p-3 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/30 lg:p-4">
                        <div className="relative">
                            <textarea
                                value={newComment}
                                onFocus={pauseReviewVideo}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder={activeTab === 'timeline' ? "Leave your comment..." : "Message editor directly..."}
                                className="min-h-10 w-full resize-none border-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none lg:min-h-15 lg:text-foreground"
                            />
                            {activeTab === 'timeline' && (
                                <div className="absolute right-0 top-0 rounded bg-[#504700] px-1.5 py-0.5 text-xs font-black text-[#ffd21f] lg:bottom-0 lg:top-auto lg:mb-2 lg:mr-2 lg:bg-primary/10 lg:text-primary">
                                    {formatTime(currentTime)}:00
                                </div>
                            )}
                        </div>

                        {selectedImagePreview && (
                            <div className="relative rounded-xl border border-border/50 overflow-hidden bg-black/20 p-2">
                                <img src={annotatedImagePreview || selectedImagePreview} className="max-h-32 rounded-lg mx-auto" />
                                <button onClick={clearImageSelection} className="absolute top-3 right-3 p-1 rounded-full bg-black/60 text-white hover:bg-black"><X className="h-3 w-3" /></button>
                                <input 
                                    type="text"
                                    value={imageOverlayText}
                                    onChange={(e) => setImageOverlayText(e.target.value)}
                                    placeholder="Add text overlay..."
                                    className="w-full mt-2 text-[10px] bg-background/50 border border-border/30 rounded-lg p-2 focus:outline-none"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-[#36394f] pt-2 lg:border-border/30 lg:pt-3">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-muted lg:text-muted-foreground"
                                    title="Attach screenshot"
                                >
                                    <ImageIcon className="h-4 w-4" />
                                </button>
                                <button className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-muted lg:hidden" title="Add reaction">
                                    <Smile className="h-4 w-4" />
                                </button>
                                <button className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-muted lg:hidden" title="Approve">
                                    <ThumbsUp className="h-4 w-4" />
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleQueueComment}
                                    className="hidden h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors lg:block"
                                >
                                    Queue
                                </button>
                                <button
                                    onClick={handleSendQueuedComments}
                                    disabled={savingComment || (!newComment.trim() && !selectedImage && pendingComments.length === 0)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5b55b8] text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 lg:h-8 lg:w-auto lg:px-5 lg:bg-primary lg:text-primary-foreground lg:text-[10px] lg:font-black lg:uppercase lg:tracking-widest"
                                >
                                    {savingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    <span className="hidden lg:inline">Send {pendingComments.length > 0 ? `(${pendingComments.length + (newComment.trim() || selectedImage ? 1 : 0)})` : ""}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (guestPreview) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-8">
                <div className="max-w-400 mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
                                {project?.name || "Project Review"}
                                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-black">Guest Access</span>
                            </h1>
                            <p className="text-sm text-muted-foreground">Welcome, <span className="text-foreground font-bold">{guestName || "Guest"}</span>. Leave your feedback below.</p>
                        </div>
                    </div>
                    {uiContent}
                </div>
            </div>
        );
    }

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Review // ${project?.name || "System"}`}
                maxWidth="max-w-7xl"
                className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 bg-[#07080d] p-0 sm:h-[90vh] sm:w-full sm:rounded-2xl sm:border sm:bg-popover sm:p-6 [&>div:first-child]:hidden sm:[&>div:first-child]:flex sm:[&>div:first-child]:mb-6 sm:[&>div:first-child]:p-0 sm:[&>div:first-child_h2]:text-xl"
            >
                <div className="min-h-0 flex-1 overflow-hidden">
                    {uiContent}
                </div>
            </Modal>
            {/* Multiple Upload Draft Modals */}
            {project?.id && openDraftModals.map((modal, idx) => (
                <UploadDraftModal
                    key={modal.id}
                    isOpen={true}
                    projectId={project.id}
                    projectName={project.name || ""}
                    onClose={() =>
                        setOpenDraftModals((prev) => prev.filter((m) => m.id !== modal.id))
                    }
                    onSuccess={(revisionId) => {
                        setOpenDraftModals((prev) => prev.filter((m) => m.id !== modal.id));
                    }}
                />
            ))}

            {/* Payment Modal */}
            <Modal
                isOpen={isPaymentModalOpen && isClient}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Complete Final Payment"
                maxWidth="max-w-lg"
            >
                <div className="space-y-6 mt-4">
                    <div className="p-5 rounded-2xl border border-border bg-muted/20 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Project Total (Incl. GST)</span>
                            <span className="font-bold text-foreground">₹{(liveTotalCost * 1.18).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Paid Amount</span>
                            <span className="font-bold text-emerald-500">₹{paidSoFarInclusive.toLocaleString()}</span>
                        </div>
                        <div className="h-px bg-border my-2" />
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-black uppercase tracking-widest text-primary">Final Balance</span>
                            <span className="text-2xl font-black text-primary">₹{remainingAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <PaymentButton
                        projectId={project?.id || ""}
                        user={user}
                        amount={remainingAmount}
                        accountingAmount={remainingBaseAmount}
                        description={`Final Balance: ${project?.name || "Project"}`}
                        prefill={{ name: user?.displayName || "", email: user?.email || "" }}
                        onSuccess={async () => {
                            if (!project?.id) return;
                            await updateDoc(doc(db, "projects", project.id), { paymentStatus: "full_paid", amountPaid: liveTotalCost, updatedAt: Date.now() });
                            setLivePaymentStatus("full_paid");
                            setLiveAmountPaid(liveTotalCost);
                            setIsPaymentModalOpen(false);
                            setTimeout(() => setIsFeedbackModalOpen(true), 400);
                            toast.success("Payment confirmed!");
                        }}
                    />
                </div>
            </Modal>

            {/* Feedback Modal */}
            <Modal
                isOpen={isFeedbackModalOpen && isClient}
                onClose={() => setIsFeedbackModalOpen(false)}
                title="Editor Rating & Review"
                maxWidth="max-w-md"
            >
                <div className="space-y-6 mt-4 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">How was your experience with the editor? Your rating helps us maintain quality.</p>

                    <div className="flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setEditorRating(star)}
                                className={cn(
                                    "p-3 rounded-2xl transition-all duration-300",
                                    editorRating >= star ? "text-yellow-400 bg-yellow-400/10 scale-110" : "text-muted-foreground hover:text-yellow-400/50 bg-muted/20"
                                )}
                            >
                                <Star className={cn("h-8 w-8", editorRating >= star && "fill-yellow-400")} />
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={editorReview}
                        onChange={(e) => setEditorReview(e.target.value)}
                        placeholder="Write a short review..."
                        className="w-full h-32 resize-none rounded-2xl border border-border bg-background p-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />

                    <button
                        onClick={handleSubmitFeedback}
                        disabled={isSubmittingFeedback || editorRating === 0}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-[12px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
                    >
                        {isSubmittingFeedback ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Submit & Start Download"}
                    </button>
                </div>
            </Modal>
        </>
    );
}
