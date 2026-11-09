import { ArrowUp, CheckCircle2 } from "lucide-react";
import { useRef } from "react";
import { useLanguage } from "../shared/runtime";
import { Button } from "../shared/ui";

/** A dedicated gesture surface keeps swiping separate from scrolling and game dragging. */
export default function ActivityAdvance({
  onAdvance,
  preview = false,
}: {
  onAdvance: () => void;
  preview?: boolean;
}) {
  const { t } = useLanguage();
  const start = useRef<{
    x: number;
    y: number;
    time: number;
    id: number;
  } | null>(null);
  const advancing = useRef(false);
  const suppressClick = useRef(false);
  function advance() {
    if (advancing.current) return;
    advancing.current = true;
    onAdvance();
  }
  return (
    <div className="activity-advance">
      <p role="status">
        <CheckCircle2 size={16} aria-hidden="true" />
        {t(preview ? "studio.previewReady" : "studio.savedResult")}
      </p>
      <button
        type="button"
        className="activity-swipe"
        data-swipe-next=""
        aria-label={t("studio.swipe")}
        onClick={(event) => {
          if (event.detail === 0 || !suppressClick.current) advance();
          suppressClick.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            advance();
          }
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary) return;
          suppressClick.current = false;
          if (event.pointerType === "mouse") return;
          start.current = {
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
            id: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          start.current = null;
          suppressClick.current = true;
        }}
        onPointerUp={(event) => {
          const gesture = start.current;
          start.current = null;
          if (!gesture || gesture.id !== event.pointerId) return;
          const distance = gesture.y - event.clientY;
          suppressClick.current =
            Math.abs(distance) > 8 || Math.abs(event.clientX - gesture.x) > 8;
          if (
            distance >= 64 &&
            Math.abs(event.clientX - gesture.x) < distance * 0.5 &&
            performance.now() - gesture.time < 1400
          )
            advance();
        }}
      >
        <ArrowUp size={22} aria-hidden="true" />
        <span>{t("studio.swipe")}</span>
      </button>
      <Button variant="primary" autoFocus onClick={advance}>
        {t("Continue")}
        <ArrowUp size={17} aria-hidden="true" />
      </Button>
    </div>
  );
}
