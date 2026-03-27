/**
 * Mock API layer that simulates network requests for transcript and video data.
 * In production, these would hit real endpoints. The artificial delay
 * demonstrates loading states and async data handling.
 */

import type { Transcript, VideoMetadata } from "../types/transcript";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchTranscript(): Promise<Transcript> {
  await delay(500);

  const response = await fetch("/assets/transcript.json");
  if (!response.ok) {
    throw new Error(`Failed to load transcript: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as Transcript;
}

export async function fetchVideoMetadata(): Promise<VideoMetadata> {
  await delay(300);

  return {
    src: "/assets/video.mp4",
    backgroundSrc: "/assets/background.jpg",
    duration: 200.42,
  };
}
