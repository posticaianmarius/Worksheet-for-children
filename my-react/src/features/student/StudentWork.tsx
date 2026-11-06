import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Play, CircleCheck } from "lucide-react";
import { useLanguage, usePreferences, useSession } from "../../app/state";
import { api } from "../../shared/api";
import { LanguageMenu } from "../../shared/LanguageMenu";
import { Button, Empty, ErrorNotice, Page, Status } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import type { Assignment } from "../../shared/types";

export default function StudentWork({
  finished = false,
}: {
  finished?: boolean;
}) {
  const { user } = useSession(),
    { t } = useLanguage(),
    navigate = useNavigate();
  const query = useResource(["student-work"], api.assignments);
  const [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState<unknown>(null);
  async function start(assignment: Assignment) {
    if (busy !== null) return;
    setBusy(assignment.id);
    setError(null);
    try {
      const history = await api.history(assignment.id);
      const attempt =
        history.find((item) => item.status === "IN_PROGRESS") ??
        (await api.start(assignment.id));
      navigate("/attempts/" + attempt.id);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }
  return (
    <Page
      title={t(finished ? "student.finished" : "student.work")}
      subtitle={t("student.welcome", { name: user?.name })}
    >
      <ErrorNotice error={error} />
      <Resource query={query}>
        {(assignments) => {
          const items = assignments.filter(
            (item) =>
              !item.revokedAt && (item.status === "COMPLETED") === finished,
          );
          return items.length ? (
            <div className="student-work-grid">
              {items.map((item) => (
                <article className="panel student-work-card" key={item.id}>
                  <span className="feature-icon">
                    {finished ? (
                      <CircleCheck size={25} />
                    ) : (
                      <BookOpen size={25} />
                    )}
                  </span>
                  <h2>{item.worksheet.name}</h2>
                  <p className="muted">
                    {t("Assigned by {name}", { name: item.teacherName ?? "" })}
                  </p>
                  <span className="muted">
                    {t(
                      item.worksheet.items.length === 1
                        ? "{count} activity"
                        : "{count} activities",
                      {
                        count: item.worksheet.items.length,
                      },
                    )}
                  </span>
                  <Status value={item.status} />
                  {finished ? (
                    <Link className="button" to={"/assignments/" + item.id}>
                      {t("student.viewResults")}
                    </Link>
                  ) : (
                    <Button
                      variant="primary"
                      busy={busy === item.id}
                      disabled={busy !== null}
                      onClick={() => void start(item)}
                    >
                      <Play size={18} />
                      {t(
                        item.status === "IN_PROGRESS"
                          ? "student.continue"
                          : "student.start",
                      )}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              description={t(
                finished ? "student.noFinished" : "student.noWork",
              )}
            />
          );
        }}
      </Resource>
    </Page>
  );
}
export function FinishedWork() {
  return <StudentWork finished />;
}
export function StudentSettings() {
  const { user } = useSession(),
    { t } = useLanguage(),
    { preferences, setPreference } = usePreferences();
  return (
    <Page title={t("Settings")}>
      <section className="panel student-settings">
        <h2>{user?.name}</h2>
        <p className="muted">{t("student.profileHelp")}</p>
        <div className="preference-row">
          <span>{t("Language")}</span>
          <LanguageMenu />
        </div>
        {(["sound", "motion"] as const).map((key) => (
          <label className="preference-row" key={key}>
            <span>{t("preferences." + key)}</span>
            <input
              type="checkbox"
              role="switch"
              checked={preferences[key]}
              onChange={(e) => setPreference(key, e.target.checked)}
            />
          </label>
        ))}
      </section>
    </Page>
  );
}
