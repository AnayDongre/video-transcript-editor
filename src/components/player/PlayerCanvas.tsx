/**
 * Self-contained Three.js player component.
 *
 * Renders an orthographic scene with a background image and a video plane.
 * Click anywhere on the canvas to toggle play/pause. When paused, a tinted
 * overlay with a play icon is shown.
 *
 * Designed to be reusable — accepts videoElement and backgroundSrc as props,
 * with no internal data-fetching or side effects.
 */

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { BackgroundPlane } from "./BackgroundPlane";
import { VideoPlane } from "./VideoPlane";
import { usePlaybackStore } from "../../stores/playbackStore";

interface PlayerCanvasProps {
  videoElement: HTMLVideoElement | null;
  backgroundSrc: string;
}

export function PlayerCanvas({ videoElement, backgroundSrc }: PlayerCanvasProps) {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);

  return (
    <div
      className="w-full flex-1 min-h-0 rounded-2xl overflow-hidden relative cursor-pointer"
      onClick={togglePlay}
      role="button"
      aria-label={isPlaying ? "Pause video" : "Play video"}
    >
      <Canvas
        orthographic
        camera={{ zoom: 50, position: [0, 0, 10], near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        resize={{ scroll: false }}
      >
        <Suspense fallback={null}>
          {backgroundSrc && <BackgroundPlane src={backgroundSrc} />}
          {videoElement && <VideoPlane videoElement={videoElement} />}
        </Suspense>
      </Canvas>

      {/* Pause overlay — dark tint + centered play icon */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4f46e5">
              <path d="M6 3L20 12L6 21V3Z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
