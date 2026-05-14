"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Play, Pause, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoPlayerProps {
    videoPath?: string; // Legacy/Fallback URL
    playbackId?: string; // Mux Playback ID
    thumbnailUrl?: string;
    title?: string;
    className?: string;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onPlaying?: () => void;
    onPause?: () => void;
    onError?: (error: Error) => void;
    onLoadedMetadata?: (duration: number) => void;
    onEnded?: () => void;

    primaryColor?: string;
    accentColor?: string;
    startTime?: number;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    hideControls?: boolean;
    envKey?: string; // Mux Data env key
    tokens?: {
        playback?: string;
        thumbnail?: string;
        storyboard?: string;
    };
    preferPlayback?: "mse" | "native";
    forwardSeekOffset?: number;
    backwardSeekOffset?: number;
    forceNative?: boolean;
    metadata?: {
        video_id?: string;
        video_title?: string;
        viewer_user_id?: string;
        [key: string]: any;
    };
}

const VideoPlayer = forwardRef<any, VideoPlayerProps>((props, ref) => {
    const {
        videoPath,
        playbackId,
        thumbnailUrl,
        title,
        className,

        primaryColor = "#3b82f6",
        accentColor = "#3b82f6",
        startTime = 0,
        autoPlay = false,
        muted = false,
        loop = false,
        hideControls = false,
        envKey,
        tokens,
        preferPlayback,
        forwardSeekOffset,
        backwardSeekOffset,
        metadata,
        forceNative = false,
        onTimeUpdate,
        onPlaying,
        onPause,
        onError,
        onLoadedMetadata,
        onEnded,
    } = props;

    const playerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isFallingBack, setIsFallingBack] = useState(false);

    const [isPaused, setIsPaused] = useState(true);
    const [currentTime, setCurrentTime] = useState(startTime);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(muted);
    const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
    const [lastAction, setLastAction] = useState<"play" | "pause" | "seek-f" | "seek-b" | "mute" | "unmute" | null>(null);


    // Expose the underlying player element via ref
    useImperativeHandle(ref, () => playerRef.current);

    // Prioritize Mux Playback ID unless forced native
    const isMux = !forceNative && !isFallingBack && (!!playbackId || (videoPath?.startsWith("mux://")));
    const effectivePlaybackId = playbackId || (videoPath?.startsWith("mux://") ? videoPath.replace("mux://", "") : null);

    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
        setIsPaused(true);
        setCurrentTime(startTime);
    }, [effectivePlaybackId, videoPath, startTime]);

    // Handle Keyboard Shortcuts
    useEffect(() => {
        if (hideControls) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
                
                const player = playerRef.current;
                if (!player) return;

                switch (e.key.toLowerCase()) {
                    case " ":
                    case "k":
                        e.preventDefault();
                        if (player.paused) player.play();
                        else player.pause();
                        break;
                    case "arrowleft":
                    case "j":
                        e.preventDefault();
                        player.currentTime = Math.max(0, player.currentTime - 10);
                        setLastAction("seek-b");
                        break;
                    case "arrowright":
                    case "l":
                        e.preventDefault();
                        player.currentTime = Math.min(player.duration, player.currentTime + 10);
                        setLastAction("seek-f");
                        break;
                    case "m":
                        e.preventDefault();
                        player.muted = !player.muted;
                        setIsMuted(player.muted);
                        setLastAction(player.muted ? "mute" : "unmute");
                        break;
                    case "f":
                        e.preventDefault();
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                        } else {
                            player.requestFullscreen?.() || player.parentElement?.requestFullscreen?.();
                        }
                        break;
                }
            };

            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }
    }, [hideControls]);


    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
        setIsLoading(true);
    };

    if (!isMux && !videoPath) {
        return (
            <div className={cn("group relative w-full h-full min-h-[200px] bg-black/90 overflow-hidden flex flex-col items-center justify-center border border-white/5 shadow-2xl", className)}>
                <AlertCircle className="h-10 w-10 text-white/20 mb-3" />
                <div className="text-center">
                    <p className="text-sm font-bold text-white/40 uppercase tracking-widest">No Video Source</p>
                    <p className="text-[10px] text-white/20 mt-1">Please upload a file or check the connection</p>
                </div>
            </div>
        );
    }

    // Handling Mux "optimizing" state (waiting for playbackId)
    if (isMux && videoPath?.startsWith("mux://") && !playbackId) {
        return (
            <div className={cn("group relative w-full h-full min-h-[200px] bg-[#050505] overflow-hidden flex flex-col items-center justify-center gap-6 border border-white/5 shadow-2xl", className)}>
                <div className="relative">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [0.3, 0.6, 0.3],
                            rotate: [0, 180, 360]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-8 bg-primary/10 blur-3xl rounded-full"
                    />
                    <div className="w-20 h-20 border-2 border-white/5 border-t-primary rounded-full animate-[spin_1.5s_linear_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-primary/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-primary/30">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        </div>
                    </div>
                </div>
                <div className="text-center relative z-10">
                    <motion.h3 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg font-black text-white uppercase tracking-[0.3em]"
                    >
                        Mastering
                    </motion.h3>
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ delay: 0.2 }}
                        className="text-[10px] text-white/50 mt-2 font-medium max-w-[200px] leading-relaxed"
                    >
                        Optimizing bitrates and generating high-fidelity renditions for your project.
                    </motion.p>
                </div>
                <div className="w-48 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "group relative w-full h-full bg-black overflow-hidden flex items-center justify-center shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 transition-all duration-500",
            hasError ? "border-destructive/30" : "hover:border-primary/30",
            className
        )}
        onClick={(e) => {
            if (hideControls && playerRef.current) {
                // Don't toggle if clicking on a button or interactive element inside
                if ((e.target as HTMLElement).closest('button')) return;
                
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const width = rect.width;

                // Double click detection for seeking (simulated with a click count or just standard toggle)
                // For now, let's just do single click toggle as it's more standard for desktop overlays
                if (isPaused) playerRef.current.play();
                else playerRef.current.pause();
            }
        }}
        onDoubleClick={(e) => {
            if (hideControls && playerRef.current) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = e.clientX - rect.left;
                const width = rect.width;

                if (x < width * 0.3) {
                    playerRef.current.currentTime = Math.max(0, playerRef.current.currentTime - 10);
                    setLastAction("seek-b");
                } else if (x > width * 0.7) {
                    playerRef.current.currentTime = Math.min(playerRef.current.duration, playerRef.current.currentTime + 10);
                    setLastAction("seek-f");
                }
            }
        }}
    >
            {isLoading && !hasError && (
                <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            )}

            {hasError ? (
                <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Playback Failed</h4>
                        <p className="text-[10px] text-white/50 mt-1 max-w-xs mx-auto">There was a problem loading this video stream. This could be due to network issues or the file being processed.</p>
                    </div>
                    <button 
                        onClick={handleRetry}
                        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Retry Connection
                    </button>
                    {videoPath && !videoPath.startsWith("mux://") && (
                        <button 
                            onClick={() => {
                                setIsFallingBack(true);
                                setHasError(false);
                                setIsLoading(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Switch to Legacy Player
                        </button>
                    )}
                </div>
            ) : (
                isMux ? (
                    <MuxPlayer
                        ref={playerRef}
                        playbackId={effectivePlaybackId!}
                        metadata={{
                            video_id: metadata?.video_id || effectivePlaybackId,
                            video_title: metadata?.video_title || title || "Project Video",
                            viewer_user_id: metadata?.viewer_user_id,
                            ...metadata
                        }}
                        className="w-full h-full object-contain"
                        streamType="on-demand"
                        placeholder={thumbnailUrl}
                        accentColor={accentColor}
                        primaryColor={primaryColor}
                        title={title}
                        startTime={startTime}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        tokens={tokens}
                        envKey={envKey}
                        preferPlayback={preferPlayback}
                        forwardSeekOffset={forwardSeekOffset}
                        backwardSeekOffset={backwardSeekOffset}
                        nohotkeys={hideControls}
                        {...(hideControls ? {
                            "nocomponents": "play-button,seek-backward,seek-forward,mute-button,volume-range,time-range,time-display,duration-display,playback-rate-button,fullscreen-button,airplay-button,cast-button,pip-button,quality-selection"
                        } : {})}
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setCurrentTime(target.currentTime);
                            onTimeUpdate?.(target.currentTime, target.duration);
                        }}
                        onLoadedMetadata={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setIsLoading(false);
                            setDuration(target.duration);
                            onLoadedMetadata?.(target.duration);
                        }}
                        onPlay={() => {
                            setIsLoading(false);
                            setIsPaused(false);
                            setLastAction("play");
                            onPlaying?.();
                        }}
                        onPause={() => {
                            setIsPaused(true);
                            setLastAction("pause");
                            onPause?.();
                        }}
                        onEnded={onEnded}
                        onError={(e) => {
                            console.error("Mux Player Error:", e);
                            setHasError(true);
                            setIsLoading(false);
                            onError?.(new Error("Mux Player Error"));
                        }}
                    />
                ) : (
                    <video
                        ref={playerRef}
                        src={videoPath}
                        controls={!hideControls}
                        className="w-full h-full object-contain"
                        poster={thumbnailUrl}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setCurrentTime(target.currentTime);
                            onTimeUpdate?.(target.currentTime, target.duration);
                        }}
                        onLoadedMetadata={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setIsLoading(false);
                            setDuration(target.duration);
                            onLoadedMetadata?.(target.duration);
                        }}
                        onPlay={() => {
                            setIsLoading(false);
                            setIsPaused(false);
                            setLastAction("play");
                            onPlaying?.();
                        }}
                        onPause={() => {
                            setIsPaused(true);
                            setLastAction("pause");
                            onPause?.();
                        }}
                        onEnded={onEnded}
                        onError={() => {
                            setHasError(true);
                            setIsLoading(false);
                            onError?.(new Error("Video Fallback Error"));
                        }}
                    />
                )
            )}

            {/* Global Watermark is now handled by GlobalVideoWatermark component via layout */}

            {/* Icon Flash Animation */}
            <AnimatePresence mode="wait">
                {lastAction === "play" && (
                    <motion.div
                        key="play-flash"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.5] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                            <Play fill="white" size={32} className="ml-1 text-white" />
                        </div>
                    </motion.div>
                )}
                {lastAction === "pause" && (
                    <motion.div
                        key="pause-flash"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 1.5] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                            <Pause fill="white" size={32} className="text-white" />
                        </div>
                    </motion.div>
                )}
                {(lastAction === "seek-f" || lastAction === "seek-b") && (
                    <motion.div
                        key={`seek-${lastAction}`}
                        initial={{ opacity: 0, x: lastAction === "seek-f" ? 20 : -20 }}
                        animate={{ opacity: [0, 1, 0], x: lastAction === "seek-f" ? [20, 40, 60] : [-20, -40, -60] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <RotateCcw size={48} className={cn("text-white", lastAction === "seek-f" && "rotate-180")} />
                            <span className="text-white text-xs font-black uppercase tracking-widest">10s</span>
                        </div>
                    </motion.div>
                )}
                {(lastAction === "mute" || lastAction === "unmute" || isMuted) && (
                    <motion.div
                        key="mute-flash"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: [0, 1, 0], y: [10, 0, -10] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="absolute top-8 right-8 z-40 pointer-events-none"
                    >
                        <div className="px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center gap-2">
                            {isMuted ? <AlertCircle className="h-4 w-4 text-red-500" /> : <Play className="h-4 w-4 text-green-500" />}
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                {isMuted ? "Muted" : "Audio On"}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Custom Play Overlay for Premium Feel */}
            {!isLoading && !hasError && hideControls && (
                <div 
                    className={cn(
                        "absolute inset-0 z-10 flex items-center justify-center transition-all duration-500",
                        !isPaused ? "bg-transparent opacity-0 pointer-events-none" : "bg-black/20 opacity-100"
                    )}
                >
                    <AnimatePresence>
                        {isPaused && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playerRef.current?.play();
                                }}
                                className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                            >
                                <Play fill="white" size={24} className="ml-1" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Minimal Progress Bar */}
            {hideControls && !isLoading && !hasError && (
                <div className="absolute bottom-0 left-0 right-0 h-1 z-30 bg-white/5 overflow-hidden">
                    <motion.div 
                        className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                        transition={{ type: "spring", bounce: 0, duration: 0.1 }}
                    />
                </div>
            )}
            
            {!isLoading && !hasError && (
                <div className="absolute inset-0 z-5 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            )}
        </div>
    );
});

VideoPlayer.displayName = "VideoPlayer";

export { VideoPlayer };
export default VideoPlayer;
