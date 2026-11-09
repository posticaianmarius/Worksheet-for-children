import { BookOpen, CircleCheck, Play } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useLanguage,
  usePreferences,
  useSession,
  useSpace,
} from "../../shared/runtime";
import { assignmentsApi } from "../assignments/api";
import { attemptsApi } from "../attempts/api";
import { SpaceSwitcher } from "../spaces/SpaceContext";
import WorksheetChooser from "./WorksheetChooser";

import { LanguageMenu } from "../../shared/LanguageMenu";
import { Resource, useResource } from "../../shared/resource";
import type { Assignment } from "../../shared/types";
import { Button, Empty, ErrorNotice, Page, Status } from "../../shared/ui";

export default function StudentWork({
  finished = false,
}: {
  finished?: boolean;
}) {
  const { context } = useSpace();
  const [classFilter, setClassFilter] = useState("");
  const [worksheetCode, setWorksheetCode] = useState(() => {
    try {
      return sessionStorage.getItem("playsheets.worksheet-choice") ?? "";
    } catch {
      return "";
    }
  });
  const { user } = useSession(),
    { t } = useLanguage(),
    navigate = useNavigate();
  const query = useResource(["student-work"], assignmentsApi.assignments);
  const [busy, setBusy] = useState<number | null>(null),
    [error, setError] = useState<unknown>(null);
  async function start(assignment: Assignment) {
    if (busy !== null) return;
    setBusy(assignment.id);
    setError(null);
    try {
      const history = await attemptsApi.history(assignment.id);
      const attempt =
        history.find((item) => item.status === "IN_PROGRESS") ??
        (await attemptsApi.start(assignment.id));
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
      subtitle={t("student.welcome", {
        name: context?.student?.name ?? user?.name,
      })}
    >
      <ErrorNotice error={error} />
      {worksheetCode && (
        <WorksheetChooser
          code={worksheetCode}
          onClose={() => {
            try {
              sessionStorage.removeItem("playsheets.worksheet-choice");
            } catch {
              /* optional storage */
            }
            setWorksheetCode("");
          }}
        />
      )}
      <Resource query={query}>
        {(assignments) => {
          const items = assignments.filter(
            (item) =>
              (finished
                ? item.status === "COMPLETED"
                : !item.revokedAt && item.status !== "COMPLETED") &&
              (!classFilter || String(item.classroomId) === classFilter),
          );
          return (
            <>
              <label className="section-toolbar">
                {t("Class")}
                <select
                  aria-label={t("Filter by class")}
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="">{t("All classes")}</option>
                  {[
                    ...new Map(
                      assignments
                        .filter((a) => a.classroomId)
                        .map((a) => [a.classroomId, a.classroomName]),
                    ).entries(),
                  ].map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {items.length ? (
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
                      <h2>{item.deliveryTitle || item.worksheet.name}</h2>
                      {item.classroomName && <p>{item.classroomName}</p>}
                      <p className="muted">
                        {t("Assigned by {name}", {
                          name: item.teacherName ?? "",
                        })}
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
              )}
            </>
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
      <SpaceSwitcher />
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
