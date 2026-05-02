import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, updateDoc, FieldValue } from "firebase/firestore";


export interface UploadProgress {
  percent: number;
  transferred: number;
  total: number;
  speedBps?: number;
  eta?: number;
  status: 'initial' | 'uploading' | 'processing' | 'complete' | 'error';
}

export interface UploadOptions {
  projectId: string;
  revisionId?: string;
  type: 'raw' | 'revision' | 'asset' | 'pm_file' | 'document';
  onProgress?: (progress: UploadProgress) => void;
  storagePath?: string; // Custom path for Firebase Storage
  onCancelRef?: (cancel: () => void) => void;
}

export class UploadService {
  /**
   * Main entry point for file uploads.
   * Routes to Mux for videos and Firebase Storage for others.
   */
  static async uploadFileUnified(
    file: File,
    projectIdOrOptions: string | UploadOptions,
    onProgressLegacy?: (progress: number) => void,
    maybeOptions?: Partial<UploadOptions>
  ): Promise<string> {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'qt', 'flv', 'wmv'];
    const isVideo = file.type.startsWith('video/') ||
      videoExtensions.some(ext => file.name.toLowerCase().endsWith('.' + ext));

    let options: UploadOptions;

    if (typeof projectIdOrOptions === 'string') {
      options = {
        projectId: projectIdOrOptions,
        type: maybeOptions?.type || 'asset',
        onProgress: (p) => {
          onProgressLegacy?.(p.percent);
          maybeOptions?.onProgress?.(p);
        },
        ...maybeOptions
      } as UploadOptions;
    } else {
      options = projectIdOrOptions;
    }

    // ROUTING LOGIC (Mux-First):
    // 1. All Videos (Revisions or Raw) -> Mux
    // 2. Non-video assets -> Firebase Storage
    console.log(`[UploadService] Unified Upload Start: ${file.name} (${file.size} bytes), Type: ${options.type}, isVideo: ${isVideo}`);

    if (isVideo) {
      console.log(`[UploadService] Routing ${options.type} video upload to Mux for project ${options.projectId}`);
      return this.uploadToMux(file, options);
    }

