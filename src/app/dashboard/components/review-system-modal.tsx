
"use client";
import { UploadDraftModal } from "./upload-draft-modal";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where, deleteDoc, limit, orderBy } from "firebase/firestore";
import { localFileManager } from "@/lib/local-file-manager";
import { Loader2, MessageSquare, Share2, Copy, Download, Star, X, Send, Image as ImageIcon, Clock, Users, Film, ChevronLeft, ChevronRight, Smile, ThumbsUp, FileText, FileVideo, Music, Mic, Trash2, Check, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { getSignedDownloadUrl, registerDownload, submitEditorRating } from "@/app/actions/project-actions";
import { handleNewComment } from "@/app/actions/notification-actions";
import { PaymentButton } from "@/components/payment-button";
import { uploadCommentAttachment } from "@/lib/firebase/storage-utils";
import { warmVideoInMemory } from "@/lib/video-preload";
import { VideoPlayer } from "@/components/video-player";
import { handleFileDownload } from "@/lib/download-utils";
import { safeJsonParse, cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


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
    downloadsUnlocked?: boolean;
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
    imageUrl?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
    attachmentSize?: number | null;
    createdAt: number;
};

type CommentDoc = {
    id: string;
    projectId: string;
    revisionId: string;
    timestamp: number;
    content: string;
    imageUrl?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
    attachmentSize?: number | null;
    userName?: string;
    userRole?: string;
    userId: string;
    createdAt?: number;
    replies?: ReplyDoc[];
    isDirectConnection?: boolean;
    notificationSubmitted?: boolean;
};

interface ReviewSystemModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ReviewProject | null;
    allowUploadDraft?: boolean;
    guestPreview?: boolean;
    guestName?: string;
    defaultRevisionId?: string;
    clientAccess?: boolean;
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


interface InlineAudioPlayerProps {
    url: string;
    name?: string;
    size?: number | null;
    onDownload?: () => void;
}

export function InlineAudioPlayer({ url, name, size, onDownload }: InlineAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            // Pause all other audio/video elements in the page to prevent overlapping audio
            document.querySelectorAll('audio, video').forEach(el => {
                if (el !== audio) {
                    try {
                        (el as any).pause();
                    } catch (e) {}
                }
            });
            audio.play().catch(err => console.error("Error playing audio:", err));
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const formatAudioTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || duration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const nextPercent = clickX / width;
        const nextTime = nextPercent * duration;
        audio.currentTime = nextTime;
        setCurrentTime(nextTime);
    };

    return (
        <div className="flex flex-col gap-2 w-full max-w-sm rounded-xl border border-white/10 bg-[#202232]/80 backdrop-blur-md p-3.5 shadow-xl transition-all hover:bg-[#202232]/95 hover:border-white/20">
            <audio
                ref={audioRef}
                src={url}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                preload="metadata"
                className="hidden"
            />
            
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={togglePlay}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5c52ff] text-white shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    title={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? (
                        <Pause size={16} className="fill-current" />
                    ) : (
                        <Play size={16} className="fill-current ml-0.5" />
                    )}
                </button>
                
                <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-bold text-zinc-100">
                        {name || "Voice Message"}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-medium">
                        {size ? `${(size / 1024).toFixed(1)} KB` : "Voice Feedback"}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        if (onDownload) {
                            onDownload();
                            return;
                        }
                        void handleFileDownload(url, name || "voice-comment.webm");
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                    title="Download Audio"
                >
                    <Download className="h-4 w-4" />
                </button>
            </div>

            <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-mono text-zinc-400 tabular-nums shrink-0">
                    {formatAudioTime(currentTime)}
                </span>
                
                <div
                    onClick={handleProgressClick}
                    className="relative flex-1 h-1.5 rounded-full bg-zinc-700/60 cursor-pointer overflow-hidden group/progress"
                >
                    <div
                        className="absolute top-0 bottom-0 left-0 bg-[#7b74ff] rounded-full group-hover/progress:bg-indigo-400 transition-colors"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                </div>

                <span className="text-[10px] font-mono text-zinc-400 tabular-nums shrink-0">
                    {formatAudioTime(duration || 0)}
                </span>
            </div>
        </div>
    );
}

// Helper to extract playback source
function getVideoSource(revision: RevisionDoc | null | undefined): { playbackId?: string; videoUrl?: string } {
    if (!revision) return {};
    return {
        playbackId: revision.playbackId,
        videoUrl: revision.videoUrl
    };
}

