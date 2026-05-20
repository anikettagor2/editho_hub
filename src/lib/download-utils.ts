import { localFileManager } from "./local-file-manager";
import { toast } from "sonner";

/**
 * Triggers a file download using a hidden anchor tag.
 * 
 * Logic flow:
 * 1. Check if input is a local File ID (revisionId) in memory.
 * 2. If not, treat as a URL.
 * 3. Fetch remote URL as blob (to ensure browser download dialog and correct filename).
 * 4. Fallback to direct link if fetch fails.
 */
export async function handleFileDownload(urlOrId: string, filename: string = "video.mp4") {
    console.log(`[DownloadUtils] handleFileDownload called with urlOrId: ${urlOrId}, filename: ${filename}`);
    const downloadToastId = toast.loading(`Preparing download: ${filename}...`);
    
    try {
        // 1. Check if it's a Local File ID (e.g. revisionId)
        const localFile = localFileManager.getFile(urlOrId);
        
        if (localFile) {
            console.log(`[DownloadUtils] Starting Local Buffer Download: ${localFile.name}`);
            const blobUrl = URL.createObjectURL(localFile);
            triggerDownload(blobUrl, localFile.name || filename);
            
            // Cleanup
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            toast.success("Download started (from memory)", { id: downloadToastId });
            return;
        }

        // 2. If it's already a blob/data URL, allow it
        if (urlOrId.startsWith('blob:') || urlOrId.startsWith('data:')) {
            console.log(`[DownloadUtils] Triggering direct blob/data URL download`);
            triggerDownload(urlOrId, filename);
            toast.success("Download started", { id: downloadToastId });
            return;
        }

        // 3. For remote URLs, fetch as blob using a progress-tracked reader.
        // This ensures the browser triggers a direct local save dialog (does not redirect or play in a new tab)
        // while showing real-time progressive percentage updates so the user is never left waiting in the dark.
        if (urlOrId.startsWith("http://") || urlOrId.startsWith("https://")) {
            try {
                console.log(`[DownloadUtils] Remote URL detected, starting progress-tracked fetch...`);
                toast.loading(`Downloading ${filename}: 0%`, { id: downloadToastId });
                
                const response = await fetch(urlOrId);
                if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
                
                const contentLength = response.headers.get('content-length');
                const total = contentLength ? parseInt(contentLength, 10) : 0;
                
                let blob: Blob;
                
                if (total === 0 || isNaN(total) || !response.body) {
                    // Fallback to standard fetch if no content-length or body stream
                    blob = await response.blob();
                } else {
                    const reader = response.body.getReader();
                    let loaded = 0;
                    const chunks: BlobPart[] = [];
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value) {
                            chunks.push(value);
                            loaded += value.length;
                            const percent = Math.round((loaded / total) * 100);
                            toast.loading(`Downloading ${filename}: ${percent}%`, { id: downloadToastId });
                        }
                    }
                    blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
                }
                
                const blobUrl = URL.createObjectURL(blob);
                triggerDownload(blobUrl, filename);
                
                // Cleanup
                setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
                toast.success("Download completed!", { id: downloadToastId });
                return;
            } catch (fetchError) {
                console.error("[DownloadUtils] Fetch failed, falling back to direct navigation:", fetchError);
                // Fallback to direct navigation if CORS blocks the fetch or it fails
                triggerDirectNavigation(urlOrId, filename);
                toast.success("Download started (direct link)", { id: downloadToastId });
                return;
            }
        }

        console.log(`[DownloadUtils] Unrecognized url format, attempting direct navigation anyway: ${urlOrId}`);
        triggerDirectNavigation(urlOrId, filename);
        toast.success("Download initiated", { id: downloadToastId });
        
    } catch (error) {
        console.error('[DownloadUtils] Download utility error:', error);
        toast.error('Download failed. Please try again.', { id: downloadToastId });
    }
}

function triggerDownload(url: string, filename: string) {
    try {
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // Use a small timeout before removing the link
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 500);
    } catch (e) {
        console.error("[DownloadUtils] Link click failed, falling back to location.assign", e);
        window.location.assign(url);
    }
}

function triggerDirectNavigation(url: string, filename: string) {
    try {
        console.log(`[DownloadUtils] Triggering direct download navigation for ${url}`);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = filename;
        link.target = '_blank'; // Opens in a new tab if cross-origin policy prevents direct saving, rather than replacing the current dashboard page
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 500);
    } catch (e) {
        console.error("[DownloadUtils] Anchor click failed, falling back to window.open", e);
        window.open(url, '_blank');
    }
}
