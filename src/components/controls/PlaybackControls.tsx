/**
 * Playback controls — play/pause button, time display, and seekable timeline.
 *
 * Performance note: The current time display and slider position are updated
 * via direct DOM manipulation (refs) rather than React state to avoid
 * triggering re-renders at 60fps during playback.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import { usePlaybackStore } from "../../stores/playbackStore";

/** Formats seconds into MM:SS display string */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function PlaybackControls() {
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  const duration = usePlaybackStore((s) => s.duration);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const seek = usePlaybackStore((s) => s.seek);

  // Generate evenly-spaced time markers, clamped to duration
  const markers = useMemo(() => {
    if (duration <= 0) return [];
    const interval = duration > 120 ? 30 : 15;
    const result: number[] = [];
    for (let t = 0; t < duration; t += interval) {
      result.push(t);
    }
    return result;
  }, [duration]);

  // Bind spacebar to play/pause globally, prevent default scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        usePlaybackStore.getState().togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Subscribe to store changes and update DOM directly (no re-renders)
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state) => {
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent =
          `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
      }
      if (sliderRef.current && !isDragging.current) {
        sliderRef.current.value = String(state.currentTime);
      }
    });
    return unsub;
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      if (isDragging.current) {
        // Visual-only update during drag — actual seek happens on mouse/touch end
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent =
            `${formatTime(value)} / ${formatTime(usePlaybackStore.getState().duration)}`;
        }
      } else {
        // Keyboard or accessibility-driven change — seek immediately
        seek(value);
      }
    },
    [seek]
  );

  const handleSliderHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = sliderContainerRef.current;
      const tooltip = tooltipRef.current;
      if (!container || !tooltip) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const time = ratio * (duration || 100);
      tooltip.textContent = formatTime(time);
      tooltip.style.left = `${ratio * 100}%`;
      tooltip.style.opacity = "1";
    },
    [duration]
  );

  const handleSliderHoverEnd = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
  }, []);

  const handleSliderStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleSliderEnd = useCallback(
    (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
      isDragging.current = false;
      seek(parseFloat((e.target as HTMLInputElement).value));
    },
    [seek]
  );

  return (
    <div className="flex-shrink-0">
      {/* Play button + time — centered */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white transition-colors flex-shrink-0 cursor-pointer"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="0" width="4" height="14" rx="1" />
              <rect x="9" y="0" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M2 0.5L13 7L2 13.5V0.5Z" />
            </svg>
          )}
        </button>
        <span ref={timeDisplayRef} className="text-sm text-gray-500 font-mono">
          {formatTime(0)} / {formatTime(duration)}
        </span>
      </div>

      {/* Seekable timeline */}
      <div>
        <div className="flex justify-between mb-1">
          {markers.map((t) => (
            <span key={t} className="text-[10px] text-gray-400 font-mono">
              {formatTime(t)}
            </span>
          ))}
        </div>

        <div
          ref={sliderContainerRef}
          className="relative"
          onMouseMove={handleSliderHover}
          onMouseLeave={handleSliderHoverEnd}
        >
          <div
            ref={tooltipRef}
            className="absolute -top-7 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none transition-opacity"
            style={{ opacity: 0 }}
          />
          <input
            ref={sliderRef}
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            defaultValue={0}
            aria-label="Seek timeline"
            onChange={handleSliderChange}
            onMouseDown={handleSliderStart}
            onMouseUp={handleSliderEnd}
            onTouchStart={handleSliderStart}
            onTouchEnd={handleSliderEnd}
            className="w-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
