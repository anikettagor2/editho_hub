"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";
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
  startTime?: number;
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
    watermark,
    primaryColor,
    accentColor,
    startTime,
    metadata,
    onTimeUpdate,
    onPlaying,
    onPause,
    onError,
    onLoadedMetadata,
  } = props;

  const playerRef = useRef<any>(null);

  // Expose the underlying player element via ref
  useImperativeHandle(ref, () => playerRef.current);

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

  // Handling Mux "optimizing" state
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
          ref={playerRef}
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
          startTime={startTime}
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
        <video
          ref={playerRef}
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

      {/* Premium Watermark Overlay */}
      {watermark && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center space-y-2 opacity-20 hover:opacity-30 transition-opacity">
            <span className="text-4xl md:text-6xl font-black text-white/40 uppercase tracking-[0.2em] drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              {watermark}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
export { VideoPlayer };