export function ReviewSystemModal({ isOpen, onClose, project, allowUploadDraft, guestPreview = false, guestName, defaultRevisionId, clientAccess = false }: ReviewSystemModalProps) {
    // Track multiple open upload modals
    const [openDraftModals, setOpenDraftModals] = useState<Array<{ id: string }>>([]);
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const videoPlayerRef = useRef<any>(null);
    const reviewShellRef = useRef<HTMLDivElement | null>(null);
    const isClient = user?.role === "client" || clientAccess;
    const isAdmin = user?.role === "admin";
    const isStaff = ["manager", "sales_executive", "project_manager"].includes(user?.role || "") || isAdmin;
    const isEditor = user?.role === "editor";
    const isGuestReviewer = guestPreview && !user;

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
    const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
    const [selectedAttachmentPreview, setSelectedAttachmentPreview] = useState<string>("");
    const [imageOverlayText, setImageOverlayText] = useState<string>("");
    const [annotatedImagePreview, setAnnotatedImagePreview] = useState<string>("");
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [savingComment, setSavingComment] = useState(false);
    const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
    const [pendingNotificationComment, setPendingNotificationComment] = useState<CommentDoc | null>(null);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type?: string | null } | null>(null);
    const [resolvedAttachmentUrls, setResolvedAttachmentUrls] = useState<Record<string, string>>({});
    const [topPaneHeight, setTopPaneHeight] = useState(0);

    // Video state
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Payment & Feedback state

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isPayLaterDueReminderModalOpen, setIsPayLaterDueReminderModalOpen] = useState(false);
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
    const [liveDownloadsUnlocked, setLiveDownloadsUnlocked] = useState(project?.downloadsUnlocked || false);

    // Voice Message states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], "voice-comment.webm", { type: 'audio/webm' });
                setSelectedAttachment(file);
                
                const preview = URL.createObjectURL(file);
                setSelectedAttachmentPreview(preview);
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration((prev) => {
                    if (prev >= 120) { // Limit to 2 minutes
                        stopRecording();
                        return 120;
                    }
                    return prev + 1;
                });
            }, 1000);

            pauseReviewVideo();
        } catch (error) {
            console.error("Error accessing microphone:", error);
            toast.error("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setIsRecording(false);
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            const stream = mediaRecorderRef.current.stream;
            stream.getTracks().forEach(track => track.stop());
        }
        if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
        toast.info("Recording cancelled");
    };

    useEffect(() => {
        return () => {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, []);

    const remainingAmount = Math.max(0, (liveTotalCost - liveAmountPaid) * 1.18);
    const remainingBaseAmount = Math.max(0, liveTotalCost - liveAmountPaid);
    const paidSoFarInclusive = liveAmountPaid * 1.18;
    const isPaymentComplete = livePaymentStatus === "full_paid" || liveAmountPaid >= liveTotalCost;
    const hasFeedback = liveEditorRating > 0;

    const selectedRevision = useMemo(
        () => revisions.find((r) => r.id === selectedRevisionId) || null,
        [revisions, selectedRevisionId]
    );

    useEffect(() => {
        if (!guestPreview) return;

        const preventContextMenu = (e: MouseEvent) => e.preventDefault();
        const preventDevtoolsKeys = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (
                e.key === "F12" ||
                (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
                (e.metaKey && e.altKey && ["i", "j", "c"].includes(key)) ||
                (e.ctrlKey && key === "u") ||
                (e.metaKey && e.altKey && key === "u")
            ) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        document.addEventListener("contextmenu", preventContextMenu);
        window.addEventListener("keydown", preventDevtoolsKeys, true);

        return () => {
            document.removeEventListener("contextmenu", preventContextMenu);
            window.removeEventListener("keydown", preventDevtoolsKeys, true);
        };
    }, [guestPreview]);

    useEffect(() => {
        const setDefaultPaneHeight = () => {
            if (typeof window === "undefined") return;
            setTopPaneHeight((current) => {
                if (current > 0) return current;
                return Math.round(Math.min(Math.max(window.innerHeight * 0.52, 300), window.innerHeight - 260));
            });
        };

        setDefaultPaneHeight();
        window.addEventListener("resize", setDefaultPaneHeight);
        return () => window.removeEventListener("resize", setDefaultPaneHeight);
    }, []);


    const videoInfo = useMemo(() => getVideoSource(selectedRevision), [selectedRevision]);

    const pauseReviewVideo = () => {
        const player = videoPlayerRef.current;
        if (!player || typeof player.pause !== "function") return;
        player.pause();
    };

    const isImageFile = (fileType?: string | null, fileName?: string | null) =>
        Boolean(fileType?.startsWith("image/") || fileName?.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i));

    const isVideoFile = (fileType?: string | null, fileName?: string | null) =>
        Boolean(fileType?.startsWith("video/") || fileName?.match(/\.(mp4|mov|webm|avi|mkv|m4v)$/i));

    const isAudioFile = (fileType?: string | null, fileName?: string | null) =>
        Boolean(fileType?.startsWith("audio/") || fileName?.match(/\.(mp3|wav|aac|m4a|ogg|flac)$/i));

    const formatFileSize = (size?: number | null) => {
        if (!size) return null;
        if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        if (size >= 1024) return `${Math.round(size / 1024)} KB`;
        return `${size} B`;
    };

    const canPreviewAttachment = (fileType?: string | null, fileName?: string | null) =>
        isImageFile(fileType, fileName) ||
        isVideoFile(fileType, fileName) ||
        isAudioFile(fileType, fileName) ||
        Boolean(fileName?.match(/\.pdf$/i));

    const isStorageAttachmentUrl = (url?: string | null) =>
        Boolean(url && (
            url.includes("amazonaws.com") ||
            url.includes(".s3.") ||
            url.includes("firebasestorage.googleapis.com") ||
            url.includes("firebasestorage.app")
        ));

    const getDisplayAttachmentUrl = (url?: string | null) => {
        if (!url) return "";
        return resolvedAttachmentUrls[url] || url;
    };

    const getFreshAttachmentUrl = async (url: string, name?: string | null) => {
        if (!isStorageAttachmentUrl(url)) return url;
        try {
            const res = await getSignedDownloadUrl(url, name || "attachment");
            if (res.success && res.url) {
                setResolvedAttachmentUrls((prev) => ({ ...prev, [url]: res.url! }));
                return res.url;
            }
        } catch (error) {
            console.error("Failed to resolve attachment URL:", error);
        }
        return url;
    };

    const handleAttachmentDownload = async (url: string, name?: string | null) => {
        const freshUrl = await getFreshAttachmentUrl(url, name);
        await handleFileDownload(freshUrl, name || "attachment");
    };

    const attachmentSignTargets = useMemo(() => {
        const targets: { url: string; name: string }[] = [];
        [...comments, ...directConnections].forEach((comment) => {
            const url = comment.attachmentUrl || comment.imageUrl;
            if (url && isStorageAttachmentUrl(url)) {
                targets.push({ url, name: comment.attachmentName || "attachment" });
            }
            (comment.replies || []).forEach((reply) => {
                const replyUrl = reply.attachmentUrl || reply.imageUrl;
                if (replyUrl && isStorageAttachmentUrl(replyUrl)) {
                    targets.push({ url: replyUrl, name: reply.attachmentName || "attachment" });
                }
            });
        });
        return targets;
    }, [comments, directConnections]);

    useEffect(() => {
        let cancelled = false;
        const missingTargets = attachmentSignTargets.filter((target) => !resolvedAttachmentUrls[target.url]);
        if (missingTargets.length === 0) return;

        void Promise.all(
            missingTargets.map(async (target) => {
                const res = await getSignedDownloadUrl(target.url, target.name);
                return res.success && res.url ? [target.url, res.url] as const : null;
            })
        ).then((entries) => {
            if (cancelled) return;
            const resolvedEntries = entries.filter(Boolean) as [string, string][];
            if (resolvedEntries.length === 0) return;
            setResolvedAttachmentUrls((prev) => ({
                ...prev,
                ...Object.fromEntries(resolvedEntries),
            }));
        }).catch((error) => {
            console.error("Failed to resolve review attachment URLs:", error);
        });

        return () => {
            cancelled = true;
        };
    }, [attachmentSignTargets]);

    const seekToCommentTime = (timestamp: number) => {
        if (timestamp < 0) return;
        const player = videoPlayerRef.current;
        if (!player) return;
        player.currentTime = timestamp;
        setCurrentTime(timestamp);
    };

    const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedAttachment(file);

        if (isImageFile(file.type, file.name) || isVideoFile(file.type, file.name)) {
            const preview = URL.createObjectURL(file);
            setSelectedAttachmentPreview(preview);
        } else {
            setSelectedAttachmentPreview("");
        }
        setAnnotatedImagePreview("");
        setImageOverlayText("");
    };

    const clearAttachmentSelection = () => {
        if (selectedAttachmentPreview) URL.revokeObjectURL(selectedAttachmentPreview);
        setSelectedAttachment(null);
        setSelectedAttachmentPreview("");
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
        if (selectedAttachmentPreview && selectedAttachment && isImageFile(selectedAttachment.type, selectedAttachment.name) && imageOverlayText.trim()) {
            drawTextOnImage(selectedAttachmentPreview, imageOverlayText).then(setAnnotatedImagePreview);
        } else {
            setAnnotatedImagePreview("");
        }
    }, [selectedAttachmentPreview, selectedAttachment, imageOverlayText]);

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
            console.log("[Download Flow] Requesting download URL from server");
            const res = await registerDownload(project.id, selectedRevisionId);
            console.log("[Download Flow] Server response received", res);
            toast.dismiss(loadingToast);
            
            if (!res.success || !res.downloadUrl) {
                throw new Error(res.error || "Could not retrieve download URL.");
            }

            const fileName = `draft_v${selectedRevision?.version || "final"}.mp4`;
            console.log("[Download Flow] Proceeding to direct high-speed download");
            
            // Bypass local storage / JS fetch-blob flow for main draft video downloads.
            // S3 and Firebase presigned URLs are pre-configured with response-content-disposition=attachment,
            // which guarantees that the browser natively downloads the file at maximum speed instead of playing it.
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = res.downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
            }, 500);

            toast.success("Download started directly from high-speed storage!");

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
            const isPayLaterActive = user?.payLater === true;
            if (!isPayLaterActive) {
                if (!isPaymentComplete) {
                    console.log("[Download Flow] Client disabled for Pay Later. Payment required first.");
                    toast.error("Please complete the project payment first.");
                    setPendingDownloadAfterFlow(true);
                    setIsPaymentModalOpen(true);
                    return;
                }
                if (!hasFeedback) {
                    console.log("[Download Flow] Client disabled for Pay Later. Feedback/Rating required first.");
                    toast.error("Please submit feedback first to unlock the download.");
                    setPendingDownloadAfterFlow(true);
                    setIsFeedbackModalOpen(true);
                    return;
                }
            } else {
                if (!isPaymentComplete) {
                    console.log("[Download Flow] Pay Later active, unpaid. Showing reminder modal.");
                    setIsPayLaterDueReminderModalOpen(true);
                    return;
                }
                if (!hasFeedback) {
                    console.log("[Download Flow] Pay Later active, paid. Feedback required first.");
                    toast.error("Please submit feedback first to unlock the download.");
                    setPendingDownloadAfterFlow(true);
                    setIsFeedbackModalOpen(true);
                    return;
                }
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

    const persistCurrentDraftComment = async (options?: { silent?: boolean; forceNotify?: boolean }) => {
        if (!project?.id || !selectedRevisionId || savingComment) return false;
        
        const content = newComment.trim();
        if (!content && !selectedAttachment) {
            if (!options?.silent) toast.error("Write a comment or upload a file.");
            return false;
        }

        setSavingComment(true);
        try {
            let attachmentUrl = "";
            let finalAttachmentFile = selectedAttachment;
            const attachmentIsImage = selectedAttachment ? isImageFile(selectedAttachment.type, selectedAttachment.name) : false;

            if (selectedAttachment && attachmentIsImage && imageOverlayText.trim() && selectedAttachmentPreview) {
                try {
                    const annotatedDataUrl = await drawTextOnImage(selectedAttachmentPreview, imageOverlayText);
                    const response = await fetch(annotatedDataUrl);
                    const blob = await response.blob();
                    finalAttachmentFile = new File([blob], selectedAttachment.name, { type: "image/jpeg" });
                } catch (error) {
                    console.error("Failed to apply text overlay:", error);
                }
            }

            if (finalAttachmentFile) {
                setUploadingAttachment(true);
                attachmentUrl = await uploadCommentAttachment(finalAttachmentFile, project.id, selectedRevisionId);
                setUploadingAttachment(false);
            }

            const commentUserId = user?.uid || (clientAccess ? (project.clientId || "client") : "guest");
            const commentUserName = user?.displayName || (clientAccess ? (project.clientName || guestName || "Client") : (guestName || "User"));
            const commentUserRole = (user as any)?.role || (clientAccess ? "client" : "guest");

            const newCommentPayload = {
                projectId: project.id,
                revisionId: selectedRevisionId,
                userId: commentUserId,
                userName: commentUserName,
                userRole: commentUserRole,
                content: content,
                imageUrl: attachmentIsImage ? attachmentUrl || null : null,
                attachmentUrl: attachmentUrl || null,
                attachmentName: finalAttachmentFile?.name || null,
                attachmentType: finalAttachmentFile?.type || null,
                attachmentSize: finalAttachmentFile?.size || null,
                timestamp: activeTab === 'timeline' ? currentTime : 0,
                createdAt: Date.now(),
                status: "open",
                replies: [],
                isDirectConnection: activeTab === 'direct',
                notificationSubmitted: false,
            };

            const commentRef = await addDoc(collection(db, "comments"), newCommentPayload);

            if (options?.forceNotify) {
                try {
                    const res = await handleNewComment(
                        project.id,
                        commentUserId,
                        commentUserName,
                        commentUserRole === "guest" ? "client" : (commentUserRole || "guest"),
                        content || "Image comment",
                        selectedRevisionId,
                        commentRef.id
                    );

                    if (!res.success) throw new Error(res.error || "WhatsApp notification failed.");

                    if (!options?.silent) {
                        toast.success("Comment saved and WhatsApp notification sent!");
                    }
                } catch (notifyError: any) {
                    console.error("Auto-submit notification failed:", notifyError);
                    if (!options?.silent) {
                        setPendingNotificationComment({
                            id: commentRef.id,
                            ...newCommentPayload,
                        });
                        toast.error(`Comment saved, but WhatsApp notification failed: ${notifyError.message || "Unknown error"}`);
                    }
                }
            } else {
                if (!options?.silent) {
                    setPendingNotificationComment({
                        id: commentRef.id,
                        ...newCommentPayload,
                    });
                    toast.success("Comment visible in review. Submit it to send WhatsApp.");
                }
            }
            setNewComment("");
            clearAttachmentSelection();
            return true;
        } catch (error) {
            console.error("Comment send error:", error);
            if (!options?.silent) toast.error("Failed to send comment.");
            return false;
        } finally {
            setUploadingAttachment(false);
            setSavingComment(false);
        }
    };

    const handleSendComment = async () => {
        await persistCurrentDraftComment();
    };

    const handleCloseReview = async () => {
        if (newComment.trim() || selectedAttachment) {
            await persistCurrentDraftComment({ silent: true, forceNotify: true });
        }
        onClose();
    };

    const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!reviewShellRef.current) return;
        if (window.matchMedia("(min-width: 768px)").matches) return;

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);

        const shellRect = reviewShellRef.current.getBoundingClientRect();

        const handlePointerMove = (moveEvent: PointerEvent) => {
            if (!reviewShellRef.current) return;
            const shellHeight = reviewShellRef.current.getBoundingClientRect().height;
            const minHeight = Math.min(390, Math.max(330, shellHeight * 0.48));
            const maxHeight = Math.max(minHeight, shellHeight - 300);
            const nextHeight = moveEvent.clientY - shellRect.top;
            setTopPaneHeight(Math.round(Math.min(Math.max(nextHeight, minHeight), maxHeight)));
        };

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
    };

    const canModifyComment = (comment: CommentDoc) => {
        if (user?.uid === comment.userId || isAdmin || isStaff) return true;
        if (clientAccess && (comment.userId === project?.clientId || comment.userId === "client")) return true;
        return isGuestReviewer && comment.userRole === "guest" && (comment.userName === guestName || comment.userName === `${guestName} (Guest)`);
    };

    const canSubmitCommentNotification = (comment: CommentDoc) => {
        if (user?.uid && comment.userId === user.uid) return true;
        if (clientAccess && (comment.userId === project?.clientId || comment.userId === "client")) return true;
        return isGuestReviewer && comment.userRole === "guest" && (comment.userName === guestName || comment.userName === `${guestName} (Guest)`);
    };

    const startEditingComment = (comment: CommentDoc) => {
        setEditingCommentId(comment.id);
        setEditingCommentText(comment.content || "");
        setReplyingTo(null);
    };

    const handleUpdateComment = async (commentId: string) => {
        const nextContent = editingCommentText.trim();
        if (!nextContent) {
            toast.error("Comment cannot be empty.");
            return;
        }
        try {
            await updateDoc(doc(db, "comments", commentId), {
                content: nextContent,
                editedAt: Date.now(),
                notificationSubmitted: false,
            });
            setEditingCommentId(null);
            setEditingCommentText("");
            toast.success("Comment updated. Submit again to notify.");
        } catch (error) {
            console.error("Comment edit error:", error);
            toast.error("Failed to edit comment.");
        }
    };

    const handleSubmitCommentNotification = async (comment: CommentDoc) => {
        if (!project?.id || !selectedRevisionId) return;
        setSubmittingCommentId(comment.id);
        try {
            const res = await handleNewComment(
                project.id,
                comment.userId || user?.uid || "guest",
                comment.userName || user?.displayName || guestName || "User",
                comment.userRole === "guest" ? "client" : (comment.userRole || (user as any)?.role || "guest"),
                comment.content || "Image comment",
                selectedRevisionId,
                comment.id
            );
            if (!res.success) throw new Error(res.error || "WhatsApp notification failed.");
            setPendingNotificationComment((current) => current?.id === comment.id ? null : current);
            toast.success("WhatsApp notification submitted.");
        } catch (error: any) {
            console.error("Comment notification submit error:", error);
            toast.error(error.message || "Failed to submit notification.");
        } finally {
            setSubmittingCommentId(null);
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
                const replyUserId = user?.uid || (clientAccess ? (project?.clientId || "client") : "guest");
                const replyUserName = user?.displayName || (clientAccess ? (project?.clientName || guestName || "Client") : (guestName || "User"));
                const replyUserRole = (user as any)?.role || (clientAccess ? "client" : "guest");

                replies.push({
                    id: `reply_${Date.now()}`,
                    userId: replyUserId,
                    userName: replyUserName,
                    userRole: replyUserRole,
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
            setLiveDownloadsUnlocked(p.downloadsUnlocked || false);
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
    const pendingCommentForNotification = useMemo(() => {
        if (!pendingNotificationComment || pendingNotificationComment.notificationSubmitted) return null;
        const liveComment = [...comments, ...directConnections].find((comment) => comment.id === pendingNotificationComment.id);
        return liveComment?.notificationSubmitted ? null : (liveComment || pendingNotificationComment);
    }, [comments, directConnections, pendingNotificationComment]);
    const timelineComments = useMemo(
        () => comments.filter((comment) => comment.timestamp >= 0 && duration > 0),
        [comments, duration]
    );

    const isTyping = newComment.trim() !== "" || !!selectedAttachment;
    const hasPendingSubmit = !isTyping && !!pendingCommentForNotification && canSubmitCommentNotification(pendingCommentForNotification);

    const uiContent = (
        <div
            ref={reviewShellRef}
            className="flex h-full min-h-0 flex-col gap-0 bg-[#07080d] text-zinc-100 lg:grid lg:grid-cols-12 lg:gap-6 lg:bg-transparent"
        >
            {/* Left Column: Video and Versions */}
            <div
                data-lenis-prevent
                className="flex h-[var(--review-top-height)] shrink-0 flex-col gap-0 overflow-hidden md:h-auto lg:col-span-8 lg:min-h-0 lg:flex-1 lg:gap-4 lg:overflow-y-auto lg:pr-2 lg:pb-6 lg:no-scrollbar"
                style={{ "--review-top-height": `${topPaneHeight || 420}px` } as React.CSSProperties}
            >
                <div className="flex items-center justify-between gap-3 bg-[#171925] px-4 py-3 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/10 lg:p-3">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-zinc-400 lg:hidden">
                        <Users className="h-4 w-4 shrink-0" />
                        {revisions.length > 1 ? (
                            <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/5 shrink-0">
                                <button
                                    onClick={() => {
                                        const idx = revisions.findIndex(r => r.id === selectedRevisionId);
                                        if (idx < revisions.length - 1) setSelectedRevisionId(revisions[idx + 1].id);
                                    }}
                                    disabled={revisions.findIndex(r => r.id === selectedRevisionId) >= revisions.length - 1}
                                    className="h-6 w-6 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-400 disabled:opacity-20 transition-all active:scale-90"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="text-[10px] font-black text-white px-1.5 tabular-nums">
                                    v{selectedRevision?.version || "?"}
                                </span>
                                <button
                                    onClick={() => {
                                        const idx = revisions.findIndex(r => r.id === selectedRevisionId);
                                        if (idx > 0) setSelectedRevisionId(revisions[idx - 1].id);
                                    }}
                                    disabled={revisions.findIndex(r => r.id === selectedRevisionId) <= 0}
                                    className="h-6 w-6 rounded-md hover:bg-white/10 flex items-center justify-center text-zinc-400 disabled:opacity-20 transition-all active:scale-90"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        ) : (
                            <span className="truncate">{selectedRevision?.description || `v${selectedRevision?.version || "?"}`}</span>
                        )}
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
                        {!guestPreview && (
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
                        )}
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
                        {!guestPreview && (
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
                        )}
                        {!guestPreview && (
                            <button
                                onClick={() => void handleCloseReview()}
                                className="flex h-7 w-7 items-center justify-center rounded bg-white/5 text-zinc-300 transition-all hover:bg-white/10 hover:text-white lg:hidden"
                                title="Close review"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="group/video relative flex min-h-[190px] flex-1 items-center justify-center overflow-hidden bg-black shadow-none md:h-[36vh] md:min-h-[250px] md:max-h-[390px] md:flex-none lg:h-auto lg:min-h-0 lg:max-h-[65vh] lg:rounded-2xl lg:border lg:border-border/50 lg:shadow-2xl"
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

                <div className="hidden space-y-2 bg-[#07080d] px-3 py-2.5 lg:block lg:space-y-3 lg:px-5 lg:py-4 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/10">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#9cb0d0] lg:gap-2 lg:text-[11px] lg:tracking-[0.22em]">
                        <Clock className="h-3.5 w-3.5 text-zinc-500 lg:h-4 lg:w-4" />
                        <span>Timeline - {formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <div className="relative h-5 lg:h-6">
                        <div
                            className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#263147]"
                            role="presentation"
                        />
                        {duration > 0 && (
                            <div
                                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#3857ff]/45"
                                style={{ width: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
                            />
                        )}
                        {timelineComments.map((comment) => {
                            const left = duration > 0 ? Math.min(100, Math.max(0, (comment.timestamp / duration) * 100)) : 0;
                            const isNearPlayhead = Math.abs(comment.timestamp - currentTime) < 0.75;
                            return (
                                <button
                                    key={comment.id}
                                    type="button"
                                    onClick={() => seekToCommentTime(comment.timestamp)}
                                    className={cn(
                                        "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#07080d] shadow-[0_0_0_2px_rgba(7,8,13,0.7)] transition-all hover:h-4 hover:w-4 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white/40 lg:h-3 lg:w-3",
                                        isNearPlayhead ? "bg-emerald-400" : "bg-[#6d79ff]"
                                    )}
                                    style={{ left: `${left}%` }}
                                    title={`${formatTime(comment.timestamp)} - ${comment.userName || "Comment"}`}
                                    aria-label={`Jump to comment at ${formatTime(comment.timestamp)}`}
                                />
                            );
                        })}
                        {duration > 0 && (
                            <div
                                className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)] lg:h-4"
                                style={{ left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
                                aria-hidden="true"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Comments */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 border-t border-[#262a3a] bg-[#11131e] px-2.5 py-2 lg:col-span-4 lg:h-auto lg:gap-3 lg:border-t-0 lg:border-l lg:border-border/50 lg:bg-transparent lg:p-0 lg:pl-4">
                <button
                    type="button"
                    onPointerDown={handleResizeStart}
                    className="mx-auto -mt-1 flex h-5 w-24 touch-none cursor-ns-resize items-center justify-center rounded-full text-[#8b72ff] transition-colors hover:text-[#a996ff] active:text-white md:hidden"
                    aria-label="Resize video area"
                    title="Drag to resize video area"
                >
                    <span className="h-1 w-12 rounded-full bg-current" />
                </button>
                <div className="flex gap-1 rounded-lg bg-[#222436] p-1 lg:rounded-xl lg:border lg:border-border/50 lg:bg-muted/40">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-md py-1 text-[12px] font-bold transition-all lg:rounded-lg lg:py-2 lg:text-xs",
                            activeTab === 'timeline' ? "bg-[#383a51] text-white shadow-sm lg:bg-background lg:text-primary" : "text-zinc-400 hover:text-foreground"
                        )}
                    >
                        <Clock className="hidden h-3.5 w-3.5 lg:block" /> Comments
                    </button>
                    <button
                        onClick={() => setActiveTab('direct')}
                        className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-md py-1 text-[12px] font-bold transition-all lg:rounded-lg lg:py-2 lg:text-xs",
                            activeTab === 'direct' ? "bg-[#383a51] text-white shadow-sm lg:bg-background lg:text-primary" : "text-zinc-400 hover:text-foreground"
                        )}
                    >
                        <MessageSquare className="hidden h-3.5 w-3.5 lg:block" /> Direct
                    </button>
                </div>

                <div data-lenis-prevent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 scrollbar-thin lg:space-y-4">
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
                                    if (activeTab !== 'timeline' || c.timestamp < 0) return;
                                    seekToCommentTime(c.timestamp);
                                }}
                                className={cn(
                                    "group relative space-y-1.5 rounded-lg bg-[#181a27] p-2 transition-all hover:border-primary/20 lg:space-y-3 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/20 lg:p-4",
                                    activeTab === 'timeline' && c.timestamp > 0 && "cursor-pointer hover:bg-[#202334] lg:hover:bg-muted/30"
                                )}
                                title={activeTab === 'timeline' && c.timestamp > 0 ? `Jump to ${formatTime(c.timestamp)}` : undefined}
                            >
                                <div className="flex items-start justify-between gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[#ee54e8] text-[8px] font-black uppercase text-black lg:h-8 lg:w-8 lg:border lg:border-primary/20 lg:bg-primary/10 lg:text-primary">
                                            {c.userName?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1 text-[12px] font-black text-zinc-100 lg:gap-1.5 lg:text-xs lg:text-foreground">
                                                {c.userName}
                                                <span className="text-[9px] font-bold text-zinc-500 lg:text-[9px]">{formatDate(c.createdAt || 0)}</span>
                                                {c.userRole && <span className="hidden text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-bold uppercase lg:inline">{c.userRole}</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                                                {c.timestamp > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            seekToCommentTime(c.timestamp);
                                                        }}
                                                        className="rounded bg-[#4d4200] px-1.5 py-0.5 text-[9px] font-black text-[#ffd21f] transition-colors hover:bg-[#6a5a00]"
                                                    >
                                                        {formatTime(c.timestamp)}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 lg:hidden">
                                        #{index + 1}
                                    </div>
                                    {canModifyComment(c) && (
                                        <div className="flex items-center gap-1 opacity-100">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEditingComment(c);
                                                }}
                                                className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteComment(c.id);
                                                }}
                                                className="p-1 text-muted-foreground transition-all hover:text-destructive"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {editingCommentId === c.id ? (
                                    <div className="space-y-1.5 pl-7 lg:pl-1">
                                        <textarea
                                            value={editingCommentText}
                                            onFocus={pauseReviewVideo}
                                            onChange={(e) => setEditingCommentText(e.target.value)}
                                            className="min-h-20 w-full resize-none rounded-lg border border-[#34374c] bg-[#202232] p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none lg:border-border/50 lg:bg-background/40 lg:text-foreground"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingCommentId(null);
                                                    setEditingCommentText("");
                                                }}
                                                className="h-8 px-3 text-xs font-bold text-zinc-400 transition-colors hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleUpdateComment(c.id)}
                                                className="h-8 rounded-md bg-[#5b55b8] px-3 text-xs font-black text-white transition-all hover:brightness-110"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap pl-7 text-[12px] font-semibold leading-snug text-zinc-200 lg:pl-1 lg:text-sm lg:font-normal lg:leading-relaxed lg:text-foreground">
                                        {c.content}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 pl-7 lg:gap-3 lg:pl-1">
                                    <button
                                        onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                                        className="text-[10px] font-bold text-zinc-300 transition-colors hover:text-white lg:text-xs lg:text-muted-foreground lg:hover:text-foreground"
                                    >
                                        Reply
                                    </button>
                                    {c.notificationSubmitted && canSubmitCommentNotification(c) && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Submitted</span>
                                    )}
                                </div>

                                {(c.attachmentUrl || c.imageUrl) && (
                                    <div className="ml-7 lg:ml-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                        {isAudioFile(c.attachmentType, c.attachmentName) ? (
                                            <InlineAudioPlayer
                                                url={getDisplayAttachmentUrl(c.attachmentUrl || c.imageUrl)}
                                                name={c.attachmentName || "Voice Message"}
                                                size={c.attachmentSize}
                                                onDownload={() => void handleAttachmentDownload(c.attachmentUrl || c.imageUrl || "", c.attachmentName || "voice-comment.webm")}
                                            />
                                        ) : (
                                            <div
                                                className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-border/50 bg-[#202232] p-2 transition-colors hover:bg-[#26293d]"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const attachmentUrl = c.attachmentUrl || c.imageUrl || "";
                                                        const attachmentName = c.attachmentName || (c.imageUrl ? "Image attachment" : "Attachment");
                                                        if (canPreviewAttachment(c.attachmentType, attachmentName)) {
                                                            setPreviewAttachment({
                                                                url: attachmentUrl,
                                                                name: attachmentName,
                                                                type: c.attachmentType,
                                                            });
                                                            return;
                                                        }
                                                        void handleAttachmentDownload(attachmentUrl, attachmentName);
                                                    }}
                                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                                >
                                                {isImageFile(c.attachmentType, c.attachmentName) || (!!c.imageUrl && !c.attachmentType) ? (
                                                    <div className="h-14 w-14 overflow-hidden rounded-md bg-black/20">
                                                        <img src={getDisplayAttachmentUrl(c.attachmentUrl || c.imageUrl)} className="h-full w-full object-cover" alt={c.attachmentName || "Comment attachment"} />
                                                    </div>
                                                ) : isVideoFile(c.attachmentType, c.attachmentName) ? (
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-black/20 text-zinc-200">
                                                        <FileVideo className="h-5 w-5" />
                                                    </div>
                                                ) : (
                                                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-black/20 text-zinc-200">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate text-[10px] font-bold text-zinc-100">
                                                        {c.attachmentName || (c.imageUrl ? "Image attachment" : "Attachment")}
                                                    </p>
                                                    <p className="text-[9px] text-zinc-400">
                                                        {formatFileSize(c.attachmentSize) || (canPreviewAttachment(c.attachmentType, c.attachmentName) ? "Preview file" : "Download file")}
                                                    </p>
                                                </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleAttachmentDownload(c.attachmentUrl || c.imageUrl || "", c.attachmentName || "attachment")}
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                                                    title="Download attachment"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {c.replies && c.replies.length > 0 && (
                                    <div className="mt-1.5 pl-2.5 border-l-2 border-border/30 space-y-1.5 lg:mt-3 lg:pl-4 lg:space-y-3">
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
                                    <div className="ml-7 space-y-1.5 rounded-lg border border-[#34374c] bg-[#202232] p-1.5 lg:ml-4 lg:border-border/50 lg:bg-background/40">
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

                </div>


                {/* Comment Input Area */}
                <div className="border-t border-[#25283a] pt-1 lg:border-border/50 lg:pt-3">
                    <div className="space-y-1.5 rounded-lg bg-[#2a2d40] p-2 lg:space-y-3 lg:rounded-2xl lg:border lg:border-border/50 lg:bg-muted/30 lg:p-4">
                        <div className="relative">
                            {isRecording ? (
                                <div className="flex items-center justify-between rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-3 h-16 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span className="text-xs font-bold text-red-400 tracking-wider">RECORDING VOICE</span>
                                        <span className="text-xs font-mono text-zinc-300 bg-black/35 px-2 py-0.5 rounded-md">
                                            {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')} / 2:00
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={cancelRecording}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                                            title="Cancel Recording"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/35 active:scale-95 transition-all"
                                            title="Stop & Save"
                                        >
                                            <Check className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <textarea
                                        value={newComment}
                                        onFocus={pauseReviewVideo}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder={activeTab === 'timeline' ? "Leave your comment..." : "Message editor directly..."}
                                        className="min-h-7 w-full resize-none border-none bg-transparent text-[12px] text-zinc-100 placeholder:text-zinc-400 focus:outline-none lg:min-h-15 lg:text-sm lg:text-foreground"
                                    />
                                    {activeTab === 'timeline' && (
                                        <div className="absolute right-0 top-0 rounded bg-[#504700] px-1 py-0.5 text-[9px] font-black text-[#ffd21f] lg:bottom-0 lg:top-auto lg:mb-2 lg:mr-2 lg:text-xs lg:bg-primary/10 lg:text-primary">
                                            {formatTime(currentTime)}:00
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {selectedAttachment && (
                            <div className="relative rounded-xl border border-border/50 bg-black/20 p-2">
                                <button onClick={clearAttachmentSelection} className="absolute right-2 top-2 p-1 rounded-full bg-black/60 text-white hover:bg-black"><X className="h-3 w-3" /></button>
                                <div className="flex items-center gap-2 pr-7">
                                    {(selectedAttachmentPreview && isImageFile(selectedAttachment.type, selectedAttachment.name)) ? (
                                        <img src={annotatedImagePreview || selectedAttachmentPreview} className="h-14 w-14 rounded-lg object-cover" alt={selectedAttachment.name} />
                                    ) : (selectedAttachmentPreview && isVideoFile(selectedAttachment.type, selectedAttachment.name)) ? (
                                        <video src={selectedAttachmentPreview} className="h-14 w-14 rounded-lg object-cover" muted />
                                    ) : isAudioFile(selectedAttachment.type, selectedAttachment.name) ? (
                                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-background/40 text-zinc-100">
                                            <Music className="h-5 w-5" />
                                        </div>
                                    ) : (
                                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-background/40 text-zinc-100">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="truncate text-[10px] font-bold text-zinc-100">{selectedAttachment.name}</p>
                                        <p className="text-[9px] text-zinc-400">{formatFileSize(selectedAttachment.size) || "Attachment"}</p>
                                    </div>
                                </div>
                                {isImageFile(selectedAttachment.type, selectedAttachment.name) && (
                                    <input 
                                        type="text"
                                        value={imageOverlayText}
                                        onChange={(e) => setImageOverlayText(e.target.value)}
                                        placeholder="Add text overlay..."
                                        className="mt-2 w-full rounded-lg border border-border/30 bg-background/50 p-2 text-[10px] focus:outline-none"
                                    />
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between border-t border-[#36394f] pt-1 lg:border-border/30 lg:pt-3">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-muted lg:p-2 lg:text-muted-foreground"
                                    title="Attach file"
                                    disabled={isRecording}
                                >
                                    <ImageIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-muted lg:p-2 lg:text-muted-foreground"
                                    title="Record Voice Message"
                                    disabled={isRecording}
                                >
                                    <Mic className="h-3 w-3 lg:h-4 lg:w-4" />
                                </button>
                                <button className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-muted lg:hidden" title="Add reaction">
                                    <Smile className="h-3 w-3" />
                                </button>
                                <button className="rounded-lg p-1 text-zinc-300 transition-colors hover:bg-muted lg:hidden" title="Approve">
                                    <ThumbsUp className="h-3 w-3" />
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar,.7z" onChange={handleAttachmentSelect} />
                            </div>
                            <div className="flex items-center gap-2">
                                {hasPendingSubmit ? (
                                    <button
                                        onClick={() => handleSubmitCommentNotification(pendingCommentForNotification)}
                                        disabled={submittingCommentId === pendingCommentForNotification.id}
                                        className="flex h-7 px-4 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50 lg:h-8 lg:px-5 lg:text-[10px] lg:font-black lg:uppercase lg:tracking-widest"
                                    >
                                        {submittingCommentId === pendingCommentForNotification.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                        ) : (
                                            <Check className="h-3 w-3 mr-1.5" />
                                        )}
                                        {submittingCommentId === pendingCommentForNotification.id ? "Submitting..." : "Submit"}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSendComment}
                                        disabled={savingComment || !isTyping}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5b55b8] text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 lg:h-8 lg:w-auto lg:px-5 lg:bg-primary lg:text-primary-foreground lg:text-[10px] lg:font-black lg:uppercase lg:tracking-widest"
                                    >
                                        {(savingComment || uploadingAttachment) ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Send className="h-3 w-3" />
                                        )}
                                        <span className="hidden lg:inline ml-1.5">Send</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {hasPendingSubmit && (
                            <p className="text-[10px] text-amber-500/90 dark:text-amber-400/90 text-right mt-2 font-medium">
                                *after clicking on submit button the editor will get notification
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (guestPreview) {
        return (
            <div className="h-[100dvh] overflow-hidden bg-background p-3 md:p-6">
                <div className="mx-auto flex h-full max-w-400 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 overflow-hidden">
                        {uiContent}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={() => void handleCloseReview()}
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

            {previewAttachment && (
                <div
                    className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl"
                    onClick={() => setPreviewAttachment(null)}
                >
                    <div
                        className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-[#090b12] p-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewAttachment(null)}
                            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                            title="Close preview"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => void handleAttachmentDownload(previewAttachment.url, previewAttachment.name)}
                            className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"
                            title="Download attachment"
                        >
                            <Download className="h-4 w-4" />
                            Download
                        </button>

                        {isImageFile(previewAttachment.type, previewAttachment.name) && (
                            <div className="flex max-h-[78vh] items-center justify-center">
                                <img
                                    src={getDisplayAttachmentUrl(previewAttachment.url)}
                                    alt={previewAttachment.name}
                                    className="max-h-[78vh] max-w-full rounded-lg object-contain"
                                />
                            </div>
                        )}

                        {isVideoFile(previewAttachment.type, previewAttachment.name) && (
                            <VideoPlayer
                                videoPath={getDisplayAttachmentUrl(previewAttachment.url)}
                                title={previewAttachment.name}
                                className="w-full aspect-video rounded-lg"
                            />
                        )}

                        {isAudioFile(previewAttachment.type, previewAttachment.name) && (
                            <div className="rounded-xl border border-border/50 bg-card p-6">
                                <p className="mb-4 text-sm font-bold text-foreground">{previewAttachment.name}</p>
                                <audio controls className="w-full" src={getDisplayAttachmentUrl(previewAttachment.url)} preload="metadata" />
                            </div>
                        )}

                        {!isImageFile(previewAttachment.type, previewAttachment.name) &&
                            !isVideoFile(previewAttachment.type, previewAttachment.name) &&
                            !isAudioFile(previewAttachment.type, previewAttachment.name) && (
                                previewAttachment.name.match(/\.pdf$/i) ? (
                                    <iframe
                                        src={getDisplayAttachmentUrl(previewAttachment.url)}
                                        title={previewAttachment.name}
                                        className="h-[78vh] w-full rounded-lg border border-white/10 bg-white"
                                    />
                                ) : (
                                    <div className="rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">
                                        Preview is not available for this file type yet. Use Download to open it locally.
                                    </div>
                                )
                            )}
                    </div>
                </div>
            )}

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
                        prefill={{ name: user?.displayName || project?.clientName || guestName || "Client", email: user?.email || "" }}
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

            {/* Pay Later Due Reminder Modal */}
            <Modal
                isOpen={isPayLaterDueReminderModalOpen && isClient}
                onClose={() => setIsPayLaterDueReminderModalOpen(false)}
                title="Outstanding Balance Reminder"
                maxWidth="max-w-md"
            >
                <div className="space-y-6 mt-4 text-center">
                    <p className="text-sm text-zinc-300 leading-relaxed">
                        Your final balance of <span className="font-bold text-white">₹{remainingAmount.toLocaleString()}</span> is due. As a Pay Later client, you can pay this anytime from your dashboard.
                    </p>
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium">
                        Click "Proceed to Download" to leave your editor rating and download your video.
                    </div>
                    <button
                        onClick={() => {
                            setIsPayLaterDueReminderModalOpen(false);
                            if (!hasFeedback) {
                                setPendingDownloadAfterFlow(true);
                                setIsFeedbackModalOpen(true);
                            } else {
                                void startDownload();
                            }
                        }}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-[12px] font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
                    >
                        Proceed to Download
                    </button>
                </div>
            </Modal>
        </>
    );
}
