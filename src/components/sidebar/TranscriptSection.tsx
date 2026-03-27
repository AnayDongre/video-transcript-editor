/**
 * Interactive transcript display with word-level highlighting and skip/unskip.
 *
 * Key behaviors:
 * - Active word (synced to video playback) is highlighted with indigo background
 * - Selecting text shows a floating "Skip" button; skipped words appear struck-through
 * - Clicking a skipped word shows a floating "Unskip" button
 * - Clicking any non-skipped word seeks the video to that word's timestamp
 * - Auto-scrolls to keep the active word visible during playback
 *
 * Performance:
 * - Active word highlight is managed via direct DOM manipulation (no React re-renders)
 * - Callbacks read from Zustand getState() to keep references stable
 * - For transcripts > 3000 words, react-window virtualizes the list
 * - User scroll override pauses auto-scroll; "Jump to playhead" re-engages
 */

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import { List, useListRef, useDynamicRowHeight } from "react-window";
import { useTranscriptStore } from "../../stores/transcriptStore";
import { usePlaybackStore } from "../../stores/playbackStore";
import { WordSpan } from "./WordSpan";
import type { Word } from "../../types/transcript";

type ActionMode =
  | { type: "skip"; indices: number[]; top: number; left: number }
  | { type: "unskip"; indices: number[]; top: number; left: number }
  | null;

const VIRTUALIZATION_THRESHOLD = 3000;
const WORDS_PER_CHUNK = 30;
const DEFAULT_ROW_HEIGHT = 110;

// CSS classes for active highlight (must match WordSpan's active styling)
const ACTIVE_WORD_CLASS = "bg-indigo-100 text-indigo-900";
const ACTIVE_SPACING_CLASS = "bg-indigo-100";

// --- Virtualized row component (used only for large transcripts) ---

interface ChunkRowProps {
  chunks: { start: number; end: number }[];
  words: Word[];
  onClick: (index: number) => void;
  dynamicRowHeight: ReturnType<typeof useDynamicRowHeight>;
}

