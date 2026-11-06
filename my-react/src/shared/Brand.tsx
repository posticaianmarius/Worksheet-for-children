import { BookOpen } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <BookOpen size={22} />
      </span>
      <span className="brand-name">
        PlaySheets<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
