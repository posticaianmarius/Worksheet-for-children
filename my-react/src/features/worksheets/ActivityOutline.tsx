import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gameModules } from "../../games/registry";
import { useLanguage } from "../../shared/runtime";
import type { DraftItem } from "../../shared/types";
import { Button } from "../../shared/ui";
interface Gesture {
  key: string;
  pointerId: number;
  element: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  scrolling: boolean;
  touch: boolean;
  source: number;
  target: number;
  scroller: HTMLElement;
  timer?: ReturnType<typeof setTimeout>;
  frame?: number;
  offsetY: number;
  offsetX: number;
  box: DOMRect;
  rows: { key: string; box: DOMRect }[];
}
export default function ActivityOutline({
  items,
  selected,
  disabled,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  items: DraftItem[];
  selected: string | null;
  disabled: boolean;
  onSelect: (key: string) => void;
  onMove: (key: string, index: number) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const { t } = useLanguage(),
    list = useRef<HTMLDivElement>(null),
    gesture = useRef<Gesture | null>(null),
    suppress = useRef(false);
  const [view, setView] = useState<{
    key: string;
    x: number;
    y: number;
    width: number;
    target: number;
  } | null>(null);
  function stop() {
    const value = gesture.current;
    if (!value) return;
    clearTimeout(value.timer);
    cancelAnimationFrame(value.frame ?? 0);
    if (value.active || value.scrolling) suppress.current = true;
    gesture.current = null;
    if (value.element.hasPointerCapture(value.pointerId))
      value.element.releasePointerCapture(value.pointerId);
    setView(null);
  }
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", stop);
      const current = gesture.current;
      if (current) {
        clearTimeout(current.timer);
        cancelAnimationFrame(current.frame ?? 0);
      }
    };
  }, []);
  function start(current: Gesture) {
    if (gesture.current !== current || current.scrolling) return;
    current.active = true;
    current.rows = Array.from(
      list.current?.querySelectorAll<HTMLElement>("li[data-activity-id]") ?? [],
    ).map((row) => ({
      key: row.dataset.activityId!,
      box: row.getBoundingClientRect(),
    }));
    update(current);
  }
  function update(current: Gesture) {
    if (gesture.current !== current) return;
    const rows = Array.from(
      list.current?.querySelectorAll<HTMLElement>("li[data-activity-id]") ?? [],
    );
    let nearest = current.source,
      distance = Infinity;
    rows.forEach((row, index) => {
      const box = row.getBoundingClientRect(),
        delta = Math.abs(
          current.y -
            current.offsetY +
            current.box.height / 2 -
            (box.top + box.height / 2),
        );
      if (delta < distance) {
        distance = delta;
        nearest = index;
      }
    });
    current.target = nearest;
    setView({
      key: current.key,
      x: current.x - current.offsetX,
      y: current.y - current.offsetY,
      width: current.box.width,
      target: nearest,
    });
  }
  function autoScroll(current: Gesture) {
    if (gesture.current !== current || !current.active) return;
    const box = current.scroller.getBoundingClientRect();
    const velocity =
      current.y < box.top + 55 ? -12 : current.y > box.bottom - 55 ? 12 : 0;
    if (velocity) {
      current.scroller.scrollTop += velocity;
      update(current);
    }
    current.frame = requestAnimationFrame(() => autoScroll(current));
  }
  function down(
    event: ReactPointerEvent<HTMLElement>,
    key: string,
    index: number,
  ) {
    if (
      disabled ||
      event.button !== 0 ||
      gesture.current ||
      (event.target as Element).closest("[data-action]")
    )
      return;
    suppress.current = false;
    const element = event.currentTarget,
      box = element.getBoundingClientRect();
    let scroller = element.parentElement!;
    while (
      scroller.parentElement &&
      scroller.scrollHeight <= scroller.clientHeight
    )
      scroller = scroller.parentElement;
    const current: Gesture = {
      key,
      pointerId: event.pointerId,
      element,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      scrolling: false,
      touch: event.pointerType === "touch",
      source: index,
      target: index,
      scroller,
      offsetY: event.clientY - box.top,
      offsetX: event.clientX - box.left,
      box,
      rows: [],
    };
    gesture.current = current;
    element.setPointerCapture(event.pointerId);
    if (current.touch)
      current.timer = setTimeout(() => {
        start(current);
        autoScroll(current);
      }, 80);
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current) return;
    const previousY = current.y;
    current.x = event.clientX;
    current.y = event.clientY;
    const distance = Math.hypot(
      current.x - current.startX,
      current.y - current.startY,
    );
    if (!current.active && distance > 8) {
      if (current.touch) {
        clearTimeout(current.timer);
        current.scrolling = true;
      } else {
        start(current);
        autoScroll(current);
      }
    }
    if (current.scrolling) current.scroller.scrollTop += previousY - current.y;
    else if (current.active) update(current);
  }
  function up() {
    const current = gesture.current;
    if (!current) return;
    if (current.active && current.source !== current.target)
      onMove(current.key, current.target);
    stop();
  }
  const dragged = items.find((item) => item.key === view?.key);
  return (
    <nav
      aria-label={t("Worksheet activities")}
      className="worksheetActivityList"
      ref={list}
    >
      <div className="section-heading">
        <h2>{t("Activities")}</h2>
        <span className="count-badge">{items.length}</span>
      </div>
      <ol>
        {items.map((item, index) => {
          const module = gameModules[item.definition?.type ?? ""];
          return (
            <li
              key={item.key}
              data-activity-id={item.key}
              className={
                (selected === item.key ? "activitySelected " : "") +
                (view?.key === item.key ? "activityDragging" : "")
              }
              onClick={(event) => {
                if ((event.target as Element).closest("[data-action]")) return;
                if (!suppress.current) {
                  onSelect(item.key);
                  event.currentTarget
                    .querySelector<HTMLButtonElement>(".activityThumbnail")
                    ?.focus();
                }
                suppress.current = false;
              }}
              onPointerDown={(event) => down(event, item.key, index)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={stop}
              onLostPointerCapture={() => gesture.current && stop()}
            >
              <button
                className="activityThumbnail"
                aria-label={
                  module ? t(module.titleKey) : t("Unavailable activity")
                }
                aria-pressed={selected === item.key}
                aria-current={selected === item.key ? "true" : undefined}
                onKeyDown={(event) => {
                  if (
                    event.altKey &&
                    ["ArrowUp", "ArrowDown"].includes(event.key)
                  ) {
                    event.preventDefault();
                    onMove(
                      item.key,
                      index + (event.key === "ArrowUp" ? -1 : 1),
                    );
                  }
                }}
              >
                <span className="activityIndex">{index + 1}</span>
                <span className="activityMiniature">
                  {module?.symbol ?? "?"}
                </span>
                <span>
                  <strong>
                    {module ? t(module.titleKey) : t("Unavailable activity")}
                  </strong>
                  <small>
                    {t("Activity")} {index + 1}
                  </small>
                </span>
                <GripVertical size={14} aria-hidden="true" />
              </button>
              <div
                className="activityListActions"
                data-action
                style={{ display: selected === item.key ? "flex" : "none" }}
              >
                {" "}
                <Button
                  variant="ghost"
                  aria-label={t("Move up")}
                  disabled={disabled || index === 0}
                  onClick={() => onMove(item.key, index - 1)}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t("Move down")}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => onMove(item.key, index + 1)}
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t("Duplicate activity")}
                  disabled={disabled}
                  onClick={() => onDuplicate(item.key)}
                >
                  <Copy size={14} />
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t("Remove activity")}
                  disabled={disabled}
                  onClick={() => onRemove(item.key)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              {view && view.target === index && (
                <span className="activityDropPlaceholder" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <Button className="outline-add" disabled={disabled} onClick={onAdd}>
        <Plus size={16} />
        {t("Add activity")}
      </Button>
      {view &&
        dragged &&
        createPortal(
          <div
            className="activityDragPreview"
            aria-hidden="true"
            style={{
              position: "fixed",
              left: view.x,
              top: view.y,
              width: view.width,
              pointerEvents: "none",
            }}
          >
            {gameModules[dragged.definition?.type ?? ""]?.symbol}{" "}
            {t(
              gameModules[dragged.definition?.type ?? ""]?.titleKey ??
                "Unavailable activity",
            )}
          </div>,
          document.body,
        )}
    </nav>
  );
}
