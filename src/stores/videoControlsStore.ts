/**
 * Video controls store — manages padding and rounding slider values.
 * These are read every frame by the Three.js VideoPlane shader via
 * getState() (not hooks) to avoid triggering React re-renders.
 */

import { create } from "zustand";

interface VideoControlsState {
  padding: number;
  rounding: number;
  setPadding: (padding: number) => void;
  setRounding: (rounding: number) => void;
}

export const useVideoControlsStore = create<VideoControlsState>((set) => ({
  padding: 0,
  rounding: 0,
  setPadding: (padding) => set({ padding }),
  setRounding: (rounding) => set({ rounding }),
}));
