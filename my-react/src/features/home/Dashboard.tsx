import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { canTeach } from "../../shared/identity";
import { useLanguage, usePreferences, useSession } from "../../shared/runtime";
import { Resource, useResource } from "../../shared/resource";
import { Button, Empty, ErrorNotice, Page, Status } from "../../shared/ui";
import { assignmentsApi } from "../assignments/api";
import { ShareDialog } from "../assignments/Sharing";
import { classroomsApi } from "../classrooms/api";
import { worksheetsApi } from "../worksheets/api";
import { CreateWorksheet } from "../worksheets/CreateWorksheet";
import "./home.css";

export default function Dashboard() {
  const { user } = useSession();
  return canTeach(user) ? (
    <TeacherDashboard />
  ) : (
    <Navigate to="/student" replace />
  );
}
function TeacherDashboard() {
  const { user } = useSession(),
    { t, language } = useLanguage();
  const [share, setShare] = useState<number | null>(null),
    [creating, setCreating] = useState(false);
  const query = useResource(["dashboard"], async () => {
    const [worksheets, classes, assignments] = await Promise.all([
      worksheetsApi.worksheets(),
      classroomsApi.classes(),
      assignmentsApi.assignments(),
    ]);
    return { worksheets, classes, assignments };
  });
  return (
    <div className="teacher-dashboard">
      <Page
        eyebrow={t("dashboard.eyebrow")}
        title={t("Welcome") + ", " + user?.name + "!"}
        subtitle={t("dashboard.intro")}
        actions={
          <>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={18} aria-hidden="true" />
              {t("New worksheet")}
            </Button>
            <Link className="button dashboard-results-link" to="/results">
              <ChartNoAxesCombined size={18} aria-hidden="true" />
              {t("dashboard.results")}
            </Link>
          </>
        }
      >
        <Resource query={query}>
          {({ worksheets, classes, assignments }) => (
            <>
              <TeacherGuide
                counts={[classes.length, worksheets.length, assignments.length]}
              />
              <div className="stat-grid">
                {[
                  {
                    label: "Worksheets",
                    count: worksheets.length,
                    to: "/sheets",
                    Icon: BookOpen,
                  },
                  {
                    label: "Classes",
                    count: classes.length,
                    to: "/classes",
                    Icon: Users,
                  },
                  {
                    label: "Assignments",
                    count: new Set(
                      assignments.map((item) => item.batchId ?? item.id),
                    ).size,
                    to: "/assignments",
                    Icon: ClipboardList,
                  },
                ].map(({ label, count, to, Icon }) => (
                  <Link className="stat-card" to={to} key={to}>
                    <span className="stat-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="stat-label">{t(label)}</span>
                    <strong>{count}</strong>
                    <ArrowUpRight
                      className="stat-arrow"
                      size={18}
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
              <section
                className="dashboard-recent"
                aria-labelledby="recent-worksheets-title"
              >
                <div className="section-heading">
                  <h2 id="recent-worksheets-title">{t("Recent worksheets")}</h2>
                  <Link className="text-link" to="/sheets">
                    {t("View all worksheets")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
                {worksheets.length ? (
                  <div className="recent-grid">
                    {[...worksheets]
                      .sort(
                        (a, b) =>
                          Date.parse(b.updatedAt ?? "") -
                          Date.parse(a.updatedAt ?? ""),
                      )
                      .slice(0, 4)
                      .map((sheet) => {
                        const updated =
                          sheet.updatedAt &&
                          Number.isFinite(Date.parse(sheet.updatedAt))
                            ? new Intl.DateTimeFormat(
                                language === "ro" ? "ro-RO" : "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              ).format(new Date(sheet.updatedAt))
                            : null;
                        return (
                          <article className="recent-card" key={sheet.id}>
                            <div className="recent-card-heading">
                              <span className="feature-icon" aria-hidden="true">
                                <BookOpen size={21} />
                              </span>
                              <div className="recent-card-content">
                                <Link to={"/teacher/" + sheet.id}>
                                  <h3>{sheet.name}</h3>
                                </Link>
                                <p className="recent-meta">
                                  <span>
                                    {t(
                                      sheet.items.length === 1
                                        ? "{count} activity"
                                        : "{count} activities",
                                      { count: sheet.items.length },
                                    )}
                                  </span>
                                  {updated && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        {t("dashboard.updated")}{" "}
                                        <time dateTime={sheet.updatedAt}>
                                          {updated}
                                        </time>
                                      </span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="recent-card-actions">
                              <Link
                                className="text-link dashboard-edit"
                                to={"/teacher/" + sheet.id}
                                aria-label={t("dashboard.editNamed", {
                                  name: sheet.name,
                                })}
                              >
                                {t("dashboard.edit")}
                                <ArrowRight size={16} aria-hidden="true" />
                              </Link>
                              <Button
                                variant="ghost"
                                aria-label={
                                  t("Share worksheet") + ": " + sheet.name
                                }
                                disabled={!sheet.items.length}
                                onClick={() => setShare(sheet.id)}
                              >
                                <Share2 size={16} aria-hidden="true" />
                                {t("dashboard.share")}
                              </Button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                ) : (
                  <div className="panel dashboard-empty">
                    <Empty
                      title={t("dashboard.emptyTitle")}
                      description={t("dashboard.emptyCopy")}
                    >
                      <Button
                        variant="primary"
                        onClick={() => setCreating(true)}
                      >
                        <Plus size={18} aria-hidden="true" />
                        {t("dashboard.firstWorksheet")}
                      </Button>
                    </Empty>
                  </div>
                )}
              </section>
            </>
          )}
        </Resource>
        <ShareDialog worksheetId={share} onClose={() => setShare(null)} />
        {creating && <CreateWorksheet onClose={() => setCreating(false)} />}
      </Page>
    </div>
  );
}
function TeacherGuide({ counts }: { counts: number[] }) {
  const { t } = useLanguage();
  const completed = counts.filter(Boolean).length,
    next = counts.findIndex((count) => !count);
  if (completed === counts.length) return null;
  return (
    <section className="teacher-guide" aria-labelledby="teacher-guide-title">
      <div className="teacher-guide-heading">
        <h2 id="teacher-guide-title">{t("teacher.getStarted")}</h2>
        <span className="teacher-guide-progress">
          {t("dashboard.setupProgress", { count: completed })}
        </span>
      </div>
      <ol className="teacher-guide-steps">
        {[
          { to: "/classes", key: "dashboard.stepClass" },
          { to: "/sheets", key: "dashboard.stepWorksheet" },
          { to: "/assignments", key: "dashboard.stepAssign" },
        ].map((step, index) => (
          <li key={step.to}>
            <Link
              to={step.to}
              className={counts[index] ? "complete" : ""}
              aria-current={index === next ? "step" : undefined}
              aria-label={
                t(step.key) + (counts[index] ? ": " + t("teacher.ready") : "")
              }
            >
              <span className="guide-step" aria-hidden="true">
                {counts[index] ? <Check size={15} /> : index + 1}
              </span>
              <span>{t(step.key)}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function Account() {
  const { user, logout } = useSession(),
    { t } = useLanguage(),
    { preferences, setPreference } = usePreferences();
  const [error, setError] = useState<unknown>(null);
  return (
    <Page title={t("Account")}>
      <div className="account-grid">
        <section className="panel">
          <h2>{user?.name}</h2>
          <dl className="detail-list">
            <dt>{t("Email")}</dt>
            <dd>{user?.email ?? "—"}</dd>
            <dt>{t("Role")}</dt>
            <dd>
              <Status value={user?.role ?? "USER"} />
            </dd>
          </dl>
          <ErrorNotice error={error} />
          <Button
            variant="danger"
            onClick={() => void logout().catch(setError)}
          >
            {t("Log out")}
          </Button>
        </section>
        <section className="panel">
          <h2>{t("preferences.title")}</h2>
          <p className="muted">{t("preferences.copy")}</p>
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
      </div>
    </Page>
  );
}
