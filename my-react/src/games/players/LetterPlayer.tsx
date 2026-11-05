import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLanguage, usePreferences } from "../../app/state";
import { photoUrl } from "../../shared/api";
import { Button } from "../../shared/ui";
import { maximumScore } from "../engine";
import type { PlayerProps } from "../registry";
import { playAnswerFeedback } from "../../lib/game-feedback.js";
export default function LetterPlayer({
  configuration,
  onComplete,
  disabled = false,
}: PlayerProps) {
  const { t } = useLanguage(),
    { preferences } = usePreferences();
  const [found, setFound] = useState<string[]>([]),
    [incorrect, setIncorrect] = useState<string | null>(null),
    [finished, setFinished] = useState(false);
  const foundKeys = useRef(new Set<string>());
  const letter = String(configuration.letter ?? "u"),
    animals = configuration.animals ?? [];
  function tap(key: string, char: string) {
    if (disabled || finished || foundKeys.current.has(key)) return;
    const correct =
      char.toLocaleLowerCase("ro-RO") === letter.toLocaleLowerCase("ro-RO");
    if (preferences.sound) playAnswerFeedback(correct);
    setIncorrect(correct ? null : key);
    if (correct) {
      foundKeys.current.add(key);
      setFound([...foundKeys.current]);
    }
  }
  return (
    <div className="colorMinigame letter-player">
      <div className="letter-target">
        <span className="muted">{t("Target letter")}</span>
        <strong>{letter.toLocaleUpperCase("ro-RO")}</strong>
      </div>
      <div className="widgets">
        {animals.map((animal, animalIndex) => (
          <div className="widget" key={animal.id}>
            <img
              src={photoUrl(animal.imageAssetId, animal.img)}
              alt={animal.name}
            />
            <h3>{animal.name}</h3>
            <div className="bubles">
              {Array.from(animal.name).map((char, index) => {
                if (/\s/u.test(char)) return <span key={index} />;
                const key = animalIndex + ":" + index,
                  correct = found.includes(key);
                return (
                  <button
                    className="letter-answer"
                    key={index}
                    aria-label={t("Letter {index} in {name}", {
                      index: index + 1,
                      name: animal.name,
                    })}
                    aria-pressed={correct}
                    disabled={finished || disabled}
                    data-answer-state={
                      correct
                        ? "correct"
                        : incorrect === key
                          ? "incorrect"
                          : undefined
                    }
                    onClick={() => tap(key, char)}
                  >
                    {char}
                    {correct && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {incorrect && (
        <p className="answer-feedback" role="status">
          {t("Try again!")}
        </p>
      )}
      {finished ? (
        <p role="status">
          {t("You found {count} of {total} letters!", {
            count: found.length,
            total: maximumScore("color-game", configuration),
          })}
        </p>
      ) : (
        <Button
          variant="primary"
          disabled={disabled}
          onClick={() => {
            setFinished(true);
            onComplete({
              score: found.length,
              maxScore: maximumScore("color-game", configuration),
            });
          }}
        >
          {t("I'm done")}
        </Button>
      )}
    </div>
  );
}