function ChunkRow({
  index,
  style,
  chunks,
  words,
  onClick,
  dynamicRowHeight,
}: {
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
  index: number;
  style: CSSProperties;
} & ChunkRowProps): ReactElement {
  const chunk = chunks[index];
  const { start, end } = chunk;
  const rowRef = useRef<HTMLDivElement>(null);
  const skippedIndices = useTranscriptStore((s) => s.skippedIndices);

  useEffect(() => {
    if (rowRef.current) {
      dynamicRowHeight.setRowHeight(index, rowRef.current.getBoundingClientRect().height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={style}>
      <div ref={rowRef} className="px-6 text-[14px] leading-[1.8] text-gray-700">
        {Array.from({ length: end - start }, (_, i) => {
          const wordIndex = start + i;
          const word = words[wordIndex];
          const prevWord = wordIndex > 0 ? words[wordIndex - 1] : null;
          const nextWord = wordIndex < words.length - 1 ? words[wordIndex + 1] : null;
          return (
            <WordSpan
              key={wordIndex}
              text={word.text}
              index={wordIndex}
              isActive={false}
              isSkipped={skippedIndices.has(wordIndex)}
              isWord={word.type === "word"}
              prevSkipped={prevWord ? skippedIndices.has(wordIndex - 1) : false}
              nextSkipped={nextWord ? skippedIndices.has(wordIndex + 1) : false}
              prevActive={false}
              nextActive={false}
              onClick={onClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// --- Main component ---

export function TranscriptSection() {
  const words = useTranscriptStore((s) => s.words);
  const skippedIndices = useTranscriptStore((s) => s.skippedIndices);
  const skipIndices = useTranscriptStore((s) => s.skipIndices);
  const unskipIndices = useTranscriptStore((s) => s.unskipIndices);
  const seek = usePlaybackStore((s) => s.seek);

  const useVirtualization = words.length > VIRTUALIZATION_THRESHOLD;

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<ActionMode>(null);
  const pendingActionRef = useRef<ActionMode>(null);
  const programmaticScrollRef = useRef(false);
  const [userScrolled, setUserScrolled] = useState(false);

  // react-window hooks (only used when virtualized)
  const listRef = useListRef(null);
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: DEFAULT_ROW_HEIGHT });
  const prevChunkRef = useRef(-1);

  // Keep pendingAction ref in sync with state
  useEffect(() => {
    pendingActionRef.current = pendingAction;
  }, [pendingAction]);

  // Chunk words for virtualized mode
  const chunks = useMemo(() => {
    if (!useVirtualization) return [];
    const result: { start: number; end: number }[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
      result.push({ start: i, end: Math.min(i + WORDS_PER_CHUNK, words.length) });
    }
    return result;
  }, [words, useVirtualization]);

  // Helper: get the scroll container element
  const getScrollContainer = useCallback(() => {
    return useVirtualization ? listRef.current?.element : containerRef.current;
  }, [useVirtualization, listRef]);

  // Track when the flat container mounts so the highlight effect can re-run
  const [containerMounted, setContainerMounted] = useState(false);
  const flatContainerRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setContainerMounted(!!node);
  }, []);

  // --- Active word highlight via direct DOM manipulation (zero React re-renders) ---
  useEffect(() => {
    const applyHighlight = (idx: number) => {
      const container = getScrollContainer();
      if (!container || idx < 0) return;
      const { words: w } = useTranscriptStore.getState();

      const el = container.querySelector(`[data-word-index="${idx}"]`);
      if (el && w[idx]?.type === "word") {
        el.classList.add(...ACTIVE_WORD_CLASS.split(" "));
      }
      if (idx > 0 && w[idx - 1]?.type === "spacing") {
        const prev = container.querySelector(`[data-word-index="${idx - 1}"]`);
        prev?.classList.add(...ACTIVE_SPACING_CLASS.split(" "));
      }
      if (idx + 1 < w.length && w[idx + 1]?.type === "spacing") {
        const next = container.querySelector(`[data-word-index="${idx + 1}"]`);
        next?.classList.add(...ACTIVE_SPACING_CLASS.split(" "));
      }
    };

    const removeHighlight = (idx: number) => {
      const container = getScrollContainer();
      if (!container || idx < 0) return;
      const { words: w } = useTranscriptStore.getState();

      const el = container.querySelector(`[data-word-index="${idx}"]`);
      if (el) el.classList.remove(...ACTIVE_WORD_CLASS.split(" "));
      if (idx > 0 && w[idx - 1]?.type === "spacing") {
        const prev = container.querySelector(`[data-word-index="${idx - 1}"]`);
        prev?.classList.remove(...ACTIVE_SPACING_CLASS.split(" "));
      }
      if (idx + 1 < w.length && w[idx + 1]?.type === "spacing") {
        const next = container.querySelector(`[data-word-index="${idx + 1}"]`);
        next?.classList.remove(...ACTIVE_SPACING_CLASS.split(" "));
      }
    };

    // Apply initial highlight
    const initialIdx = useTranscriptStore.getState().activeWordIndex;
    applyHighlight(initialIdx);

    const unsub = useTranscriptStore.subscribe((state, prevState) => {
      if (state.activeWordIndex !== prevState.activeWordIndex) {
        removeHighlight(prevState.activeWordIndex);
        applyHighlight(state.activeWordIndex);
      }
    });

    return () => {
      unsub();
      removeHighlight(useTranscriptStore.getState().activeWordIndex);
    };
  }, [getScrollContainer, containerMounted]);

  // --- Auto-scroll ---
  useEffect(() => {
    // Check if the active word element is visible in the scroll container
    const isActiveWordVisible = (idx: number): boolean => {
      const container = getScrollContainer();
      if (!container || idx < 0) return false;
      const el = container.querySelector(`[data-word-index="${idx}"]`);
      if (!el) return false;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
    };

    const unsub = useTranscriptStore.subscribe((state, prevState) => {
      if (state.activeWordIndex === prevState.activeWordIndex) return;
      if (state.activeWordIndex < 0) return;

      // If user scrolled away but the active word is now visible (user scrolled
      // back), auto-clear the override
      if (userScrolled) {
        if (isActiveWordVisible(state.activeWordIndex)) {
          setUserScrolled(false);
        }
        return;
      }

      if (useVirtualization) {
        const chunkIndex = Math.floor(state.activeWordIndex / WORDS_PER_CHUNK);
        if (chunkIndex === prevChunkRef.current || !listRef.current) return;
        prevChunkRef.current = chunkIndex;
        try {
          programmaticScrollRef.current = true;
          listRef.current.scrollToRow({ index: chunkIndex, align: "smart" });
          requestAnimationFrame(() => { programmaticScrollRef.current = false; });
        } catch {
          programmaticScrollRef.current = false;
        }
      } else {
        const container = containerRef.current;
        if (!container) return;
        const activeEl = container.querySelector(
          `[data-word-index="${state.activeWordIndex}"]`
        );
        if (!activeEl) return;
        const elRect = activeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (
          elRect.top < containerRect.top + 40 ||
          elRect.bottom > containerRect.bottom - 40
        ) {
          programmaticScrollRef.current = true;
          activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => { programmaticScrollRef.current = false; }, 500);
        }
      }
    });
    return unsub;
  }, [useVirtualization, listRef, userScrolled, getScrollContainer]);

  // Detect user-initiated scrolls.
  // Uses a debounced clear of the programmatic flag — smooth scrolls fire
  // many scroll events over ~300ms, so we keep the flag until scrolling settles.
  useEffect(() => {
    const el = getScrollContainer();
    if (!el) return;
    let clearTimer = 0;
    const onScroll = () => {
      if (programmaticScrollRef.current) {
        // Still in a programmatic scroll — debounce the flag clear
        clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
          programmaticScrollRef.current = false;
        }, 150);
        return;
      }
      setUserScrolled(true);
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      clearTimeout(clearTimer);
    };
  }, [getScrollContainer]);

  // Jump to playhead
  const handleJumpToPlayhead = useCallback(() => {
    setUserScrolled(false);
    const idx = useTranscriptStore.getState().activeWordIndex;
    if (idx < 0) return;

    if (useVirtualization && listRef.current) {
      const chunkIndex = Math.floor(idx / WORDS_PER_CHUNK);
      prevChunkRef.current = chunkIndex;
      programmaticScrollRef.current = true;
      try {
        listRef.current.scrollToRow({ index: chunkIndex, align: "center" });
      } catch { /* ignore */ }
      requestAnimationFrame(() => { programmaticScrollRef.current = false; });
    } else if (containerRef.current) {
      const el = containerRef.current.querySelector(`[data-word-index="${idx}"]`);
      if (el) {
        programmaticScrollRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { programmaticScrollRef.current = false; }, 500);
      }
    }
  }, [useVirtualization, listRef]);

  // Stable callback: reads words/skippedIndices from store
  const handleWordClick = useCallback(
    (index: number) => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      const { words: w, skippedIndices: skipped } = useTranscriptStore.getState();
      const word = w[index];
      if (!word) return;

      const scrollEl = getScrollContainer();
      const wrapper = wrapperRef.current;

      if (skipped.has(index)) {
        if (!scrollEl || !wrapper) return;
        const span = scrollEl.querySelector(`[data-word-index="${index}"]`);
        if (span) {
          const rect = span.getBoundingClientRect();
          const wrapperRect = wrapper.getBoundingClientRect();

          const indices: number[] = [index];
          let i = index - 1;
          while (i >= 0 && (skipped.has(i) || w[i]?.type === "spacing")) {
            if (skipped.has(i)) indices.push(i);
            i--;
          }
          i = index + 1;
          while (i < w.length && (skipped.has(i) || w[i]?.type === "spacing")) {
            if (skipped.has(i)) indices.push(i);
            i++;
          }

          setPendingAction({
            type: "unskip",
            indices,
            top: rect.top - wrapperRect.top - 34,
            left: rect.left - wrapperRect.left + rect.width / 2,
          });
        }
        return;
      }

      setPendingAction(null);
      setUserScrolled(false);
      seek(word.start);
    },
    [seek, getScrollContainer]
  );

  // Handle text selection → show floating Skip button
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-action-button]")) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const scrollEl = getScrollContainer();
      const wrapper = wrapperRef.current;
      if (!selection || selection.isCollapsed || !scrollEl || !wrapper) {
        if (pendingActionRef.current?.type === "skip") {
          setPendingAction(null);
        }
        return;
      }

      const { words: w } = useTranscriptStore.getState();
      const allSpans = scrollEl.querySelectorAll("[data-word-index]");
      const indices: number[] = [];

      allSpans.forEach((span) => {
        if (selection.containsNode(span, true)) {
          const idx = parseInt(span.getAttribute("data-word-index") || "-1", 10);
          const word = w[idx];
          if (idx >= 0 && word?.type === "word") {
            indices.push(idx);
          }
        }
      });

      if (indices.length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        setPendingAction({
          type: "skip",
          indices,
          top: rect.top - wrapperRect.top - 34,
          left: rect.left - wrapperRect.left + rect.width / 2,
        });
      } else {
        setPendingAction(null);
      }
    }, 10);
  }, [getScrollContainer]);

  const handleConfirm = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const action = pendingActionRef.current;
      if (!action) return;
      if (action.type === "skip") {
        skipIndices(action.indices);
        window.getSelection()?.removeAllRanges();
      } else {
        unskipIndices(action.indices);
      }
      setPendingAction(null);
    },
    [skipIndices, unskipIndices]
  );

  // Reposition floating button on scroll
  useEffect(() => {
    if (!pendingAction) return;
    const scrollEl = getScrollContainer();
    const wrapper = wrapperRef.current;
    if (!scrollEl || !wrapper) return;

    const targetIndex = pendingAction.indices[0];
    const onScroll = () => {
      const span = scrollEl.querySelector(`[data-word-index="${targetIndex}"]`);
      if (!span) {
        setPendingAction(null);
        return;
      }
      const rect = span.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      setPendingAction((prev) =>
        prev
          ? { ...prev, top: rect.top - wrapperRect.top - 34, left: rect.left - wrapperRect.left + rect.width / 2 }
          : null
      );
    };

    scrollEl.addEventListener("scroll", onScroll);
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [pendingAction, getScrollContainer]);

  // Virtualized row props (stable)
  const rowProps = useMemo<ChunkRowProps>(
    () => ({ chunks, words, onClick: handleWordClick, dynamicRowHeight }),
    [chunks, words, handleWordClick, dynamicRowHeight]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center px-6 py-4 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-800 tracking-wide">Script</h2>
      </div>

      <div ref={wrapperRef} className="flex-1 min-h-0 relative overflow-hidden" onMouseUp={handleMouseUp}>
        {/* Floating action button */}
        {pendingAction && (
          <button
            data-action-button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleConfirm}
            className="absolute z-10 -translate-x-1/2 bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 shadow-md hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            style={{ top: pendingAction.top, left: pendingAction.left }}
          >
            {pendingAction.type === "skip" ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 4h4v16H5z" />
                  <path d="M15 4l7 8-7 8V4z" />
                </svg>
                Skip
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 12h16" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
                Unskip
              </>
            )}
          </button>
        )}

        {/* Jump to playhead — shown when user has scrolled away */}
        {userScrolled && (
          <button
            onClick={handleJumpToPlayhead}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full px-3 py-1.5 text-xs font-medium shadow-lg cursor-pointer transition-colors"
          >
            Jump to playhead
          </button>
        )}

        {useVirtualization ? (
          <List
            listRef={listRef}
            rowComponent={ChunkRow}
            rowProps={rowProps}
            rowCount={chunks.length}
            rowHeight={dynamicRowHeight}
            overscanCount={5}
            className="transcript-text"
            style={{ height: "100%" }}
          />
        ) : (
          <div
            ref={flatContainerRef}
            className="h-full overflow-y-auto px-6 pb-4 text-[14px] leading-[1.8] text-gray-700 transcript-text"
          >
            {words.map((word, index) => {
              const prevWord = index > 0 ? words[index - 1] : null;
              const nextWord = index < words.length - 1 ? words[index + 1] : null;
              return (
                <WordSpan
                  key={index}
                  text={word.text}
                  index={index}
                  isActive={false}
                  isSkipped={skippedIndices.has(index)}
                  isWord={word.type === "word"}
                  prevSkipped={prevWord ? skippedIndices.has(index - 1) : false}
                  nextSkipped={nextWord ? skippedIndices.has(index + 1) : false}
                  prevActive={false}
                  nextActive={false}
                  onClick={handleWordClick}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
