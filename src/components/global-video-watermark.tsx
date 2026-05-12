"use client";

import { useEffect } from "react";

type WatermarkState = {
  wrapper: HTMLElement;
  overlay: HTMLDivElement;
  fullscreenOverlay: HTMLDivElement;
  isSwitchingToWrapperFullscreen: boolean;
  onFullscreenChange: () => void;
};

const DEFAULT_COMPANY_NAME = "EditoHub";

function sanitizeWatermarkText(value?: string | null) {
  if (!value) return "";
  return value.trim().slice(0, 48);
}

function resolveWatermarkText(video: HTMLVideoElement) {
  // Helper to find closest across shadow boundaries
  const getClosest = (el: HTMLElement | null, selector: string) => {
    while (el) {
      const found = el.closest(selector);
      if (found) return found;
      const root = el.getRootNode();
      if (root instanceof ShadowRoot) {
        el = root.host as HTMLElement;
      } else {
        break;
      }
    }
    return null;
  };

  // 1. Body-level override (set imperatively by the review page once project loads)
  const fromBody = sanitizeWatermarkText(document.body.dataset.watermarkName || document.body.dataset.clientName);
  if (fromBody) return fromBody;

  // 2. Closest ancestor with data-watermark-name (wrapper div)
  const container = getClosest(video, "[data-watermark-name], [data-client-name]");
  const fromContainer = sanitizeWatermarkText(
    container?.getAttribute("data-watermark-name") ||
    container?.getAttribute("data-client-name")
  );
  if (fromContainer && fromContainer !== "Client Review") return fromContainer;

  // 3. Attribute directly on the <video> element
  const fromVideo = sanitizeWatermarkText(
    video.getAttribute("data-watermark-name") || 
    video.dataset.watermarkName ||
    video.getAttribute("data-client-name") ||
    video.dataset.clientName
  );
  if (fromVideo && fromVideo !== "Client Review") return fromVideo;

  // 4. Environment variable fallback
  const fromEnv = sanitizeWatermarkText(process.env.NEXT_PUBLIC_COMPANY_NAME);
  if (fromEnv) return fromEnv;

  return DEFAULT_COMPANY_NAME;
}

function createWatermarkNode(text: string, isFullscreen: boolean) {
  const container = document.createElement("div");
  container.style.position = isFullscreen ? "fixed" : "absolute";
  container.style.inset = "0";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.pointerEvents = "none";
  container.style.userSelect = "none";
  container.style.overflow = "hidden";
  container.style.zIndex = isFullscreen ? "2147483646" : "20";
  container.style.opacity = isFullscreen ? "0" : "1"; // Will be toggled on fullscreen

  // 1. Grid Background
  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(3, 1fr)";
  grid.style.gridTemplateRows = "repeat(3, 1fr)";
  grid.style.width = "100%";
  grid.style.height = "100%";
  grid.style.opacity = "0.03";

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.style.display = "flex";
    cell.style.alignItems = "center";
    cell.style.justifyContent = "center";
    cell.style.transform = "rotate(-30deg)";
    
    const span = document.createElement("span");
    span.className = "watermark-text-instance";
    span.textContent = text;
    span.style.color = "#ffffff";
    span.style.fontWeight = "900";
    span.style.textTransform = "uppercase";
    span.style.letterSpacing = "0.3em";
    span.style.whiteSpace = "nowrap";
    span.style.fontSize = "clamp(12px, 1.5vw, 24px)";
    
    cell.appendChild(span);
    grid.appendChild(cell);
  }
  container.appendChild(grid);

  // 2. Centered Main Watermark
  const center = document.createElement("div");
  center.style.position = "absolute";
  center.style.opacity = "0.08";
  
  const mainSpan = document.createElement("span");
  mainSpan.className = "watermark-text-instance";
  mainSpan.textContent = text;
  mainSpan.style.color = "#ffffff";
  mainSpan.style.fontWeight = "900";
  mainSpan.style.textTransform = "uppercase";
  mainSpan.style.letterSpacing = "0.2em";
  mainSpan.style.fontSize = "clamp(24px, 5vw, 72px)";
  mainSpan.style.filter = "drop-shadow(0 0 30px rgba(255,255,255,0.1))";
  
  center.appendChild(mainSpan);
  container.appendChild(center);

  return container;
}


