"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { UploadService, UploadProgress } from "@/lib/services/upload-service";
import { Revision, VideoJob } from "@/types/schema";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Loader2,
    ArrowLeft,
    UploadCloud,
    FileVideo,
    Zap,
    ShieldCheck,
    ChevronRight,
    X,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { handleRevisionUploaded } from "@/app/actions/notification-actions";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MAX_FILE_SIZE_GB } from "@/lib/constants";

import Uppy from '@uppy/core';
import AwsS3Multipart from '@uppy/aws-s3';
import '@uppy/core/css/style.min.css';

export default function UploadRevisionPage() {
    const params = useParams();
    const id = params?.id as string;
    const { user } = useAuth();
    const router = useRouter();

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [assetStatus, setAssetStatus] = useState<'waiting' | 'preparing' | 'ready' | 'errored'>('waiting');
    const [playbackId, setPlaybackId] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [revisionId, setRevisionId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProg, setUploadProg] = useState<UploadProgress | null>(null);

    const lastUpdateRef = useRef<number>(0);
    const progressSamples = useRef<{ time: number, bytes: number }[]>([]);

    const [uppy] = useState(() => 
        new Uppy({
            id: 'video-uploader',
            autoProceed: false,
            allowMultipleUploadBatches: false,
            debug: false,
            restrictions: {
                maxNumberOfFiles: 1,
                allowedFileTypes: ['video/*']
            }
        }).use(AwsS3Multipart, {
            limit: 64, // Absolute maximum concurrency for lightning fast speed
            getChunkSize: (file) => 50 * 1024 * 1024, // 50MB chunks for extreme throughput
            shouldUseMultipart: true,
            retryDelays: [0, 1000, 3000, 5000],
            createMultipartUpload: async (file) => {
                const response = await fetch('/api/upload/s3/multipart', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'create', filename: file.name, type: file.type }),
                });
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Create multipart failed: ${response.status} - ${errText}`);
                }
                return response.json();
            },
            listParts: async (file, { uploadId, key }) => {
                const response = await fetch('/api/upload/s3/multipart', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'listParts', uploadId, key }),
                });
                return response.json();
            },
            abortMultipartUpload: async (file, { uploadId, key }) => {
                await fetch('/api/upload/s3/multipart', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'abort', uploadId, key }),
                });
            },
            signPart: async (file, partData) => {
                const { uploadId, key, partNumber } = partData;
                const response = await fetch('/api/upload/s3/multipart', {
                    method: 'PUT',
                    body: JSON.stringify({ uploadId, key, partNumbers: [partNumber] }),
                });
                const { presignedUrls } = await response.json();
                return { url: presignedUrls[partNumber], headers: {} };
            },
            // @ts-expect-error - missing in TS definition
            prepareUploadParts: async (file: any, partData: any) => {
                const { uploadId, key } = partData;
                let numbers: number[] = [];
                
                if (partData.partNumbers && Array.isArray(partData.partNumbers)) {
                    numbers = partData.partNumbers;
                } else if (partData.parts && Array.isArray(partData.parts)) {
                    numbers = partData.parts.map((p: any) => p.number || p.partNumber);
                } else if (partData.partData && Array.isArray(partData.partData.parts)) {
                    numbers = partData.partData.parts.map((p: any) => p.number || p.partNumber);
                }
        
                const response = await fetch('/api/upload/s3/multipart', {
                    method: 'PUT',
                    body: JSON.stringify({ uploadId, key, partNumbers: numbers }),
                });
                
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Failed to sign parts: ${text}`);
                }
                
                return response.json();
            },
            completeMultipartUpload: async (file, { uploadId, key, parts }) => {
                const response = await fetch('/api/upload/s3/multipart', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'complete', uploadId, key, parts }),
                });
                const { location } = await response.json();
                
                const passthrough = file.meta.passthrough;
                
                const ingestResponse = await fetch('/api/ingest', {
                    method: 'POST',
                    body: JSON.stringify({ url: location, passthrough }),
                });
                const ingestData = await ingestResponse.json();
                
                if (!ingestResponse.ok) {
                    throw new Error(`Ingest failed: ${ingestData.error}`);
                }
                
                return { location, muxAssetId: ingestData.id };
            },
        })
    );

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const startPolling = useCallback(async (id: string) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/status/${id}`);
                const data = await response.json();

                if (data.status === 'ready') {
                    setAssetStatus('ready');
                    setPlaybackId(data.playbackId);
                    clearInterval(interval);
                    toast.success("Video is now ready!");
                } else if (data.status === 'errored') {
                    setAssetStatus('errored');
                    clearInterval(interval);
                    toast.error("Video processing failed.");
                } else {
                    setAssetStatus('preparing');
                }
            } catch (error) {
                console.error('Polling error', error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isComplete && revisionId && assetStatus === 'preparing') {
            startPolling(revisionId);
        }
    }, [isComplete, revisionId, assetStatus, startPolling]);

    useEffect(() => {
        const handleUploadProgress = (file: any, progress: any) => {
            const total = progress.bytesTotal || 0;
            const uploaded = progress.bytesUploaded || 0;
            const now = Date.now();
            
            if (now - lastUpdateRef.current < 100 && uploaded < total) return;
            lastUpdateRef.current = now;

            const percent = total > 0 ? (uploaded / total * 100) : 0;
            
            progressSamples.current.push({ time: now, bytes: uploaded });
            const twoSecondsAgo = now - 2000;
            while (progressSamples.current.length > 2 && progressSamples.current[0].time < twoSecondsAgo) {
                progressSamples.current.shift();
            }

            const firstSample = progressSamples.current[0];
            const elapsedSeconds = (now - firstSample.time) / 1000;
            const bytesInPeriod = uploaded - firstSample.bytes;
            
            let speedBps = 0;
            let eta = 0;
            if (elapsedSeconds > 0) {
                speedBps = bytesInPeriod / elapsedSeconds;
                eta = speedBps > 0 ? (total - uploaded) / speedBps : 0;
            }

            setUploadProg({
                percent,
                transferred: uploaded,
                total,
                speedBps,
                eta,
                status: 'uploading'
            });
        };

        const handleUploadSuccess = () => {
            setIsUploading(false);
            setIsComplete(true);
            setAssetStatus('preparing');
            setUploadProg({
                percent: 100, transferred: file?.size || 0, total: file?.size || 0, status: 'complete'
            });
            handleRevisionUploaded(id);
        };

        const handleUploadError = (file: any, error: any) => {
            console.error('Uppy S3 Multipart Error:', error);
            setIsUploading(false);
            setAssetStatus('errored');
            toast.error("Upload failed. Please try again.");
            setUploadProg(null);
        };

        uppy.on('upload-progress', handleUploadProgress);
        uppy.on('upload-success', handleUploadSuccess);
        uppy.on('upload-error', handleUploadError);

        return () => {
            uppy.off('upload-progress', handleUploadProgress);
            uppy.off('upload-success', handleUploadSuccess);
            uppy.off('upload-error', handleUploadError);
        };
    }, [uppy, id, file]);

    useEffect(() => {
        return () => {
            uppy.destroy();
        };
    }, [uppy]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(f));
        uppy.cancelAll(); // Reset Uppy state for new file
        setIsComplete(false);
        setAssetStatus('waiting');
        setPlaybackId(null);
    }, [previewUrl, uppy]);

    const handleCancel = () => {
        uppy.cancelAll();
        setIsUploading(false);
        setUploadProg(null);
    };

    const handleDownload = () => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !user) {
            toast.error("Please select a file first.");
            return;
        }

        setIsUploading(true);
        setAssetStatus('waiting');
        setUploadProg({
            percent: 0, transferred: 0, total: file.size, status: 'initial'
        });

        try {
            // 1. Versioning Logic
            const q = query(
                collection(db, "revisions"),
                where("projectId", "==", id)
            );
            const snap = await getDocs(q);
            let nextVersion = 1;
            if (!snap.empty) {
                // Sort in memory by version (descending) and get the latest
                const revisions = snap.docs.map(doc => doc.data() as Revision);
                const latest = revisions.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
                nextVersion = (latest.version || 0) + 1;
            }

            const revisionRef = doc(collection(db, "revisions"));
            const rId = revisionRef.id;
            setRevisionId(rId);

            // 1. Create the Revision document
            const newRevision: Revision = {
                id: rId,
                projectId: id,
                version: nextVersion,
                videoUrl: "", // Use playbackId instead for Mux
                status: "active",
                uploadedBy: user.uid,
                createdAt: Date.now(),
                description,
            };

            await setDoc(revisionRef, newRevision);

            // 2. Create VideoJob for tracking processing status
            const videoJob: VideoJob = {
                id: rId,
                projectId: id,
                revisionId: rId,
                status: "pending",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            await setDoc(doc(db, "video_jobs", rId), videoJob);

            // 3. Perform the upload via Uppy S3 Multipart
            try {
                uppy.addFile({
                    name: file.name,
                    type: file.type,
                    data: file,
                    source: 'Local',
                    isRemote: false,
                    meta: {
                        passthrough: JSON.stringify({ projectId: id, revisionId: rId, type: 'revision' })
                    }
                });
            } catch (err) {
                console.warn("Uppy addFile error (might already exist):", err);
            }

            lastUpdateRef.current = Date.now();
            progressSamples.current = [{ time: Date.now(), bytes: 0 }];
            
            uppy.upload();
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== "AbortError") {
                console.error("Upload preparation failed:", err);
                toast.error("Upload preparation failed. Please try again.");
            }
            setIsUploading(false);
            setUploadProg(null);
        }
    };

    const statusLabel = uploadProg === null
        ? "Initializing..."
        : uploadProg.percent === 100
        ? "Finalizing..."
        : `Hyper-Threaded Uploading... ${UploadService.formatSpeed(uploadProg.speedBps || 0)}`;

    return (
        <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl space-y-10"
            >
                <Link
                    href={`/dashboard/projects/${id}`}
                    className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Project
                </Link>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">New Version</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Direct Upload</span>
                    </div>
                    <h1 className="premium-header text-4xl text-foreground">
                        Upload New <span className="text-muted-foreground">Draft</span>
                    </h1>
                    <p className="text-[13px] text-muted-foreground font-medium max-w-md">
                        High-speed cloud proxy upload using a direct stream for maximum throughput.
                    </p>
                </div>

                <form
                    onSubmit={handleUpload}
                    className="glass-panel rounded-[3rem] p-12 border-border relative overflow-hidden space-y-12 shadow-2xl"
                >
                    <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                        <Zap className="h-32 w-32 text-primary blur-3xl" />
                    </div>

                    {!isComplete && (
                        <div className="space-y-6 relative z-10">
                            <Label className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">
                                Master Video File
                            </Label>
                            <AnimatePresence mode="wait">
                                {previewUrl ? (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        className="relative rounded-[2rem] overflow-hidden border border-primary/40 shadow-xl bg-black"
                                    >
                                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                        <video 
                                            src={previewUrl} 
                                            controls 
                                            playsInline 
                                            className="w-full max-h-[320px] object-contain" 
                                        />
                                        {!isUploading && (
                                            <label className="absolute inset-0 flex items-end justify-center pb-4 bg-gradient-to-t from-black/60 to-transparent cursor-pointer opacity-0 hover:opacity-100 transition-opacity">
                                                <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest bg-white/20 backdrop-blur px-4 py-2 rounded-xl border border-white/30">
                                                    Change File
                                                </span>
                                            </label>
                                        )}
                                        <div className="px-6 py-4 bg-muted/10 border-t border-border flex items-center gap-3">
                                            <FileVideo className="h-4 w-4 text-primary shrink-0" />
                                            <span className="text-[12px] font-black text-foreground truncate">{file?.name}</span>
                                            <span className="ml-auto text-[10px] font-black text-emerald-500 uppercase tracking-widest shrink-0">
                                                {file ? UploadService.formatBytes(file.size) : ""}
                                            </span>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="picker"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={cn(
                                            "group relative border-2 border-dashed border-border rounded-[2.5rem] bg-muted/30",
                                            "hover:bg-muted/50 hover:border-primary/50 transition-all duration-700",
                                            "min-h-[200px] flex flex-col items-center justify-center text-center cursor-pointer p-10 shadow-inner"
                                        )}
                                    >
                                        <input
                                            type="file"
                                            accept="video/*"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                            onChange={handleFileChange}
                                            required
                                        />
                                        <div className="space-y-4">
                                            <div className="h-20 w-20 bg-muted/50 rounded-3xl flex items-center justify-center mx-auto border border-border group-hover:scale-110 group-hover:border-primary/40 transition-all duration-500 shadow-lg">
                                                <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-base font-black text-muted-foreground group-hover:text-foreground/90 transition-colors">INITIATE_HANDOVER_PROTOCOL</p>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">MP4 · MOV · WEBM // LIMIT {MAX_FILE_SIZE_GB} GB</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {!isComplete && (
                        <div className="space-y-6 relative z-10">
                            <Label htmlFor="description" className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">
                                Operational Notes
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Specify revisions, technical adjustments, or focus points for this version..."
                                className="bg-muted/30 border-border focus:border-primary/50 focus:bg-muted/50 transition-all duration-700 rounded-[2rem] font-bold text-foreground placeholder:text-muted-foreground text-base leading-relaxed p-8 min-h-[160px] shadow-inner"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={isUploading}
                            />
                        </div>
                    )}

                    <AnimatePresence>
                        {isUploading && uploadProg !== null && (
                            <motion.div
                                key="progress"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6 relative z-10 p-8 rounded-[2.5rem] bg-primary/5 border border-primary/20 shadow-[0_0_40px_rgba(var(--primary),0.1)] overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Zap className="h-16 w-16 text-primary animate-pulse" />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                                    {statusLabel}
                                                </span>
                                            </div>
                                            {uploadProg.eta !== undefined && uploadProg.eta > 0 && (
                                                <div className="flex items-center gap-2 opacity-60">
                                                    <div className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                        {UploadService.formatEta(uploadProg.eta)} remaining
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-foreground tracking-tighter leading-none">
                                                {Math.round(uploadProg.percent)}%
                                            </span>
                                            <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                                                {UploadService.formatBytes(uploadProg.transferred)} / {UploadService.formatBytes(uploadProg.total)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-3 w-full bg-muted/30 rounded-full overflow-hidden border border-border/50 relative">
                                        <motion.div
                                            animate={{ width: `${uploadProg.percent}%` }}
                                            transition={{ ease: "linear", duration: 0.2 }}
                                            className="h-full bg-primary relative"
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" />
                                        </motion.div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/40">
                                            <span className="block text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Current Speed</span>
                                            <span className="text-sm font-black text-foreground">{UploadService.formatSpeed(uploadProg.speedBps || 0)}</span>
                                        </div>
                                        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/40">
                                            <span className="block text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</span>
                                            <span className="text-sm font-black text-emerald-500">Active Pipeline</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {isComplete && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6 relative z-10"
                            >
                                <div className="flex items-center gap-6 p-8 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                                    <div className="h-16 w-16 rounded-3xl bg-emerald-500/20 flex items-center justify-center shadow-lg border border-emerald-500/30">
                                        <ShieldCheck className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Upload Finalized</h3>
                                        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">Data moved to edge processing</p>
                                    </div>
                                </div>

                                {assetStatus === 'preparing' && (
                                    <div className="p-8 rounded-[2.5rem] bg-primary/5 border border-primary/20 flex items-center justify-between shadow-[0_0_40px_rgba(var(--primary),0.1)]">
                                        <div className="flex items-center gap-4">
                                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                                            <div>
                                                <p className="text-sm font-black text-foreground uppercase tracking-wide">Processing & Transcoding...</p>
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Generating HLS Adaptive Bitrate Streams</p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                                            <span className="text-[9px] font-black text-primary uppercase tracking-widest">HLS-V3</span>
                                        </div>
                                    </div>
                                )}

                                {assetStatus === 'ready' && (
                                    <div className="space-y-6">
                                        <div className="p-8 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                                                    <Zap className="h-5 w-5 text-emerald-500 fill-emerald-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-emerald-500 uppercase tracking-wide">Stream Ready</p>
                                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Playback ID: {playbackId}</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleDownload}
                                                className="px-5 py-2.5 rounded-xl bg-white/5 border border-border text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                                            >
                                                <UploadCloud className="h-3.5 w-3.5" /> Download Original
                                            </button>
                                        </div>
                                        
                                        <button 
                                            type="button"
                                            onClick={() => router.push(`/dashboard/projects/${id}`)}
                                            className="w-full h-16 rounded-[2rem] bg-primary text-primary-foreground text-[12px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all shadow-xl shadow-primary/10"
                                        >
                                            View Project Dashboard
                                        </button>
                                    </div>
                                )}

                                {assetStatus === 'errored' && (
                                    <div className="p-8 rounded-[2.5rem] bg-destructive/5 border border-destructive/20 text-center space-y-4">
                                        <X className="h-12 w-12 text-destructive mx-auto" />
                                        <h3 className="text-lg font-black text-foreground uppercase">Processing Error</h3>
                                        <p className="text-[11px] font-medium text-muted-foreground max-w-xs mx-auto">
                                            Something went wrong while optimizing your video. Please try re-uploading.
                                        </p>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setIsComplete(false);
                                                setIsUploading(false);
                                                setAssetStatus('waiting');
                                            }}
                                            className="px-8 py-3 rounded-xl bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Retry Upload
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!isComplete && (
                        <div className="relative z-10 pt-4 flex gap-3">
                            {isUploading && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="h-16 px-8 rounded-2xl bg-muted border border-border text-muted-foreground text-[12px] font-black uppercase tracking-[0.2em] hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="h-4 w-4" />
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={!file || isUploading}
                                className="flex-1 h-16 rounded-2xl bg-primary text-primary-foreground text-[12px] font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 shadow-md shadow-primary/10 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none group"
                            >
                                {isUploading ? (
                                    <><Loader2 className="h-5 w-5 animate-spin" />{statusLabel}</>
                                ) : (
                                    <>Start Upload<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-3 pt-6 border-t border-border">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                            Direct High-Speed Transfer · Resumable
                        </span>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
