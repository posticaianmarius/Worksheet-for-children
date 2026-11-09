import { Play, Plus } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { canTeach } from "../../shared/identity";
import { useLanguage, useSession } from "../../shared/runtime";
import { attemptsApi } from "../attempts/api";
import { worksheetsApi } from "../worksheets/api";
import { assignmentsApi } from "./api";
import "./assignments.css";

import { Resource, useResource } from "../../shared/resource";
import type { Assignment, Worksheet } from "../../shared/types";
import {
  Button,
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  Page,
  Status,
} from "../../shared/ui";
const Reports = lazy(() => import("./TeacherAssignments"));
export default function Assignments() {
  const { user } = useSession();
  return canTeach(user) ? (
    <Suspense fallback={<Loading />}>
      <Reports />
    </Suspense>
  ) : (
    <StudentAssignments />
  );
}
function StudentAssignments() {
  const { t } = useLanguage(),
    navigate = useNavigate(),
    [params] = useSearchParams(),
    query = useResource(["assignments"], assignmentsApi.assignments);
  const [open, setOpen] = useState(params.has("join")),
    [code, setCode] = useState(() => {
      try {
        return sessionStorage.getItem("pending-worksheet-code") ?? "";
      } catch {
        return "";
      }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function join() {
    if (!code.trim() || busy) return;
    setBusy(true);
    try {
      const result = await assignmentsApi.joinWorksheet(code);
      try {
        sessionStorage.removeItem("pending-worksheet-code");
      } catch {
        /* Optional storage. */
      }
      navigate("/assignments/" + result.assignmentId);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={t("Assignments")}
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          {t("Join worksheet")}
        </Button>
      }
    >
      <Resource query={query}>
        {(items) =>
          items.length ? (
            <section className="panel">
              {items.map((item) => (
                <Link
                  className="list-row"
                  to={"/assignments/" + item.id}
                  key={item.id}
                >
                  <div>
                    <strong>{item.worksheet.name}</strong>
                    <p className="muted">{item.teacherName}</p>
                  </div>
                  <Status value={item.revokedAt ? "REVOKED" : item.status} />
                </Link>
              ))}
            </section>
          ) : (
            <Empty description={t("No assignments yet.")} />
          )
        }
      </Resource>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t("Join worksheet")}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <label htmlFor="join-code">{t("Worksheet code")}</label>
          <input
            id="join-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <ErrorNotice error={error} />
          <Button variant="primary" type="submit" busy={busy}>
            {t("Join worksheet")}
          </Button>
        </form>
      </Modal>
    </Page>
  );
}
export function AssignmentDetail({ personal = false }: { personal?: boolean }) {
  const params = useParams(),
    id = params.id ?? params.worksheetId ?? "",
    { user } = useSession(),
    { t, language } = useLanguage(),
    navigate = useNavigate();
  const query = useResource(["assignment-detail", id, personal], async () => {
    const [entry, history] = await Promise.all([
      personal ? worksheetsApi.worksheet(id) : assignmentsApi.assignment(id),
      attemptsApi.history(id, personal),
    ]);
    return { entry, history };
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <Resource query={query}>
      {({ entry, history }) => {
        const assignment = entry as Assignment,
          sheet = personal ? (entry as Worksheet) : assignment.worksheet,
          canPlay =
            personal ||
            (assignment.userId === user?.id && !assignment.revokedAt);
        return (
          <Page
            title={sheet.name}
            subtitle={t(personal ? "Personal practice" : "Assigned by {name}", {
              name: assignment.teacherName ?? "",
            })}
          >
            <ErrorNotice error={error} />
            <section className="panel learning-start">
              <div>
                <span className="eyebrow">{t("common.learn")}</span>
                <h2>
                  {t("{count} activities", { count: sheet.items?.length ?? 0 })}
                </h2>
                <p className="muted">
                  {t("Completed activities stay saved when you return.")}
                </p>
              </div>
              {canPlay && (
                <Button
                  variant="primary"
                  busy={busy}
                  onClick={() => {
                    if (busy) return;
                    setBusy(true);
                    void (async () => {
                      try {
                        const active =
                          history.find(
                            (item) => item.status === "IN_PROGRESS",
                          ) ?? (await attemptsApi.start(id, personal));
                        navigate("/attempts/" + active.id);
                      } catch (e) {
                        setError(e);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  <Play size={18} />
                  {t(
                    history.some((item) => item.status === "IN_PROGRESS")
                      ? "Continue learning"
                      : history.length
                        ? "Try again"
                        : "Start learning",
                  )}
                </Button>
              )}
            </section>
            <section className="panel">
              <h2>{t("History")}</h2>
              {history.length ? (
                history.map((attempt) => (
                  <Link
                    className="list-row"
                    key={attempt.id}
                    to={"/attempts/" + attempt.id}
                  >
                    <span>
                      {attempt.startedAt
                        ? new Date(attempt.startedAt).toLocaleDateString(
                            language === "ro" ? "ro-RO" : "en-GB",
                          )
                        : "—"}
                    </span>
                    <Status value={attempt.status} />
                    <strong>
                      {attempt.status === "COMPLETED"
                        ? attempt.totalScore + " / " + attempt.maxScore
                        : "—"}
                    </strong>
                  </Link>
                ))
              ) : (
                <Empty description={t("No attempts yet.")} />
              )}
            </section>
          </Page>
        );
      }}
    </Resource>
  );
}
export function LegacyWorksheet() {
  const { worksheetId = "" } = useParams();
  const query = useResource(["legacy-worksheet", worksheetId], async () => {
    try {
      await worksheetsApi.worksheet(worksheetId);
      return { personal: true, id: 0 };
    } catch (error) {
      if (!(
        error instanceof Error &&
        "status" in error &&
        error.status === 404
      ))
        throw error;
      const entry = (await assignmentsApi.assignments()).find(
        (item) => item.worksheet.id === Number(worksheetId) && !item.revokedAt,
      );
      if (!entry) throw error;
      return { personal: false, id: entry.id };
    }
  });
  return (
    <Resource query={query}>
      {(value) =>
        value.personal ? (
          <AssignmentDetail personal />
        ) : (
          <Navigate to={"/assignments/" + value.id} replace />
        )
      }
    </Resource>
  );
}
