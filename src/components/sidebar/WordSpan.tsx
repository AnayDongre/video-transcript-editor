/**
 * A single word or spacing token in the transcript.
 *
 * Memoized to prevent re-renders — only the active word and its neighbors
 * re-render each time the highlight moves. Spacing spans inherit styles
 * from their adjacent words so highlights and strikethroughs appear as
 * continuous blocks rather than per-word fragments.
 */

import { memo } from "react";

interface WordSpanProps {
  text: string;
  index: number;
  isActive: boolean;
  isSkipped: boolean;
  isWord: boolean;
  prevSkipped: boolean;
  nextSkipped: boolean;
  prevActive: boolean;
  nextActive: boolean;
  onClick: (index: number) => void;
}

export const WordSpan = memo(function WordSpan({
  text,
  index,
  isActive,
  isSkipped,
  isWord,
  prevSkipped,
  nextSkipped,
  prevActive,
  nextActive,
  onClick,
}: WordSpanProps) {
  // Spacing spans bridge the style between neighboring words
  if (!isWord) {
    const bothSkipped = prevSkipped && nextSkipped;
    const eitherActive = prevActive || nextActive;

    let className = "";
    if (bothSkipped) {
      className = "line-through text-gray-400 decoration-gray-400 bg-gray-50";
    } else if (eitherActive) {
      className = "bg-indigo-100";
    }

    return (
      <span data-word-index={index} className={className || undefined}>
        {text}
      </span>
    );
  }

  let className = "cursor-pointer inline";

  if (isSkipped) {
    className += " line-through text-gray-400 decoration-gray-400 bg-gray-50";
  } else if (isActive) {
    className += " bg-indigo-100 text-indigo-900";
  }

  return (
    <span
      data-word-index={index}
      className={className}
      onClick={() => onClick(index)}
    >
      {text}
    </span>
  );
});