    // All other non-video uploads go to Firebase Storage
    console.log(`[UploadService] Routing non-video ${options.type} upload to Firebase Storage for project ${options.projectId}`);
    return this.uploadToFirebase(file, options);
  }

  /**
   * Internal helper to determine if a project should use Mux based on its creation date.
   * Cutoff: 12/04/2026 (April 12, 2026)
   */
  private static async shouldProjectUseMux(projectId: string): Promise<boolean> {
    // 1. If it's a temporary ID from NewProjectPage (starts with req_), it's a new project.
    if (!projectId) return true;
    if (projectId.startsWith('req_')) return true;

    try {
      // 2. Fetch project metadata
      const projectDoc = await getDoc(doc(db, "projects", projectId));
      if (!projectDoc.exists()) {
        console.warn(`[UploadService] Project ${projectId} not found in Firestore. Defaulting to Mux.`);
        return true;
      }

      const projectData = projectDoc.data();
      const rawCreatedAt = projectData.createdAt;
      
      // Robust normalization of createdAt
      let createdAt = 0;
      if (typeof rawCreatedAt === 'number') {
        createdAt = rawCreatedAt;
      } else if (rawCreatedAt && typeof rawCreatedAt.toMillis === 'function') {
        createdAt = rawCreatedAt.toMillis();
      } else if (rawCreatedAt instanceof Date) {
        createdAt = rawCreatedAt.getTime();
      } else if (typeof rawCreatedAt === 'string') {
        createdAt = new Date(rawCreatedAt).getTime();
      }

      // Cutoff is April 12, 2026
      // 12/04/2026 formatted as timestamp: 1775952000000
      const MUX_CUTOFF = 1775952000000; 
      
      // If no date found, it's safer to treat it as a new project (Mux)
      if (!createdAt) {
          console.warn(`[UploadService] Project ${projectId} has no valid createdAt. Defaulting to Mux.`);
          return true;
      }

      const isLegacy = createdAt < MUX_CUTOFF;
      console.log(`[UploadService] Routing Decision:`, {
          projectId,
          createdAt,
          cutoff: MUX_CUTOFF,
          isLegacy,
          action: isLegacy ? 'FIREBASE' : 'MUX'
      });

      return !isLegacy;
    } catch (error) {
      console.error("[UploadService] Error checking project date:", error);
      // Fail safe: use Mux for new uploads if we can't determine the date
      return true;
    }
  }

  static async uploadFile(
    file: File,
    projectIdOrOptions: string | UploadOptions,
    onProgressLegacy?: (progress: number) => void,
    maybeOptions?: Partial<UploadOptions>
  ): Promise<string> {
    return this.uploadFileUnified(file, projectIdOrOptions, onProgressLegacy, maybeOptions);
  }


  /**
   * Upload video to Mux via direct upload
   */
  private static async uploadToMux(file: File, options: UploadOptions): Promise<string> {
    const { projectId, revisionId, type, onProgress, onCancelRef } = options;

    try {
      // 1. Get Direct Upload URL from our backend
      const response = await fetch("/api/mux-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          revisionId,
          type: type || "revision",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get Mux upload URL: ${response.statusText}`);
      }

      const { uploadUrl, uploadId } = await response.json();

      // 2. If it's a revision, update the revision document to "processing" status
      if (type === 'revision' && revisionId) {
          await updateDoc(doc(db, "revisions", revisionId), {
              status: "processing",
              videoUrl: `mux://${uploadId}`,
              muxUploadId: uploadId,
              updatedAt: Date.now()
          });

          // Create a video job record
          await setDoc(doc(db, "video_jobs", uploadId), {
              projectId,
              revisionId,
              status: "uploading",
              type: "revision",
              createdAt: Date.now(),
              updatedAt: Date.now()
          });
      }

      // 3. Perform the actual upload to Mux
      console.log(`[UploadService] Starting Mux upload for ${file.name}`);
      await this.performMuxUpload(
        file,
        uploadUrl,
        uploadId,
        onProgress,
        onCancelRef,
        3600000 // 1 hour timeout for large videos
      );

      // Return a temporary mux-prefixed URL for UI reference
      // The webhook will eventually replace this with the real playbackId
      return `mux://${uploadId}`;
    } catch (error) {
      console.error("[UploadService] Mux upload failed:", error);
      
      // Update job status to error if we have a revisionId or uploadId
      if (revisionId) {
        try {
          await updateDoc(doc(db, "video_jobs", revisionId), {
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
            updatedAt: Date.now()
          });
        } catch (dbErr) {
          console.error("[UploadService] Failed to update job error status:", dbErr);
        }
      }
      
      throw error;
    }
  }

  /**
   * Perform the actual file upload to Mux with progress tracking, timeout handling, and exponential backoff retries.
   */
  private static async performMuxUpload(
    file: File,
    uploadUrl: string,
    uploadId: string,
    onProgress: ((progress: UploadProgress) => void) | undefined,
    onCancelRef: ((cancel: () => void) => void) | undefined,
    timeout: number,
    maxRetries: number = 3
  ): Promise<string> {
    let attempt = 0;
    
    const executeUpload = (): Promise<string> => {
      const startTime = Date.now();
      let lastProgressUpdate = 0;
      const PROGRESS_THROTTLE_MS = 200;
      let timeoutHandle: NodeJS.Timeout | null = null;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        const handleTimeout = () => {
          console.error(`[MuxUpload] [Attempt ${attempt + 1}] Upload timeout after`, timeout, "ms");
          xhr.abort();
          reject(new Error(`Mux upload timeout after ${timeout}ms`));
        };
        
        timeoutHandle = setTimeout(handleTimeout, timeout);

        xhr.open("PUT", uploadUrl, true);
        
        // Mux requires Content-Type for direct PUT uploads
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        
        // DO NOT set "Connection: keep-alive" as it is a forbidden header in browsers 
        // and can cause CORS/Security errors.

        xhr.upload.onprogress = (event) => {
          if (!onProgress || !event.lengthComputable) return;

          const now = Date.now();
          if (now - lastProgressUpdate < PROGRESS_THROTTLE_MS && event.loaded < event.total) {
            return;
          }
          lastProgressUpdate = now;

          const elapsed = (now - startTime) / 1000;
          const bytesSent = event.loaded;
          const bytesTotal = event.total;
          const speedBps = elapsed > 0 ? bytesSent / elapsed : 0;
          const remainingBytes = bytesTotal - bytesSent;
          const eta = speedBps > 0 ? remainingBytes / speedBps : 0;

          onProgress({
            percent: (bytesSent / bytesTotal) * 100,
            transferred: bytesSent,
            total: bytesTotal,
            speedBps,
            eta,
            status: 'uploading'
          });
        };

        xhr.onreadystatechange = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (xhr.readyState === XMLHttpRequest.LOADING) {
            timeoutHandle = setTimeout(handleTimeout, timeout);
          }
        };

        xhr.onload = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);

          if (xhr.status >= 200 && xhr.status < 300) {
            console.log(`[MuxUpload] [Attempt ${attempt + 1}] Upload successful for ${uploadId}`);
            
            if (onProgress) {
              onProgress({
                percent: 100,
                transferred: file.size,
                total: file.size,
                status: 'processing'
              });
            }
            resolve(uploadId);
            return;
          }

          console.error(`[MuxUpload] [Attempt ${attempt + 1}] PUT failed:`, {
            status: xhr.status,
            statusText: xhr.statusText,
            uploadId,
            responseText: xhr.responseText?.slice(0, 500)
          });
          reject(new Error(`Mux upload failed with status ${xhr.status} ${xhr.statusText}`));
        };

        xhr.onerror = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          console.error(`[MuxUpload] [Attempt ${attempt + 1}] Network error during direct upload`, uploadId);
          reject(new Error("Mux upload failed due to a network or CORS error."));
        };

        xhr.onabort = () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          console.log(`[MuxUpload] [Attempt ${attempt + 1}] Upload cancelled:`, uploadId);
          reject(new Error("Upload cancelled"));
        };

        if (onCancelRef) {
          onCancelRef(() => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            console.log(`[MuxUpload] [Attempt ${attempt + 1}] Cancel requested:`, uploadId);
            xhr.abort();
          });
        }

        console.log(`[MuxUpload] [Attempt ${attempt + 1}] Starting PUT upload: ${file.name} (${this.formatBytes(file.size)})`);
        xhr.send(file);
      });
    };

    while (attempt <= maxRetries) {
      try {
        return await executeUpload();
      } catch (error) {
        attempt++;
        if (attempt > maxRetries || (error instanceof Error && error.message === "Upload cancelled")) {
          throw error;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
        console.warn(`[MuxUpload] Upload attempt ${attempt} failed. Retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error("Mux upload failed after maximum retry attempts.");
  }

  /**
   * Upload non-video files to Firebase Storage
   */
  private static async uploadToFirebase(file: File, options: UploadOptions): Promise<string> {
    const { projectId, type, onProgress, storagePath, onCancelRef } = options;

    let finalPath = storagePath;
    if (!finalPath) {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      // Store all raw and asset files under raw_footage/{projectId}/
      if (type === 'raw' || type === 'asset') {
        finalPath = `raw_footage/${projectId}/${fileName}`;
      } else {
        finalPath = `projects/${projectId}/${type}/${fileName}`;
      }
    }

    const storageRef = ref(storage, finalPath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const startTime = Date.now();
    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE_MS = 200; // Throttle progress updates to reduce callback overhead
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (!onProgress) return;
          
          // Throttle progress callbacks to avoid reducing upload speed
          const now = Date.now();
          if (now - lastProgressUpdate < PROGRESS_THROTTLE_MS && snapshot.bytesTransferred < snapshot.totalBytes) {
            return;
          }
          lastProgressUpdate = now;

          const elapsed = (now - startTime) / 1000;
          const speedBps = elapsed > 0 ? snapshot.bytesTransferred / elapsed : 0;
          const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
          const eta = speedBps > 0 ? remainingBytes / speedBps : 0;

          onProgress({
            percent: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            transferred: snapshot.bytesTransferred,
            total: snapshot.totalBytes,
            speedBps,
            eta,
            status: 'uploading'
          });
        },
        (error) => {
          console.error(`[UploadService] Firebase upload error for ${file.name}:`, error);
          reject(error);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Non-video files don't trigger the complex revision/transcoding lifecycle
            // they are just assets. Revisions (videos) now always go through Mux.
            if (onProgress) {
              onProgress({
                percent: 100,
                transferred: file.size,
                total: file.size,
                status: 'complete'
              });
            }
            console.log(`[UploadService] Firebase upload complete: ${file.name} (${this.formatBytes(file.size)})`);
            resolve(downloadUrl);
          } catch (err) {
            console.error(`[UploadService] Error finalizing upload for ${file.name}:`, err);
            reject(err);
          }
        }
      );

      if (onCancelRef) {
        onCancelRef(() => {
          console.log(`[UploadService] Upload cancelled: ${file.name}`);
          uploadTask.cancel();
        });
      }
    });
  }

  /**
   * Formatting helpers
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  static formatSpeed(bps: number): string {
    return `${this.formatBytes(bps)}/s`;
  }

  static formatEta(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "--";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }
}