export function GlobalVideoWatermark() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const states = new Map<HTMLVideoElement, WatermarkState>();

    const setupVideo = (video: HTMLVideoElement) => {
      if (states.has(video)) return;

      // If video is in shadow DOM, we append the overlay to the host element
      // to avoid styles being encapsulated and to keep it on top of the player's UI.
      const root = video.getRootNode();
      const wrapper = root instanceof ShadowRoot ? (root.host as HTMLElement) : video.parentElement;
      if (!wrapper) return;

      if (window.getComputedStyle(wrapper).position === "static") {
        wrapper.style.position = "relative";
      }

      const watermarkText = resolveWatermarkText(video);

      const overlay = createWatermarkNode(watermarkText, false);
      wrapper.appendChild(overlay);

      const fullscreenOverlay = createWatermarkNode(watermarkText, true);
      document.body.appendChild(fullscreenOverlay);

      const onFullscreenChange = () => {
        const state = states.get(video);
        if (!state) return;

        const fullscreenElement = document.fullscreenElement as HTMLElement | null;
        const isVideoInFullscreen = !!fullscreenElement && (fullscreenElement === video || fullscreenElement.contains(video));

        if (isVideoInFullscreen) {
          // If browser enters native fullscreen on <video>, switch to wrapper fullscreen
          // so HTML watermark overlays remain visible.
          if (fullscreenElement === video && !state.isSwitchingToWrapperFullscreen) {
            state.isSwitchingToWrapperFullscreen = true;
            document.exitFullscreen()
              .then(() => state.wrapper.requestFullscreen().catch(() => undefined))
              .finally(() => {
                window.setTimeout(() => {
                  const latestState = states.get(video);
                  if (latestState) {
                    latestState.isSwitchingToWrapperFullscreen = false;
                  }
                }, 250);
              });
            return;
          }

          const mountTarget = fullscreenElement === video ? state.wrapper : fullscreenElement;
          if (fullscreenOverlay.parentElement !== mountTarget) {
            mountTarget.appendChild(fullscreenOverlay);
          }

          fullscreenOverlay.style.position = "absolute";
          fullscreenOverlay.style.left = "50%";
          fullscreenOverlay.style.top = "50%";
          fullscreenOverlay.style.transform = "translate(-50%, -50%)";
          fullscreenOverlay.style.display = "block";
          overlay.style.display = "none";
          return;
        }

        if (fullscreenOverlay.parentElement !== document.body) {
          document.body.appendChild(fullscreenOverlay);
        }
        fullscreenOverlay.style.position = "fixed";
        fullscreenOverlay.style.display = "none";
        overlay.style.display = "block";
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);

      states.set(video, {
        wrapper,
        overlay,
        fullscreenOverlay,
        isSwitchingToWrapperFullscreen: false,
        onFullscreenChange,
      });
    };

    const updateVideoWatermarks = () => {
      for (const [video, state] of states.entries()) {
        const newText = resolveWatermarkText(video);
        
        // Update all text instances in normal overlay
        state.overlay.querySelectorAll(".watermark-text-instance").forEach(el => {
          if (el.textContent !== newText) el.textContent = newText;
        });
        
        // Update all text instances in fullscreen overlay
        state.fullscreenOverlay.querySelectorAll(".watermark-text-instance").forEach(el => {
          if (el.textContent !== newText) el.textContent = newText;
        });
      }
    };

    const teardownVideo = (video: HTMLVideoElement) => {
      const state = states.get(video);
      if (!state) return;

      document.removeEventListener("fullscreenchange", state.onFullscreenChange);

      state.overlay.remove();
      state.fullscreenOverlay.remove();
      states.delete(video);
    };

    const scanVideos = () => {
      const videos: HTMLVideoElement[] = Array.from(document.querySelectorAll("video"));
      
      // Support for MuxPlayer and other web components with shadow DOM
      document.querySelectorAll("*").forEach(el => {
        if (el.shadowRoot) {
          const shadowVideo = el.shadowRoot.querySelector("video");
          if (shadowVideo) videos.push(shadowVideo as HTMLVideoElement);
        }
      });

      videos.forEach((video) => setupVideo(video));

      for (const existingVideo of Array.from(states.keys())) {
        // For shadow DOM videos, they might not be "in" document.body directly in terms of .contains()
        // if we check the video element itself. We check if it's still connected.
        if (!existingVideo.isConnected) {
          teardownVideo(existingVideo);
        }
      }
    };

    const observer = new MutationObserver(() => {
      scanVideos();
      updateVideoWatermarks();
    });

    scanVideos();
    // Watch entire document for data-watermark-name changes
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ["data-watermark-name", "data-client-name"]
    });

    // Persistent reactive update: in case of async data like Firebase project loading,
    // we keep checking for a valid watermark name indefinitely but at a lower rate after 10s.
    let ticks = 0;
    const pollInterval = setInterval(() => {
      ticks++;
      updateVideoWatermarks();
      
      // If we haven't found a valid name (still showing EditoHub) keep polling fast-ish (500ms)
      // Otherwise, slow down significantly to 2 seconds after the initial 10s burst.
      if (ticks > 20) {
        clearInterval(pollInterval);
        const slowInterval = setInterval(updateVideoWatermarks, 2000);
        (window as any)._watermarkSlowPoll = slowInterval;
      }
    }, 500);

    return () => {
      observer.disconnect();
      clearInterval(pollInterval);
      if ((window as any)._watermarkSlowPoll) clearInterval((window as any)._watermarkSlowPoll);
      for (const video of Array.from(states.keys())) {
        teardownVideo(video);
      }
    };
  }, []);

  return null;
}
