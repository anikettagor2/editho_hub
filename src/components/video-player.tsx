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
}

function VideoPlayer(props: VideoPlayerProps) {
  const {
    videoPath,
    playbackId,
    thumbnailUrl,
    title,
    className,
    watermark,
    onTimeUpdate,
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
    <div className={cn("group relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center", className)}>
      {isMux ? (
        <MuxPlayer
          playbackId={effectivePlaybackId!}
          metadata={{
            video_id: playbackId,
            video_title: title || "Project Video",
          }}
          className="w-full h-full"
          streamType="on-demand"
          placeholder={thumbnailUrl}
          primaryColor="#3b82f6"
          onTimeUpdate={(e) => {
            const target = e.target as HTMLVideoElement;
            onTimeUpdate?.(target.currentTime, target.duration);
          }}
          onLoadedMetadata={(e) => {
            const target = e.target as HTMLVideoElement;
            onLoadedMetadata?.(target.duration);
          }}
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
        />
      )}

      {/* Watermark Overlay - Center (Visible in fullscreen) */}
      {watermark && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none" style={{ position: 'absolute' }}>
          <div className="text-center space-y-2 opacity-30 select-none pointer-events-none">
            <span className="text-3xl font-bold text-white/40 uppercase tracking-widest drop-shadow-2xl">
              {watermark}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export { VideoPlayer };
