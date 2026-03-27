/**
 * Creates an off-DOM HTMLVideoElement for use as a Three.js VideoTexture source.
 *
 * The video is never rendered in the DOM — it exists purely as a data source
 * for WebGL. This avoids double-rendering and gives full control over playback.
 *
 * Starts muted and seeks to frame 0.01 on load to force the browser to decode
 * the first frame, which is required for VideoTexture to have pixel data.
 */

import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";

export function useVideoElement(src: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoElement = usePlaybackStore((s) => s.setVideoElement);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);

  useEffect(() => {
    if (!src) return;

    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true; // Muted so we can force first-frame decode without autoplay restrictions

    video.addEventListener("loadedmetadata", () => {
      setDuration(video.duration);
    });

    // Force decode the first frame so VideoTexture has pixel data immediately
    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.01;
    });

    // Unmute once the first frame is decoded and ready
    video.addEventListener("seeked", function onFirstSeek() {
      video.removeEventListener("seeked", onFirstSeek);
      video.muted = false;
    });

    // Keep Zustand store in sync with native video events
    video.addEventListener("play", () => setIsPlaying(true));
    video.addEventListener("pause", () => setIsPlaying(false));
    video.addEventListener("ended", () => setIsPlaying(false));

    video.addEventListener("error", () => {
      console.error("Video failed to load:", video.error?.message);
    });

    videoRef.current = video;
    setVideoElement(video);

    return () => {
      video.pause();
      video.src = "";
      video.load();
    };
  }, [src, setVideoElement, setDuration, setIsPlaying]);

  return videoRef;
}
