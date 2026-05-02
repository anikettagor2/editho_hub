"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export type TranscodeStatus = "pending" | "processing" | "ready" | "error" | null;

interface TranscodeState {
  status: TranscodeStatus;
  videoUrl: string | null;
  storagePath: string | null;
  errorMessage: string | null;
}

/**
 * Derives a deterministic videoId from a Firebase Storage path.
 * The Cloud Function uses the filename without extension as the videoId.
 * Storage paths look like: raw_footage/{uid}/{timestamp}_{filename}.mov
 */
function deriveVideoId(storagePath: string): string | null {
  if (!storagePath) return null;
  // Extract filename from path
  const lastSlash = storagePath.lastIndexOf("/");
  const filename = lastSlash >= 0 ? storagePath.substring(lastSlash + 1) : storagePath;
  // Remove extension
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  return filename.substring(0, dotIndex);
}

/**
 * Check if a file is a .mov file (the type that triggers transcoding)
 */
function isMovFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".mov");
}

/**
 * Hook to monitor the transcoding status of a single video file.
 * 
 * @param storagePath - The Firebase Storage path of the uploaded file
 * @param fileName - The original filename (used to check if it's a .mov file)
 * @returns TranscodeState with status, optimized videoUrl, etc.
 */
export function useVideoTranscodeStatus(
  storagePath: string | undefined | null,
  fileName: string
): TranscodeState {
  const [state, setState] = useState<TranscodeState>({
    status: null,
    videoUrl: null,
    storagePath: null,
    errorMessage: null,
  });

  useEffect(() => {
    if (!storagePath) return;

    // Detect if it's a Mux Asset (mux://uploadId)
    const isMux = storagePath.startsWith("mux://");
    
    if (isMux) {
      const uploadId = storagePath.replace("mux://", "");
      
      // Set initial pending state
      setState({
        status: "processing",
        videoUrl: null,
        storagePath: storagePath,
        errorMessage: null,
      });

      // Listen to the video_jobs/{uploadId} document
      const jobDocRef = doc(db, "video_jobs", uploadId);
      const unsubscribe = onSnapshot(
        jobDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setState({
              status: "pending",
              videoUrl: null,
              storagePath: storagePath,
              errorMessage: null,
            });
            return;
          }

          const data = snapshot.data();
          // Mux jobs use 'processing', 'ready', 'complete', 'errored'
          // Map them to TranscodeStatus: 'pending' | 'processing' | 'ready' | 'error'
          let status: TranscodeStatus = "processing";
          if (data.status === "ready" || data.status === "complete") status = "ready";
          if (data.status === "errored" || data.status === "error") status = "error";
          if (data.status === "uploading") status = "processing";

          setState({
            status,
            videoUrl: data.playbackId || null, // For Mux, we store playbackId
            storagePath: storagePath,
            errorMessage: data.error || null,
          });
        },
        (error) => {
          console.error("[useMuxStatus] Listener error:", error);
          setState({ status: "error", videoUrl: null, storagePath, errorMessage: "Failed to load status" });
        }
      );

      return () => unsubscribe();
    }

    // LEGACY: Only monitor .mov files - other formats play natively
    if (!isMovFile(fileName)) {
      return;
    }

    const videoId = deriveVideoId(storagePath);
    if (!videoId) {
      return;
    }

    // Set initial pending state
    setState({
      status: "pending",
      videoUrl: null,
      storagePath: storagePath,
      errorMessage: null,
    });

    // Listen to the videos/{videoId} document for real-time status updates
    const videoDocRef = doc(db, "videos", videoId);
    const unsubscribe = onSnapshot(
      videoDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Document doesn't exist yet - the Cloud Function hasn't started processing
          setState({
            status: "pending",
            videoUrl: null,
            storagePath: storagePath,
            errorMessage: null,
          });
          return;
        }

        const data = snapshot.data();
        setState({
          status: data.status as TranscodeStatus || "processing",
          videoUrl: data.videoUrl || null,
          storagePath: data.storagePath || null,
          errorMessage: data.errorMessage || null,
        });
      },
      (error) => {
        console.error("[useVideoTranscodeStatus] Listener error:", error);
        // Don't block the UI - just fall back to original URL
        setState({
          status: null,
          videoUrl: null,
          storagePath: null,
          errorMessage: null,
        });
      }
    );

    return () => unsubscribe();
  }, [storagePath, fileName]);

  return state;
}

/**
 * Batch hook to monitor transcoding status for multiple files.
 * Returns a map of storagePath -> TranscodeState.
 * 
 * @param files - Array of { storagePath, name } objects to monitor
 */
export function useVideoTranscodeStatuses(
  files: Array<{ storagePath?: string; name: string }>
): Map<string, TranscodeState> {
  const [states, setStates] = useState<Map<string, TranscodeState>>(new Map());

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    for (const file of files) {
      if (!file.storagePath) continue;

      const isMux = file.storagePath.startsWith("mux://");

      if (isMux) {
        const uploadId = file.storagePath.replace("mux://", "");
        const jobDocRef = doc(db, "video_jobs", uploadId);
        
        const unsub = onSnapshot(
          jobDocRef,
          (snapshot) => {
            setStates((prev) => {
              const next = new Map(prev);
              if (!snapshot.exists()) {
                next.set(file.storagePath!, {
                  status: "pending",
                  videoUrl: null,
                  storagePath: file.storagePath!,
                  errorMessage: null,
                });
              } else {
                const data = snapshot.data();
                let status: TranscodeStatus = "processing";
                if (data.status === "ready" || data.status === "complete") status = "ready";
                if (data.status === "errored" || data.status === "error") status = "error";
                if (data.status === "uploading") status = "processing";

                next.set(file.storagePath!, {
                  status,
                  videoUrl: data.playbackId || null,
                  storagePath: file.storagePath!,
                  errorMessage: data.error || null,
                });
              }
              return next;
            });
          }
        );
        unsubscribers.push(unsub);
      } else if (isMovFile(file.name)) {
        const videoId = deriveVideoId(file.storagePath);
        if (!videoId) continue;

        const videoDocRef = doc(db, "videos", videoId);
        const unsub = onSnapshot(
          videoDocRef,
          (snapshot) => {
            setStates((prev) => {
              const next = new Map(prev);
              if (!snapshot.exists()) {
                next.set(file.storagePath!, {
                  status: "pending",
                  videoUrl: null,
                  storagePath: file.storagePath!,
                  errorMessage: null,
                });
              } else {
                const data = snapshot.data();
                next.set(file.storagePath!, {
                  status: data.status as TranscodeStatus || "processing",
                  videoUrl: data.videoUrl || null,
                  storagePath: data.storagePath || null,
                  errorMessage: data.errorMessage || null,
                });
              }
              return next;
            });
          },
          (error) => {
            console.error("[useVideoTranscodeStatuses] Listener error:", error);
          }
        );
        unsubscribers.push(unsub);
      }

      // Set initial pending state
      setStates((prev) => {
        const next = new Map(prev);
        next.set(file.storagePath!, {
          status: "pending",
          videoUrl: null,
          storagePath: file.storagePath!,
          errorMessage: null,
        });
        return next;
      });
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [files.map(f => f.storagePath).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return states;
}
