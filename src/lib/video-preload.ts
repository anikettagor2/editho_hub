const MAX_VIDEO_CACHE_SIZE = 40;

const videoElementCache = new Map<string, HTMLVideoElement>();

function canUseVideoPreload() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function trimVideoCache() {
  while (videoElementCache.size > MAX_VIDEO_CACHE_SIZE) {
    const oldestKey = videoElementCache.keys().next().value;
    if (!oldestKey) break;

    const cached = videoElementCache.get(oldestKey);
    if (cached) {
      cached.removeAttribute("src");
      cached.load();
    }

    videoElementCache.delete(oldestKey);
  }
}

export function warmVideoInMemory(url?: string | null): boolean {
  if (!url || !canUseVideoPreload() || url.startsWith('mux://')) return false;
  if (videoElementCache.has(url)) return false;

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  video.load();

  videoElementCache.set(url, video);
  trimVideoCache();
  return true;
}

export function preloadVideosIntoMemory(urls: Array<string | null | undefined>, maxCount = 24): number {
  if (!canUseVideoPreload() || !urls?.length) return 0;

  const uniqueUrls = Array.from(new Set(urls.filter((url): url is string => !!url)));
  let warmed = 0;

  for (const url of uniqueUrls.slice(0, maxCount)) {
    if (warmVideoInMemory(url)) warmed += 1;
  }

  return warmed;
}
