/**
 * Type definitions for the word-level transcript and video metadata.
 * These match the JSON schema provided by the transcription service.
 */

export interface Word {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing";
  logprob?: number;
}

export interface Transcript {
  text: string;
  words: Word[];
}

export interface VideoMetadata {
  src: string;
  backgroundSrc: string;
  duration: number;
}
