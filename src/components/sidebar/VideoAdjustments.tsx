/**
 * Slider controls for video padding and border rounding.
 * Values (0-32) are written to the Zustand store and read each frame
 * by the Three.js VideoPlane shader via getState().
 */

import { useVideoControlsStore } from "../../stores/videoControlsStore";

export function VideoAdjustments() {
  const padding = useVideoControlsStore((s) => s.padding);
  const rounding = useVideoControlsStore((s) => s.rounding);
  const setPadding = useVideoControlsStore((s) => s.setPadding);
  const setRounding = useVideoControlsStore((s) => s.setRounding);

  return (
    <div className="flex-shrink-0 px-6 pt-5 pb-6 border-t border-gray-100">
      <div className="mb-5">
        <label className="text-sm font-medium text-gray-800 block mb-3">
          Padding
        </label>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 font-mono w-5 text-right">
            {String(padding).padStart(2, "0")}
          </span>
          <input
            type="range"
            min={0}
            max={32}
            value={padding}
            aria-label="Video padding"
            onChange={(e) => setPadding(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 font-mono w-5">32</span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-800 block mb-3">
          Rounding
        </label>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 font-mono w-5 text-right">
            {String(rounding).padStart(2, "0")}
          </span>
          <input
            type="range"
            min={0}
            max={32}
            value={rounding}
            aria-label="Video border rounding"
            onChange={(e) => setRounding(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 font-mono w-5">32</span>
        </div>
      </div>
    </div>
  );
}
