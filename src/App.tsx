/**
 * Root application component.
 *
 * Orchestrates data loading (transcript + video metadata via mock API),
 * initializes the off-DOM video element, starts the playback sync loop,
 * and renders the two-panel layout (sidebar + player).
 *
 * Responsive: on desktop, sidebar is on the left and player on the right.
 * On mobile (< md), the player stacks on top with the sidebar below.
 */

import { useEffect, useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { PlayerCanvas } from "./components/player/PlayerCanvas";
import { PlaybackControls } from "./components/controls/PlaybackControls";
import { useVideoElement } from "./hooks/useVideoElement";
import { usePlaybackSync } from "./hooks/usePlaybackSync";
import { usePlaybackStore } from "./stores/playbackStore";
import { useTranscriptStore } from "./stores/transcriptStore";
import { fetchTranscript, fetchVideoMetadata } from "./api/mockApi";
import type { VideoMetadata } from "./types/transcript";

function App() {
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setWords = useTranscriptStore((s) => s.setWords);
  const videoElement = usePlaybackStore((s) => s.videoElement);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [transcript, meta] = await Promise.all([
          fetchTranscript(),
          fetchVideoMetadata(),
        ]);
        if (cancelled) return;
        setWords(transcript.words);
        setVideoMeta(meta);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [setWords]);

  useVideoElement(videoMeta?.src || "");
  usePlaybackSync();

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 font-medium">Something went wrong</p>
          <p className="text-xs text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Branding header */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 tracking-tight">Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-1.5 cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md flex items-center gap-1.5 cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-200 cursor-pointer text-xs font-semibold"
            aria-label="Profile"
          >
            A
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <main className="order-1 md:order-2 flex-1 flex flex-col h-1/2 md:h-full min-w-0 p-3 md:p-5 gap-2 md:gap-3">
          <PlayerCanvas
            videoElement={videoElement}
            backgroundSrc={videoMeta?.backgroundSrc || ""}
          />
          <PlaybackControls />
        </main>

        <div className="order-2 md:order-1 h-1/2 md:h-full">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}

export default App;
