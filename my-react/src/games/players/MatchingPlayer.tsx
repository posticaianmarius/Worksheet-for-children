import { useRef, useState } from "react";
import { photoUrl } from "../../shared/assets";
import { useLanguage } from "../../shared/runtime";
import { Button } from "../../shared/ui";
import { shuffle } from "../engine";
import type { PlayerProps } from "../registry";
export default function MatchingPlayer({
  configuration,
  onComplete,
  disabled = false,
}: PlayerProps) {
  const { t } = useLanguage(),
    pairs = configuration.pairs ?? [];
  const submitted = useRef(false);
  const [groups] = useState(() => shuffle(pairs)),
    [matches, setMatches] = useState<Record<string, number>>({}),
    [selected, setSelected] = useState<number | null>(null),
    [checked, setChecked] = useState(false);
  function place(id: string, value: number) {
    if (
      submitted.current ||
      disabled ||
      Object.values(matches).includes(value) ||
      matches[id] !== undefined
    )
      return;
    setMatches((current) =>
      Object.values(current).includes(value)
        ? current
        : { ...current, [id]: value },
    );
    setSelected(null);
  }
  function remove(id: string) {
    if (submitted.current || disabled) return;
    setMatches((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  return (
    <div className="matching-minigame">
      <p className="game-instruction">
        {t(
          "Tap a number, then its matching group, or drag it there. Tap a placed number to return it.",
        )}
      </p>
      <div className="matching-board">
        <div className="matching-numbers">
          {pairs.map((pair) => (
            <button
              key={pair.id}
              className={
                "matching-number-card match-number" +
                (selected === pair.number ? " selected" : "")
              }
              aria-pressed={selected === pair.number}
              disabled={
                checked ||
                disabled ||
                Object.values(matches).includes(pair.number)
              }
              draggable={!checked && !disabled}
              onDragStart={(event) =>
                event.dataTransfer.setData("text/plain", String(pair.number))
              }
              onClick={() => setSelected(pair.number)}
            >
              {pair.number}
            </button>
          ))}
        </div>
        <div className="matching-groups">
          {groups.map((pair) => (
            <button
              key={pair.id}
              data-pair-id={pair.id}
              aria-disabled={checked || disabled}
              className="matching-target-card matching-group"
              aria-label={
                matches[pair.id] !== undefined
                  ? t("Return {number} from group {count} {emoji}", {
                      number: matches[pair.id],
                      count: pair.number,
                      emoji: pair.emoji,
                    })
                  : t("Place number in group {count} {emoji}", {
                      count: pair.number,
                      emoji: pair.emoji,
                    })
              }
              data-answer-state={
                checked
                  ? matches[pair.id] === pair.number
                    ? "correct"
                    : "incorrect"
                  : undefined
              }
              disabled={checked || disabled}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const number = Number(event.dataTransfer.getData("text/plain"));
                if (pairs.some((p) => p.number === number))
                  place(pair.id, number);
              }}
              onClick={() =>
                matches[pair.id] !== undefined
                  ? remove(pair.id)
                  : selected !== null && place(pair.id, selected)
              }
            >
              <span
                className={
                  "match-slot" +
                  (matches[pair.id] !== undefined
                    ? " matching-placed-number"
                    : "")
                }
              >
                {matches[pair.id] ?? "?"}
              </span>
              <span className="matching-objects">
                {Array.from({ length: Math.max(1, pair.number) }, (_, i) =>
                  pair.imageAssetId ? (
                    <img
                      key={i}
                      src={photoUrl(pair.imageAssetId)}
                      alt={pair.emoji}
                    />
                  ) : (
                    <span key={i}>{pair.emoji}</span>
                  ),
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      {checked && (
        <p role="status">
          {t("Your score:")}{" "}
          {pairs.filter((pair) => matches[pair.id] === pair.number).length} /{" "}
          {pairs.length}
        </p>
      )}
      <Button
        variant="primary"
        disabled={disabled || checked}
        onClick={() => {
          if (submitted.current) return;
          submitted.current = true;
          setChecked(true);
          onComplete({
            score: pairs.filter((pair) => matches[pair.id] === pair.number)
              .length,
            maxScore: pairs.length,
          });
        }}
      >
        {t("Check answer")}
      </Button>
    </div>
  );
}
