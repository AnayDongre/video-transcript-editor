/**
 * Preprocesses raw transcript words into a fast lookup index.
 *
 * Problems with raw data:
 * - Words and spacing entries are interleaved (1173 entries for 587 words)
 * - 5 zero-length spacings share start times with the next word
 * - Binary search must skip spacing entries on every tick
 * - Auto-skip must walk entry-by-entry to find the next non-skipped word
 *
 * This utility builds:
 * - A word-only array for O(log n) binary search on 587 entries instead of 1173
 * - A mapping from word-only index back to the original index (for DOM lookups)
 * - A function to find the next non-skipped word given a set of skipped indices
 */

import type { Word } from "../types/transcript";

export interface WordEntry {
  /** Index in the original words array (for DOM data-word-index lookups) */
  originalIndex: number;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** The word text */
  text: string;
}

export interface TranscriptIndex {
  /** Word-only entries sorted by start time */
  wordEntries: WordEntry[];
  /** Find the active word entry for a given time. Returns the WordEntry or null. */
  findActiveWord: (time: number) => WordEntry | null;
  /** Find the next non-skipped original index after the given original index. Returns -1 if none. */
  findNextUnskipped: (originalIndex: number, skippedIndices: Set<number>, allWords: Word[]) => number;
}

/**
 * Build a transcript index from raw words array.
 * Call once when transcript data is loaded.
 */
export function buildTranscriptIndex(words: Word[]): TranscriptIndex {
  // Extract word-only entries
  const wordEntries: WordEntry[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].type === "word") {
      wordEntries.push({
        originalIndex: i,
        start: words[i].start,
        end: words[i].end,
        text: words[i].text,
      });
    }
  }

  // Binary search on the clean word-only array
  function findActiveWord(time: number): WordEntry | null {
    let lo = 0;
    let hi = wordEntries.length - 1;
    let result = -1;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (wordEntries[mid].start <= time) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result >= 0 ? wordEntries[result] : null;
  }

  // Find next non-skipped word after a given original index.
  // Walks the original array to correctly skip spacing entries.
  function findNextUnskipped(
    originalIndex: number,
    skippedIndices: Set<number>,
    allWords: Word[]
  ): number {
    let i = originalIndex + 1;
    while (i < allWords.length) {
      if (allWords[i].type === "word" && !skippedIndices.has(i)) {
        return i;
      }
      i++;
    }
    return -1;
  }

  return { wordEntries, findActiveWord, findNextUnskipped };
}
