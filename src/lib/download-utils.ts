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

        // For any external remote URL (http/https), use an anchor tag with target="_blank".
        // This avoids memory limits with large files and avoids CORS issues.
        // The URLs returned by the backend already have Content-Disposition: attachment.
        if (urlOrId.startsWith("http://") || urlOrId.startsWith("https://")) {
            console.log(`[DownloadUtils] Remote URL detected, using anchor tag navigation to bypass popup blockers and memory limits`);
            triggerDirectNavigation(urlOrId, filename);
            toast.success("Download started!", { id: downloadToastId });
            return;
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
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 500);
    } catch (e) {
        console.error("[DownloadUtils] Anchor click failed, falling back to location.assign", e);
        window.location.assign(url);
    }
}
