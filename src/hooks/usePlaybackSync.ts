/**
 * Synchronizes video playback with the transcript via requestAnimationFrame.
 *
 * The RAF loop only runs when the video is playing and the tab is visible.
 * Uses the precomputed TranscriptIndex for O(log n) word lookup on a clean
 * word-only array (no spacing entries to skip). Auto-skip uses the index's
 * findNextUnskipped for reliable skip-region traversal.
 */

import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { useTranscriptStore } from "../stores/transcriptStore";

export function usePlaybackSync() {
  const rafRef = useRef<number>(0);
  const lastWordIndexRef = useRef(-1);
  const didSkipRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const { videoElement, isPlaying } = usePlaybackStore.getState();

      if (videoElement && isPlaying) {
        if (videoElement.seeking) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const time = videoElement.currentTime;
        usePlaybackStore.setState({ currentTime: time });

        const { words, skippedIndices, index } = useTranscriptStore.getState();
        if (!index) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        // Use precomputed word-only index — clean binary search, no spacing ambiguity
        const activeEntry = index.findActiveWord(time);
        const wordIndex = activeEntry ? activeEntry.originalIndex : -1;

        if (wordIndex >= 0 && skippedIndices.has(wordIndex)) {
          if (!didSkipRef.current) {
            didSkipRef.current = true;

            const nextIndex = index.findNextUnskipped(wordIndex, skippedIndices, words);

            if (nextIndex >= 0) {
              videoElement.currentTime = words[nextIndex].start;
              lastWordIndexRef.current = nextIndex;
              useTranscriptStore.setState({ activeWordIndex: nextIndex });
            } else {
              videoElement.pause();
            }
          }
        } else {
          didSkipRef.current = false;

          if (wordIndex !== lastWordIndexRef.current) {
            lastWordIndexRef.current = wordIndex;
            useTranscriptStore.setState({ activeWordIndex: wordIndex });
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    let running = false;

    const start = () => {
      if (running) return;
      running = true;
      rafRef.current = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafRef.current);
    };

    // Sync active word on seek while paused
    const syncActiveWord = (time: number) => {
      const { index } = useTranscriptStore.getState();
      if (!index) return;
      const entry = index.findActiveWord(time);
      const wordIndex = entry ? entry.originalIndex : -1;
      if (wordIndex !== lastWordIndexRef.current) {
        lastWordIndexRef.current = wordIndex;
        useTranscriptStore.setState({ activeWordIndex: wordIndex });
      }
    };

    const unsub = usePlaybackStore.subscribe((state, prevState) => {
      if (state.isPlaying !== prevState.isPlaying) {
        if (state.isPlaying && !document.hidden) start();
        else stop();
      }
      if (!state.isPlaying && state.currentTime !== prevState.currentTime) {
        syncActiveWord(state.currentTime);
      }
    });

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else if (usePlaybackStore.getState().isPlaying) {
        start();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (usePlaybackStore.getState().isPlaying && !document.hidden) {
      start();
    }

    return () => {
      stop();
      unsub();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
