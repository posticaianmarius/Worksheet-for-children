import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage, useSession } from "../../shared/runtime";
import { attemptsApi } from "./api";
import { remainingItems } from "./model";

import { maximumScore } from "../../games/engine";
import GamePlayer from "../../games/Player";
import { gameModules, preloadGame } from "../../games/registry";
import { Resource, useResource } from "../../shared/resource";
import { SoundButton } from "../../shared/SoundButton";
import type { Attempt as AttemptData, GameResult } from "../../shared/types";
import { Button, ErrorNotice, Page, Status } from "../../shared/ui";
export default function Attempt() {
  const { id = "" } = useParams();
  const query = useResource(["attempt", id], () => attemptsApi.attempt(id));
  return (
    <Resource query={query}>
      {(attempt) => <AttemptContent key={attempt.id} initial={attempt} />}
    </Resource>
  );
}
function AttemptContent({ initial }: { initial: AttemptData }) {
  const { user } = useSession(),
    { t } = useLanguage();
  const [attempt, setAttempt] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    saving = useRef(false);
  const pending = remainingItems(attempt),
    item = pending[0];
  const nextType = pending[1]?.definition?.type;
  useEffect(() => {
    if (nextType) void preloadGame(nextType).catch(() => {});
  }, [nextType]);
  const readOnly =
      attempt.status !== "IN_PROGRESS" ||
      (!!attempt.assignmentId && user?.role !== "USER"),
    back =
      user?.role === "USER"
        ? "/student"
        : attempt.assignmentId
          ? "/assignments/" + attempt.assignmentId
          : "/kids/" + attempt.worksheetId;
  async function save(result: GameResult) {
    if (!item || saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await attemptsApi.result(attempt.id, item.id, result);
      setAttempt((current) => ({
        ...current,
        results: [
          ...current.results.filter(
            (entry) => entry.revisionItemId !== item.id,
          ),
          saved,
        ],
      }));
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function finish() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      setAttempt(await attemptsApi.complete(attempt.id));
    } catch (e) {
      setError(e);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (readOnly)
    return (
      <Page
        title={t(attempt.status === "COMPLETED" ? "Well done!" : "Results")}
        subtitle={t("game.completed")}
        actions={
          <Link className="button" to={back}>
            {t("Back")}
          </Link>
        }
      >
        <section className="panel result-panel">
          <span className="completion-mark">
            <Check size={35} />
          </span>
          <div className="result-total">
            {attempt.totalScore ?? "—"} <span>/ {attempt.maxScore ?? "—"}</span>
          </div>
          <Status value={attempt.status} />
          {attempt.items.map((activity, index) => {
            const result = attempt.results.find(
              (entry) => entry.revisionItemId === activity.id,
            );
            return (
              <div className="list-row" key={activity.id}>
                <span>
                  {index + 1}.{" "}
                  {t(
                    gameModules[activity.definition?.type ?? ""]?.titleKey ??
                      "Unavailable activity",
                  )}
                </span>
                <strong>
                  {result ? result.score + " / " + result.maxScore : "—"}
                </strong>
              </div>
            );
          })}
        </section>
      </Page>
    );
  return (
    <main className="attempt-page">
      <div className="attempt-toolbar">
        <Link to={back} aria-label={t("Back")} className="button button--ghost">
          <ArrowLeft size={18} />
        </Link>
        <div className="attempt-progress">
          <p role="status">
            {t("Activity {current} of {total}", {
              current: Math.min(
                attempt.results.length + 1,
                attempt.items.length,
              ),
              total: attempt.items.length,
            })}
          </p>
          <progress
            max={attempt.items.length || 1}
            value={attempt.results.length}
            aria-label={t("Worksheet activity")}
          />
        </div>
        <SoundButton />
      </div>
      <ErrorNotice error={error} />
      {item ? (
        <>
          <GamePlayer
            key={item.id}
            type={item.definition?.type ?? ""}
            version={item.definition?.version}
            configuration={item.configuration}
            onComplete={save}
            busy={busy}
          />
          <div className="attempt-secondary">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void save({
                  outcome: "SKIPPED",
                  score: 0,
                  maxScore: maximumScore(
                    item.definition?.type ?? "",
                    item.configuration,
                  ),
                  timeSeconds: 0,
                  details: {},
                })
              }
            >
              {t("Skip activity")}
            </Button>
          </div>
        </>
      ) : (
        <section className="panel finish-panel">
          <span className="completion-mark">
            <Check size={32} />
          </span>
          <h1>{t("game.completed")}</h1>
          <p>{t("All activities are saved. Ready to finish?")}</p>
          <Button variant="primary" busy={busy} onClick={() => void finish()}>
            {t("Finish worksheet")}
          </Button>
        </section>
      )}
    </main>
  );
}
