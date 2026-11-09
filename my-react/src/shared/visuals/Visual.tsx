import { visualForEmoji } from "./catalog";

// Uploaded images take precedence. Unrecognised emoji retain their original rendering.
export function EmojiVisual({ emoji }: { emoji: string }) {
  const visual = visualForEmoji(emoji);
  return visual ? (
    <img src={visual.src} alt="" width="32" height="32" />
  ) : (
    <span>{emoji}</span>
  );
}
