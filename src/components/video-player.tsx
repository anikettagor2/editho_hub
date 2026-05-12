"use client";

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Play, Pause, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

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
    envKey?: string; // Mux Data env key
    tokens?: {
        playback?: string;
        thumbnail?: string;
        storyboard?: string;
    };
    preferPlayback?: "mse" | "native";
    forwardSeekOffset?: number;
    backwardSeekOffset?: number;
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
        envKey,
        tokens,
        preferPlayback,
        forwardSeekOffset,
        backwardSeekOffset,
        metadata,
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

    // Expose the underlying player element via ref
    useImperativeHandle(ref, () => playerRef.current);

    // Prioritize Mux Playback ID
    const isMux = !!playbackId || (videoPath?.startsWith("mux://"));
    const effectivePlaybackId = playbackId || (videoPath?.startsWith("mux://") ? videoPath.replace("mux://", "") : null);

    useEffect(() => {
        setHasError(false);
        setIsLoading(true);
    }, [effectivePlaybackId, videoPath]);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
        setIsLoading(true);
    };

    if (!isMux && !videoPath) {
        return (
            <div className={cn("group relative w-full aspect-video bg-black/90 rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-white/5 shadow-2xl", className)}>
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
            <div className={cn("group relative w-full aspect-video bg-black/95 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-4 border border-white/5 shadow-2xl", className)}>
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-sm font-black text-white uppercase tracking-[0.2em] animate-pulse">Processing Video</p>
                    <p className="text-[10px] text-white/40 mt-2 font-medium">Generating ultra-high quality renditions...</p>
                </div>
                <div className="absolute bottom-6 left-6 right-6 h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "group relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 transition-all duration-500",
            hasError ? "border-destructive/30" : "hover:border-primary/30",
            className
        )}>
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
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            onTimeUpdate?.(target.currentTime, target.duration);
                        }}
                        onLoadedMetadata={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setIsLoading(false);
                            onLoadedMetadata?.(target.duration);
                        }}
                        onPlay={() => {
                            setIsLoading(false);
                            onPlaying?.();
                        }}
                        onPause={onPause}
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
                        controls
                        className="w-full h-full object-contain"
                        poster={thumbnailUrl}
                        autoPlay={autoPlay}
                        muted={muted}
                        loop={loop}
                        onTimeUpdate={(e) => {
                            const target = e.target as HTMLVideoElement;
                            onTimeUpdate?.(target.currentTime, target.duration);
                        }}
                        onLoadedMetadata={(e) => {
                            const target = e.target as HTMLVideoElement;
                            setIsLoading(false);
                            onLoadedMetadata?.(target.duration);
                        }}
                        onPlay={() => {
                            setIsLoading(false);
                            onPlaying?.();
                        }}
                        onPause={onPause}
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

            
            {/* Custom Play Overlay for Premium Feel */}
            {!isLoading && !hasError && (
                <div className="absolute inset-0 z-5 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            )}
        </div>
    );
});

VideoPlayer.displayName = "VideoPlayer";

export { VideoPlayer };
export default VideoPlayer;
