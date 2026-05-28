import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, db } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import Uppy from '@uppy/core';
import AwsS3Multipart from '@uppy/aws-s3';

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
   * Client project creation uploads go to Firebase Storage.
   * Editor revisions go to AWS S3 Multipart + Mux.
   */
  static async uploadFileUnified(
    file: File,
    projectIdOrOptions: string | UploadOptions,
    onProgressLegacy?: (progress: number) => void,
    maybeOptions?: Partial<UploadOptions>
  ): Promise<string> {
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

    if (options.type === 'revision') {
      console.log(`[UploadService] Routing ${options.type} upload to AWS S3 Multipart for project ${options.projectId}`);
      return this.uploadToAwsS3Mux(file, options);
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(file.name);
    if (isVideo && (options.type === 'raw' || options.type === 'asset')) {
      console.log(`[UploadService] Routing high-speed parallel video upload (${options.type}) to AWS S3 Multipart for project ${options.projectId}`);
      return this.uploadToAwsS3Mux(file, options);
    }

    console.log(`[UploadService] Routing ${options.type} upload to Firebase Storage for project ${options.projectId}`);
    return this.uploadToFirebase(file, options);
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
   * Upload video revisions directly to Mux
   * @deprecated Use uploadToAwsS3Mux for faster parallel uploads
   */
  private static async uploadToMuxDirect(file: File, options: UploadOptions): Promise<string> {
    const passthrough = JSON.stringify({
      projectId: options.projectId,
      revisionId: options.revisionId,
      type: options.type,
    });

    // 1. Get Direct Upload URL from our API
    const response = await fetch('/api/video/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, passthrough }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get Mux upload URL: ${errorData.details || response.statusText}`);
    }

    const { url, id: uploadId } = await response.json();

    // 2. Perform the upload using XHR to track progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          const percent = (event.loaded / event.total) * 100;
          options.onProgress({
            percent,
            transferred: event.loaded,
            total: event.total,
            status: 'uploading'
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[UploadService] Mux Direct upload complete: ${file.name}`);
          // We return the upload ID prefixed with mux://
          // The webhook will later update the revision with the actual playbackId
          resolve(`mux://${uploadId}`);
        } else {
          reject(new Error(`Mux upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Mux upload network error'));
      xhr.send(file);

      if (options.onCancelRef) {
        options.onCancelRef(() => {
          console.log(`[UploadService] Mux upload cancelled: ${file.name}`);
          xhr.abort();
        });
      }
    });
  }

  /**
   * Upload video revisions to AWS S3 via Uppy Multipart, then ingest to Mux
   * Uses parallel chunk transfers for maximum speed.
   */
  private static async uploadToAwsS3Mux(file: File, options: UploadOptions): Promise<string> {
    console.log(`[UploadService] Initiating Hyper-Threaded Ultra upload for ${file.name} (${this.formatBytes(file.size)})`);
    return new Promise((resolve, reject) => {
      const uppy = new Uppy({
        id: `upload-${Date.now()}`,
        autoProceed: true,
        allowMultipleUploadBatches: false,
        debug: false,
      }).use(AwsS3Multipart, {
        limit: 20, // Optimal concurrency for high-speed parallel streams
        getChunkSize: (file) => 10 * 1024 * 1024, // 10MB chunks to maximize parallel pipe saturation
        shouldUseMultipart: true,
        retryDelays: [0, 1000, 3000, 5000],
        createMultipartUpload: async (f) => {
          const response = await fetch('/api/upload/s3/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'create', filename: f.name, type: f.type }),
          });
          if (!response.ok) throw new Error(`Create multipart failed: ${response.status}`);
          return response.json();
        },
        listParts: async (f, { uploadId, key }) => {
          const response = await fetch('/api/upload/s3/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'listParts', uploadId, key }),
          });
          return response.json();
        },
        abortMultipartUpload: async (f, { uploadId, key }) => {
          await fetch('/api/upload/s3/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'abort', uploadId, key }),
          });
        },
        signPart: async (f, partData) => {
          const { uploadId, key, partNumber } = partData;
          const response = await fetch('/api/upload/s3/multipart', {
            method: 'PUT',
            body: JSON.stringify({ uploadId, key, partNumbers: [partNumber] }),
          });
          const { presignedUrls } = await response.json();
          return { url: presignedUrls[partNumber], headers: {} };
        },
        // @ts-expect-error missing type in Uppy 
        prepareUploadParts: async (f: any, partData: any) => {
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
          if (!response.ok) throw new Error('Failed to sign parts');
          return response.json();
        },
        completeMultipartUpload: async (f, { uploadId, key, parts }) => {
          const response = await fetch('/api/upload/s3/multipart', {
            method: 'POST',
            body: JSON.stringify({ action: 'complete', uploadId, key, parts }),
          });
          const { location, key: s3Key } = await response.json();
          
          if (options.type !== 'revision') {
            console.log(`[UploadService] Client S3 Multipart upload complete, bypassing Mux. URL: ${location}`);
            return { location };
          }
          
          // CRITICAL: Persist the s3Key to Firestore IMMEDIATELY.
          // Don't wait for Mux webhook as the passthrough has a 100-character limit
          // and might fail if filenames are long.
          if (options.revisionId) {
            try {
              const revisionRef = doc(db, "revisions", options.revisionId);
              const jobRef = doc(db, "video_jobs", options.revisionId);
              
              const updateData = { 
                s3Key: s3Key,
                videoUrl: location 
              };

              await Promise.all([
                updateDoc(revisionRef, updateData),
                updateDoc(jobRef, updateData)
              ]);
              
              console.log(`[UploadService] Persisted s3Key and videoUrl to both revision and job docs: ${options.revisionId}`);
            } catch (fsError) {
              console.error("[UploadService] Failed to persist S3 metadata to Firestore:", fsError);
            }
          }

          // Use shorter keys for passthrough to stay under Mux's 100-char limit
          const passthroughData: any = {
            pid: options.projectId,
            rid: options.revisionId,
            t: options.type,
          };
          
          // Only include s3Key if it fits (Mux has a 100-char limit for passthrough)
          // We already persisted it to Firestore, but including it here provides a second path for sync.
          if (s3Key && (JSON.stringify(passthroughData).length + s3Key.length + 10) < 100) {
            passthroughData.s3Key = s3Key;
          }
          
          const passthrough = JSON.stringify(passthroughData);

          const ingestResponse = await fetch('/api/ingest', {
            method: 'POST',
            body: JSON.stringify({ url: location, passthrough }),
          });
          const ingestData = await ingestResponse.json();
          
          if (!ingestResponse.ok) {
            throw new Error(`Ingest failed: ${ingestData.error} - ${ingestData.details}`);
          }
          
          return { location: ingestData.id };
        },
      });

      const startTime = Date.now();
      let lastProgressUpdate = 0;
      const PROGRESS_THROTTLE_MS = 200;

      uppy.on('upload-progress', (f, progress) => {
        if (options.onProgress) {
          const now = Date.now();
          const total = progress.bytesTotal || 0;
          const uploaded = progress.bytesUploaded || 0;

          if (now - lastProgressUpdate < PROGRESS_THROTTLE_MS && uploaded < total) {
            return;
          }
          lastProgressUpdate = now;

          const elapsed = (now - startTime) / 1000;
          const speedBps = elapsed > 0 ? uploaded / elapsed : 0;
          const remainingBytes = total - uploaded;
          const eta = speedBps > 0 ? remainingBytes / speedBps : 0;
          
          options.onProgress({
            percent: total > 0 ? (uploaded / total) * 100 : 0,
            transferred: uploaded,
            total: total,
            speedBps,
            eta,
            status: 'uploading'
          });
        }
      });

      uppy.on('upload-success', (f, response) => {
        if (options.onProgress) {
          options.onProgress({
            percent: 100, transferred: file.size, total: file.size, status: 'complete'
          });
        }
        console.log(`[UploadService] AWS S3 upload complete: ${file.name}`);
        
        const returnedLocation = response.body?.location;
        if (!returnedLocation) {
          console.error('[UploadService] Upload success but location missing in response body');
          reject(new Error('Upload failed: Location missing in response'));
          return;
        }
        
        if (options.type === 'revision') {
          // Save the mux asset id in format mux://assetId so UI understands it
          resolve(`mux://${returnedLocation}`);
        } else {
          // For client assets, return the direct S3 URL
          resolve(returnedLocation);
        }
      });

      uppy.on('upload-error', (f, error) => {
        console.error('[UploadService] Uppy S3 Error:', error);
        reject(error);
      });

      if (options.onCancelRef) {
        options.onCancelRef(() => {
          console.log(`[UploadService] AWS S3 upload cancelled: ${file.name}`);
          uppy.cancelAll();
        });
      }

      uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
      });
    });
  }

  /**
   * Upload files to Firebase Storage
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
