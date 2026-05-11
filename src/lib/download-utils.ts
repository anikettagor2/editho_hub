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
            triggerDownload(urlOrId, filename);
            toast.success("Download started", { id: downloadToastId });
            return;
        }

        // 3. Remote URL fallback
        console.log(`[DownloadUtils] Fetching remote file: ${urlOrId}`);

        // If it's a signed URL (contains X-Goog-Signature), the server has already set response-content-disposition=attachment.
        // We can safely trigger the download directly without loading the entire video into memory as a blob.
        if (urlOrId.includes("X-Goog-Signature") || urlOrId.includes("GoogleAccessId")) {
            triggerDownload(urlOrId, filename);
            toast.success("Download started!", { id: downloadToastId });
            return;
        }

        toast.loading("Fetching file from storage...", { id: downloadToastId });

        try {
            const response = await fetch(urlOrId);
            if (!response.ok) throw new Error("Fetch failed");

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            triggerDownload(blobUrl, filename);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            toast.success("Download started!", { id: downloadToastId });
        } catch (fetchError) {
            console.warn("[DownloadUtils] Fetch failed, attempting direct link download:", fetchError);
            // Last resort: Just try to open the URL directly
            triggerDownload(urlOrId, filename);
            toast.success("Download initiated via direct link", { id: downloadToastId });
        }
        
    } catch (error) {
        console.error('Download utility error:', error);
        toast.error('Download failed. Please try again.', { id: downloadToastId });
    }
}

function triggerDownload(url: string, filename: string) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
