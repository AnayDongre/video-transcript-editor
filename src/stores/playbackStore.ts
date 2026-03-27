/**
 * Playback state store — manages video play/pause, current time, and seeking.
 * The video element ref lives here so any component can control playback
 * without prop-drilling.
 */

import { create } from "zustand";

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  videoElement: HTMLVideoElement | null;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVideoElement: (el: HTMLVideoElement) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  videoElement: null,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVideoElement: (el) => set({ videoElement: el }),

  togglePlay: () => {
    const { videoElement, isPlaying } = get();
    if (!videoElement) return;
    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
  },

  seek: (time) => {
    const { videoElement, duration } = get();
    if (!videoElement) return;
    // Clamp to valid range to prevent seeking beyond bounds
    const clamped = Math.max(0, Math.min(time, duration));
    videoElement.currentTime = clamped;
    set({ currentTime: clamped });
  },
}));
