import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage, usePreferences } from "../../shared/runtime";
import type { Answer } from "../engine";
import { createQuestion, exerciseCount } from "../engine";
import { playAnswerFeedback } from "../feedback";
import type { PlayerProps } from "../registry";
import { EmojiVisual } from "../../shared/visuals/Visual";
const classNames: Record<string, string> = {
  "math-game": "math",
  "sequence-game": "sequence",
  "higher-lower-game": "higher-lower",
  "odd-even-game": "odd-even",
};
export default function NumberPlayer({
  type,
  configuration,
  onComplete,
  disabled = false,
}: PlayerProps) {
  const { t } = useLanguage(),
    { preferences } = usePreferences();
  const [question, setQuestion] = useState(() =>
    createQuestion(type, configuration),
  );
  const [selected, setSelected] = useState<Answer | null>(null),
    [index, setIndex] = useState(1),
    [finished, setFinished] = useState(false),
    [finalScore, setFinalScore] = useState(0);
  const score = useRef(0),
    locked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const total = exerciseCount(configuration),
    prefix = classNames[type];
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) {
      clearTimeout(timer.current);
      locked.current = true;
    }
  }, [disabled]);
  function answer(value: Answer) {
    if (locked.current || disabled) return;
    locked.current = true;
    setSelected(value);
    const correct = value === question.correct;
    if (correct) score.current++;
    if (preferences.sound) playAnswerFeedback(correct);
    timer.current = setTimeout(() => {
      if (index >= total) {
        setFinalScore(score.current);
        setFinished(true);
        onComplete({ score: score.current, maxScore: total });
        return;
      }
      setIndex((current) => current + 1);
      setQuestion(createQuestion(type, configuration));
      setSelected(null);
      locked.current = false;
    }, 2000);
  }
  function label(value: Answer) {
    return typeof value === "number"
      ? String(value)
      : t(
          (
            {
              odd: "Odd",
              even: "Even",
              bigger: "Greater",
              smaller: "Smaller",
            } as Record<string, string>
          )[value] ?? String(value),
        );
  }
  if (finished)
    return (
      <div className={prefix + "-minigame game-finished"}>
        <Check size={36} />
        <h3>{t("Finished!")}</h3>
        <p>
          {t("Your score:")} {finalScore} / {total}
        </p>
      </div>
    );
  return (
    <div className={prefix + "-minigame number-player"}>
      <p className={prefix + "-exercise-number game-step"}>
        {t("Exercise")} {index} / {total}
      </p>
      <progress
        className="exercise-progress"
        value={index - 1}
        max={total}
        aria-label={t("studio.exerciseProgress")}
      />
      <h3 className="number-instruction">{t("studio.prompt." + type)}</h3>
      <div className={prefix + "-question number-prompt"}>
        {type === "math-game" ? (
          <strong>
            {question.values[0]} {question.operator} {question.values[1]} = ?
          </strong>
        ) : type === "sequence-game" ? (
          <div className="sequence-values">
            {question.values.map((value, i) => (
              <span key={i}>{value}</span>
            ))}
            <span>?</span>
          </div>
        ) : type === "higher-lower-game" ? (
          <strong className="comparison-row">
            <span>{question.values[0]}</span>
            <span className="comparison-placeholder">
              {selected === null ? "?" : selected === "bigger" ? ">" : "<"}
            </span>
            <span>{question.values[1]}</span>
          </strong>
        ) : (
          <strong>{question.values[0]}</strong>
        )}
      </div>
      {["math-game", "higher-lower-game"].includes(type) &&
      (type !== "math-game" || ["+", "-"].includes(question.operator ?? "")) &&
      question.values.every(
        (value) => Number.isInteger(value) && value >= 0 && value <= 10,
      ) ? (
        <div className="counting-scene" aria-hidden="true">
          {question.values.map((value, group) => (
            <div className="counting-basket" key={group}>
              {Array.from({ length: value }, (_, i) => (
                <EmojiVisual key={i} emoji={group === 0 ? "🍎" : "🍊"} />
              ))}
              {value === 0 && <span>0</span>}
            </div>
          ))}
        </div>
      ) : type === "odd-even-game" && question.values[0] <= 20 ? (
        <div className="parity-scene" aria-hidden="true">
          {Array.from(
            { length: Math.ceil(question.values[0] / 2) },
            (_, pair) => (
              <div key={pair}>
                <EmojiVisual emoji="⭐" />
                {pair * 2 + 1 < question.values[0] && (
                  <EmojiVisual emoji="⭐" />
                )}
              </div>
            ),
          )}
        </div>
      ) : null}
      <div
        className={
          prefix +
          "-answers answer-grid " +
          (question.choices.length === 2 ? "answer-grid--two" : "")
        }
      >
        {question.choices.map((value) => (
          <button
            key={value}
            disabled={selected !== null || disabled}
            onClick={() => answer(value)}
            data-answer-state={
              selected === value
                ? value === question.correct
                  ? "correct"
                  : "incorrect"
                : undefined
            }
            className="answer"
          >
            <span>{label(value)}</span>
            {selected === value &&
              (value === question.correct ? (
                <Check size={20} />
              ) : (
                <X size={20} />
              ))}
          </button>
        ))}
      </div>
      <p className="answer-feedback" role="status">
        {selected === null
          ? ""
          : t(
              selected === question.correct ? "game.correct" : "game.incorrect",
            )}
      </p>
    </div>
  );
}
