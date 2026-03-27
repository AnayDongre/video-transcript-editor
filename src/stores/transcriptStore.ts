/**
 * Transcript state store — manages the word list, active word tracking,
 * and skip/unskip state. Skipped indices are stored as a Set for O(1) lookups
 * during the high-frequency playback sync loop.
 */

import { create } from "zustand";
import type { Word } from "../types/transcript";
import { buildTranscriptIndex, type TranscriptIndex } from "../utils/transcriptIndex";

interface TranscriptState {
  words: Word[];
  activeWordIndex: number;
  skippedIndices: Set<number>;
  /** Precomputed word-only index for fast binary search and skip lookups */
  index: TranscriptIndex | null;
  setWords: (words: Word[]) => void;
  setActiveWordIndex: (index: number) => void;
  skipIndices: (indices: number[]) => void;
  unskipIndices: (indices: number[]) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  words: [],
  activeWordIndex: -1,
  skippedIndices: new Set(),
  index: null,
  setWords: (words) => set({ words, index: buildTranscriptIndex(words) }),
  setActiveWordIndex: (index) => set({ activeWordIndex: index }),

  skipIndices: (indices) =>
    set((state) => {
      const next = new Set(state.skippedIndices);
      indices.forEach((i) => next.add(i));
      return { skippedIndices: next };
    }),

  unskipIndices: (indices) =>
    set((state) => {
      const next = new Set(state.skippedIndices);
      indices.forEach((i) => next.delete(i));
      return { skippedIndices: next };
    }),
}));
