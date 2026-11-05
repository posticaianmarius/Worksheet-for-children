import "./player.css";
import { Suspense, useRef, useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useLanguage, usePreferences } from "../app/state";
import { Button, Loading, Modal } from "../shared/ui";
import { photoUrl } from "../shared/api";
import type { Configuration, GameResult } from "../shared/types";
import { gameModules, supports, loadedPlayers } from "./registry";
import { playTaskComplete, stopGameFeedback } from "../lib/game-feedback.js";
export default function GamePlayer({
  type,
  version = 1,
  configuration,
  onComplete,
  busy = false,
}: {
  type: string;
  version?: number;
  configuration: Configuration;
  onComplete?: (result: GameResult) => Promise<boolean | void>;
  busy?: boolean;
}) {
  const { t } = useLanguage(),
    { preferences } = usePreferences(),
    [started] = useState(() => performance.now()),
    saving = useRef(false),
    completed = useRef(false);
  const [result, setResult] = useState<GameResult | null>(null),
    [failed, setFailed] = useState(false),
    [help, setHelp] = useState(false);
  const [Player] = useState(
    () => loadedPlayers[type] ?? gameModules[type]?.Player,
  );
  const module = gameModules[type],
    automatic = !["color-game", "matching-game"].includes(type);
  useEffect(() => () => stopGameFeedback({ preserveCompletion: true }), []);
  useEffect(() => {
    if (!preferences.sound) stopGameFeedback();
  }, [preferences.sound]);
  async function submit(payload: GameResult) {
    if (!onComplete || saving.current) return;
    saving.current = true;
    setFailed(false);
    try {
      if ((await onComplete(payload)) === false) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      saving.current = false;
    }
  }
  function complete({ score, maxScore }: { score: number; maxScore: number }) {
    if (completed.current) return;
    completed.current = true;
    const payload: GameResult = {
      outcome: "COMPLETED",
      score,
      maxScore,
      timeSeconds: Math.max(
        0,
        Math.round((performance.now() - started) / 1000),
      ),
      details: {},
    };
    setResult(payload);
    if (preferences.sound) playTaskComplete();
    if (automatic) void submit(payload);
  }
  if (!module || !Player || !supports(type, version))
    return <div className="notice">{t("editor.unavailable")}</div>;

  return (
    <Suspense fallback={<Loading />}>
      <section
        className="game-stage worksheetGamePreview worksheetGame"
        data-game-type={type}
      >
        <header className="game-header">
          <div>
            <span className="game-symbol">{module.symbol}</span>
            <h2>{t(module.titleKey)}</h2>
          </div>
          <Button
            variant="ghost"
            aria-label={t("game.how")}
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={20} />
          </Button>
        </header>
        {configuration.imageAssetId && (
          <figure className="activityPhoto">
            <img
              src={photoUrl(configuration.imageAssetId)}
              alt={t("Activity photo")}
            />
          </figure>
        )}
        <Player
          type={type}
          configuration={configuration}
          onComplete={complete}
          disabled={busy}
        />
        {result && (
          <div className="childGameActions">
            {onComplete && (!automatic || failed) ? (
              <Button
                variant="primary"
                busy={busy}
                onClick={() => void submit(result)}
              >
                {t(automatic ? "Save result" : "Continue")}
              </Button>
            ) : (
              <p role="status">
                {onComplete
                  ? t("Saving…")
                  : t("Result:") + " " + result.score + " / " + result.maxScore}
              </p>
            )}
          </div>
        )}
        <Modal
          open={help}
          onClose={() => setHelp(false)}
          title={t("game.how")}
          description={t(module.helpKey)}
        >
          <div className="help-example" aria-hidden="true">
            {type === "math-game"
              ? "2 + 3 = 5"
              : type === "sequence-game"
                ? "1 → 2 → 3 → 4"
                : type === "higher-lower-game"
                  ? "5 > 2"
                  : type === "odd-even-game"
                    ? "●●  ●●"
                    : type === "matching-game"
                      ? "2 ↔ 🍎🍎"
                      : "U · Urs"}
          </div>
          <small className="muted">{t("game.example")}</small>
          <Button variant="primary" onClick={() => setHelp(false)}>
            {t("Continue")}
          </Button>
        </Modal>
      </section>
    </Suspense>
  );
}
