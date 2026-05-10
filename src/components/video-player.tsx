"use client";

import React from "react";
import MuxPlayer from "@mux/mux-player-react";
import { cn } from "@/lib/utils";

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
  watermark?: string; // Client/project name to display as watermark
  primaryColor?: string;
  accentColor?: string;
  metadata?: {
    video_id?: string;
    video_title?: string;
    viewer_user_id?: string;
    [key: string]: any;
  };
}

function VideoPlayer(props: VideoPlayerProps) {
  const {
    videoPath,
    playbackId,
    thumbnailUrl,
    title,
    className,
    watermark,
    primaryColor,
    accentColor,
    metadata,
    onTimeUpdate,
    onPlaying,
    onPause,
    onError,
    onLoadedMetadata,
  } = props;

  // Prioritize Mux Playback ID
  const isMux = !!playbackId || (videoPath?.startsWith("mux://"));
  const effectivePlaybackId = playbackId || (videoPath?.startsWith("mux://") ? videoPath.replace("mux://", "") : null);

  if (!isMux && !videoPath) {
    return (
      <div className={cn("group relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">No video available</div>
      </div>
    );
  }

  // If it's a mux:// URL, we might still be waiting for the playback ID from the webhook.
  // In that case, effectivePlaybackId is actually the uploadId.
  // MuxPlayer needs a playbackId. If we only have uploadId, we show a processing state.
  const isActuallyReady = !!playbackId || (isMux && !videoPath?.startsWith("mux://"));
  
  if (isMux && videoPath?.startsWith("mux://") && !playbackId) {
    return (
        <div className={cn("group relative w-full aspect-video bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center gap-3", className)}>
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <div className="text-center">
                <p className="text-sm font-bold text-white uppercase tracking-widest">Optimizing Video</p>
                <p className="text-[10px] text-white/50 mt-1">Mux is preparing your high-quality stream...</p>
            </div>
        </div>
    );
  }

  return (
    <div className={cn("group relative w-full aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-2xl", className)}>
      {isMux ? (
        <MuxPlayer
          playbackId={effectivePlaybackId!}
          metadata={{
            video_id: metadata?.video_id || playbackId,
            video_title: metadata?.video_title || title || "Project Video",
            viewer_user_id: metadata?.viewer_user_id,
            ...metadata
          }}
          className="w-full h-full"
          streamType="on-demand"
          placeholder={thumbnailUrl}
          accentColor={accentColor || "#3b82f6"}
          primaryColor={primaryColor || "#3b82f6"}
          title={title}
          onTimeUpdate={(e) => {
            const target = e.target as HTMLVideoElement;
            onTimeUpdate?.(target.currentTime, target.duration);
          }}
          onLoadedMetadata={(e) => {
            const target = e.target as HTMLVideoElement;
            onLoadedMetadata?.(target.duration);
          }}
          onPlay={onPlaying}
          onPause={onPause}
          onError={() => onError?.(new Error("Mux Player Error"))}
        />
      ) : (
        // Fallback for legacy videos (Firebase Storage URLs)
        <video
          src={videoPath}
          controls
          className="w-full h-full"
          poster={thumbnailUrl}
          onTimeUpdate={(e) => {
            const target = e.target as HTMLVideoElement;
            onTimeUpdate?.(target.currentTime, target.duration);
          }}
          onLoadedMetadata={(e) => {
            const target = e.target as HTMLVideoElement;
            onLoadedMetadata?.(target.duration);
          }}
          onPlay={onPlaying}
          onPause={onPause}
          onError={() => onError?.(new Error("Video Fallback Error"))}
        />
      )}

      {/* Premium Watermark Overlay - Center (Visible in fullscreen) */}
      {watermark && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center space-y-2 opacity-20 hover:opacity-30 transition-opacity">
            <span className="text-4xl md:text-6xl font-black text-white/40 uppercase tracking-[0.2em] drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              {watermark}
            </span>
          </div>
        </div>
      )}
      
      {/* Processing State for Mux */}
      {isMux && !playbackId && videoPath?.startsWith("mux://") && (
        <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
                </div>
            </div>
            <div className="text-center">
                <p className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">Processing High-Quality Stream</p>
                <p className="text-[10px] text-white/50 mt-1 uppercase tracking-wider font-medium">Adaptive Bitrate & HDR Optimization in progress</p>
            </div>
        </div>
      )}
    </div>
  );
}

export { VideoPlayer };
