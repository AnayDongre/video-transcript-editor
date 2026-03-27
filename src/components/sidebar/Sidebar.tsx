/**
 * Left sidebar layout — contains the transcript section and video adjustment sliders.
 * On mobile, this becomes the bottom half of the screen.
 */

import { TranscriptSection } from "./TranscriptSection";
import { VideoAdjustments } from "./VideoAdjustments";

export function Sidebar() {
  return (
    <aside className="w-full md:w-[380px] md:min-w-[320px] border-t md:border-t-0 md:border-r border-gray-200 flex flex-col h-full bg-white">
      <TranscriptSection />
      <VideoAdjustments />
    </aside>
  );
}
