"use client";

/**
 * Dashboard Video Optimizer
 * Provides instant video loading and smooth playback across all dashboards
 * Integrates with existing video infrastructure
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { preloadVideosIntoMemory } from '@/lib/video-preload';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Wifi, WifiOff, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Global session-scoped Blob cache (survives component unmounts, cleared on logout)
// ---------------------------------------------------------------------------
const globalBlobCache = new Map<string, string>();

export function clearVideoBlobCache() {
  globalBlobCache.forEach((url) => URL.revokeObjectURL(url));
  globalBlobCache.clear();
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------
interface DashboardVideoProps {
  src: string;
  hlsUrl?: string;
  thumbnail?: string;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
  showQualityIndicator?: boolean;
  priority?: boolean;
  /** When true, the full MP4 is fetched once and stored as a Blob URL in memory */
  cacheInBrowserMemory?: boolean;
  /** Assign a React.MutableRefObject — calling seekRef.current(seconds) will seek the video */
  seekRef?: React.MutableRefObject<((seconds: number) => void) | null>;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onQualityChange?: (quality: string) => void;
  onNetworkChange?: (quality: 'good' | 'fair' | 'poor') => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DashboardVideo({
  src,
  hlsUrl,
  thumbnail,
  title,
  className = '',
  autoPlay = false,
  muted = false,           // default UN-muted for review context
  showControls = true,
  showQualityIndicator = true,
  priority = false,
  cacheInBrowserMemory = false,
  seekRef,
  onPlay,
  onPause,
  onTimeUpdate,
  onQualityChange,
  onNetworkChange,
}: DashboardVideoProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsRef        = useRef<Hls | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const loadedSrcRef  = useRef<string>('');
  // Tracks mount state — prevents AbortError from async play() after unmount
  const isMountedRef  = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Safe play — silently swallows AbortError caused by unmount / src-change race
  const safePlay = useCallback((el: HTMLVideoElement | null) => {
    if (!el || !isMountedRef.current) return;
    // Only play if the element is still in the document
    if (!el.isConnected) return;
    el.play().catch((err: DOMException) => {
      if (err?.name !== 'AbortError') {
        console.warn('[DashboardVideo] play() failed:', err.message);
      }
    });
  }, []);

  // Expose seek capability to parent via seekRef
  useEffect(() => {
    if (seekRef) {
      seekRef.current = (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }
      };
    }
    return () => {
      if (seekRef) seekRef.current = null;
    };
  }, [seekRef]);

  const [isPlaying,       setIsPlaying]       = useState(false);
  const [isMuted,         setIsMuted]         = useState(muted);
  const [currentTime,     setCurrentTime]     = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [isLoading,       setIsLoading]       = useState(true);
  const [bufferPct,       setBufferPct]       = useState(0);   // 0-100 download progress for blob cache
  const [networkQuality,  setNetworkQuality]  = useState<'good' | 'fair' | 'poor'>('good');
  const [currentQuality,  setCurrentQuality]  = useState<string>('Auto');
  const [showControlsBar, setShowControlsBar] = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [isInView,        setIsInView]        = useState(false);

  // ---------------------------------------------------------------------------
  // Intersection Observer — wire the containerRef directly to the native API
  // (avoids the bug where the hook's internal ref was never attached to anything)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If priority, skip intersection check and load immediately
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // once visible, never need to re-check
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority]);

  // ---------------------------------------------------------------------------
  // Network quality detection
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const connection = (navigator as any)?.connection;
    if (!connection) return;

    const update = () => {
      const t   = connection.effectiveType;
      const dl  = connection.downlink || 0;
      const q: 'good' | 'fair' | 'poor' =
        t === '4g' && dl >= 5 ? 'good' :
        (t === '4g' || (t === '3g' && dl >= 1)) ? 'fair' : 'poor';
      setNetworkQuality(q);
      onNetworkChange?.(q);
    };

    update();
    connection.addEventListener?.('change', update);
    return () => connection.removeEventListener?.('change', update);
  }, [onNetworkChange]);

  // ---------------------------------------------------------------------------
  // Main video initialisation — runs once the element is in the viewport
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isInView) return;
    if (!videoRef.current) return;
    // Don't reinitialise if we already loaded this exact src
    if (loadedSrcRef.current === src) return;

    const videoElement = videoRef.current;
    loadedSrcRef.current = src;

    // Destroy any previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setBufferPct(0);

    // ------------------------------------------------------------------
    // PATH 1 — Blob cache (full file fetch into memory)
    // ------------------------------------------------------------------
    if (cacheInBrowserMemory) {
      if (globalBlobCache.has(src)) {
        // Already cached — assign immediately
        if (videoRef.current) {
          videoRef.current.src = globalBlobCache.get(src)!;
          setIsLoading(false);
          if (autoPlay) safePlay(videoRef.current);
        }
        return;
      }

      // Fetch with streaming progress
      const controller = new AbortController();

      const fetchAndCache = async () => {
        try {
          const response = await fetch(src, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const contentLength = Number(response.headers.get('Content-Length') || 0);
          const reader = response.body?.getReader();
          if (!reader) throw new Error('No readable stream');

          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              setBufferPct(Math.round((received / contentLength) * 100));
            }
          }

          // Try to get the correct MIME type from the response or fallback
          let mimeType = response.headers.get('Content-Type') || 'video/mp4';
          // If the src has a file extension, try to infer type
          if (mimeType === '' || mimeType === 'application/octet-stream') {
            if (src.endsWith('.webm')) mimeType = 'video/webm';
            else if (src.endsWith('.mov')) mimeType = 'video/quicktime';
            else if (src.endsWith('.mkv')) mimeType = 'video/x-matroska';
            else if (src.endsWith('.avi')) mimeType = 'video/x-msvideo';
            else mimeType = 'video/mp4';
          }
          const blob      = new Blob(chunks as unknown as BlobPart[], { type: mimeType });
          const objectUrl = URL.createObjectURL(blob);
          globalBlobCache.set(src, objectUrl);

          if (videoRef.current && isMountedRef.current && loadedSrcRef.current === src) {
            videoRef.current.src = objectUrl;
            setIsLoading(false);
            setBufferPct(100);
            if (autoPlay) safePlay(videoRef.current);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          console.warn('[DashboardVideo] Blob cache fetch failed, falling back to direct src:', err);
          if (videoRef.current && loadedSrcRef.current === src) {
            videoRef.current.src = src;
            setIsLoading(false);
          }
        }
      };

      fetchAndCache();
      return () => controller.abort();
    }

    // ------------------------------------------------------------------
    // PATH 2 — HLS adaptive streaming
    // ------------------------------------------------------------------
    const streamingUrl = hlsUrl || (src.includes('.m3u8') ? src : null);

    if (streamingUrl) {
      if (!Hls.isSupported()) {
        // Safari native HLS
        if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          videoElement.src = streamingUrl;
          videoElement.preload = 'metadata';
          setIsLoading(false);
        } else {
          // Absolute fallback
          videoElement.src = src;
          videoElement.preload = 'metadata';
          setIsLoading(false);
        }
        return;
      }

      const hls = new Hls({
        enableWorker:           true,
        lowLatencyMode:         true,                  // Speed-first: enable low latency
        autoStartLoad:          true,
        startLevel:             0,                     // Start at the absolute bottom (lowest bitrate)
        capLevelToPlayerSize:   true,                  // Prevent over-fetching (auto level capping)
        abrEwmaDefaultEstimate: 500000,                // Force a low-bandwidth estimate to start low instantly
        testBandwidth:          false,                 // Don't waste time testing bandwidth, just start playing
        initialLiveManifestSize: 1,                    // Requested config value
        maxBufferLength:        networkQuality === 'poor' ? 20 : 40,
        maxMaxBufferLength:     networkQuality === 'poor' ? 40 : 120,
        maxBufferSize:          60 * 1024 * 1024,      // 60 MB buffer
        startFragPrefetch:      true,
        progressive:            true,
      });

      hlsRef.current = hls;
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamingUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (autoPlay) safePlay(videoElement);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        const level = hls.levels[data.level];
        if (level) {
          const q = `${level.height}p`;
          setCurrentQuality(q);
          onQualityChange?.(q);
        }
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          console.warn('[DashboardVideo] Fatal HLS error encountered:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Aggressive auto-recovery for network errors: drop to lowest bitrate and restart loading
              console.warn('[DashboardVideo] Network error: recovering at lowest bitrate');
              hls.nextLoadLevel = 0; // Force load at lowest level
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[DashboardVideo] Media error: attempting media recovery');
              hls.recoverMediaError();
              break;
            default:
              console.error('[DashboardVideo] Unrecoverable HLS error. Falling back to direct MP4.', data);
              hls.destroy();
              hlsRef.current = null;
              if (videoRef.current) {
                videoRef.current.src = src;
                videoRef.current.preload = 'metadata';
              }
              setIsLoading(false);
              break;
          }
        } else {
          // Log non-fatal errors but do not interrupt playback
          console.debug('[DashboardVideo] Non-fatal HLS error:', data.details);
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // ------------------------------------------------------------------
    // PATH 3 — Plain MP4 (no HLS)
    // Let the browser handle range requests natively to Firebase CDN.
    // preload='metadata' only fetches the moov atom (~few KB) initially,
    // then the browser pulls video data on-demand as the user plays.
    // ------------------------------------------------------------------
    videoElement.src = src;
    videoElement.preload = 'metadata';
    setIsLoading(false);
    if (autoPlay) safePlay(videoElement);

  }, [isInView, src, hlsUrl, cacheInBrowserMemory, networkQuality, priority, autoPlay, onQualityChange]);

  // ---------------------------------------------------------------------------
  // Reinit when src changes (e.g., switching revision)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Reset the loaded-src tracker whenever src prop changes
    // so the main effect triggers a fresh load
    loadedSrcRef.current = '';
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [src]);

  // ---------------------------------------------------------------------------
  // Video event handlers
  // ---------------------------------------------------------------------------
  const handlePlay           = useCallback(() => { setIsPlaying(true);  onPlay?.();  }, [onPlay]);
  const handlePause          = useCallback(() => { setIsPlaying(false); onPause?.(); }, [onPause]);
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);
  const handleTimeUpdate     = useCallback(() => {
    if (!videoRef.current) return;
    const c = videoRef.current.currentTime;
    const d = videoRef.current.duration;
    setCurrentTime(c);
    setDuration(d);
    onTimeUpdate?.(c, d);
  }, [onTimeUpdate]);
  const handleCanPlay        = useCallback(() => { setIsLoading(false); }, []);

  // ---------------------------------------------------------------------------
  // Control handlers
  // ---------------------------------------------------------------------------
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      safePlay(videoRef.current);
    }
  }, [isPlaying, safePlay]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !duration) return;
    videoRef.current.currentTime = (parseFloat(e.target.value) / 100) * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value) / 100;
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  }, [isFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const fmtTime = (t: number) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className={`relative bg-black overflow-hidden group ${className}`}
      onMouseEnter={() => setShowControlsBar(true)}
      onMouseLeave={() => setShowControlsBar(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        poster={thumbnail}
        muted={isMuted}
        playsInline
        preload="metadata"
        className="w-full h-full object-contain"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onClick={togglePlay}
      />

      {/* Loading / Buffering Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
          {cacheInBrowserMemory && bufferPct > 0 && bufferPct < 100 && (
            <div className="w-48 space-y-1">
              <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${bufferPct}%` }}
                />
              </div>
              <p className="text-[10px] text-white/60 text-center font-mono">
                Caching… {bufferPct}%
              </p>
            </div>
          )}
          {(!cacheInBrowserMemory || bufferPct === 0) && (
            <p className="text-[11px] text-white/50 uppercase tracking-widest">Loading video…</p>
          )}
        </div>
      )}

      {/* Play Button Overlay (when paused and ready) */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all group/play"
          >
            <Play className="w-8 h-8 text-white ml-1 group-hover/play:scale-110 transition-transform" />
          </button>
        </div>
      )}

      {/* Quality / Network indicator (top-right) */}
      {showQualityIndicator && !isLoading && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <div className="bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            {networkQuality === 'good' ? (
              <Wifi className="w-3 h-3 text-green-400" />
            ) : networkQuality === 'fair' ? (
              <Wifi className="w-3 h-3 text-yellow-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-400" />
            )}
            <span>{currentQuality}</span>
          </div>
        </div>
      )}

      {/* Controls bar (bottom) */}
      {showControls && (showControlsBar || !isPlaying) && !isLoading && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
          {/* Seek bar */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={(currentTime / (duration || 1)) * 100}
            onChange={handleSeek}
            className="w-full h-1 mb-3 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
          />

          {/* Buttons row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-white/80 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <button onClick={toggleMute} className="text-white hover:text-white/80 transition-colors">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
              />

              <span className="text-white text-xs font-mono tabular-nums">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {title && <span className="text-white/70 text-xs truncate max-w-28">{title}</span>}
              <button onClick={toggleFullscreen} className="text-white hover:text-white/80 transition-colors">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch preloader hook
// ---------------------------------------------------------------------------
export function useDashboardVideoPreloader(videoUrls: Array<{ src: string; hlsUrl?: string }>) {
  const [preloadedCount, setPreloadedCount] = useState(0);

  useEffect(() => {
    if (!videoUrls.length) return;
    const urls = videoUrls.map(v => v.src).filter(Boolean);
    setPreloadedCount(preloadVideosIntoMemory(urls, 10));
  }, [videoUrls]);

  return { preloadedCount, totalCount: videoUrls.length };
}

// ---------------------------------------------------------------------------
// Video Grid
// ---------------------------------------------------------------------------
interface VideoGridProps {
  videos: Array<{
    id: string;
    src: string;
    hlsUrl?: string;
    thumbnail?: string;
    title?: string;
    duration?: number;
  }>;
  onVideoSelect?: (video: any) => void;
}

export function VideoGrid({ videos, onVideoSelect }: VideoGridProps) {
  const { preloadedCount } = useDashboardVideoPreloader(videos);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <div
          key={video.id}
          className="relative cursor-pointer group"
          onClick={() => onVideoSelect?.(video)}
        >
          <DashboardVideo
            src={video.src}
            hlsUrl={video.hlsUrl}
            thumbnail={video.thumbnail}
            title={video.title}
            className="aspect-video"
            showControls={false}
            priority={preloadedCount < 3}
          />
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}