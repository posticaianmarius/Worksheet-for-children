import "./home.css";
import { useState } from "react";
import {
  BookOpen,
  Users,
  ClipboardList,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useLanguage, usePreferences, useSession } from "../../app/state";
import { api, canTeach } from "../../shared/api";
import { Page, Button, Empty, ErrorNotice, Status } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { ShareDialog } from "../worksheets/Sharing";
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
    { t } = useLanguage();
  const [share, setShare] = useState<number | null>(null);
  const query = useResource(["dashboard"], async () => {
    const [worksheets, classes, assignments] = await Promise.all([
      api.worksheets(),
      api.classes(),
      api.assignments(),
    ]);
    return { worksheets, classes, assignments };
  });
  return (
    <Page
      eyebrow={t("dashboard.eyebrow")}
      title={t("Welcome") + ", " + user?.name + "!"}
      subtitle={t("dashboard.subtitle")}
      actions={
        <Link className="button button--primary" to="/sheets">
          <Plus size={18} />
          {t("Create and edit activities")}
        </Link>
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
                  <Icon size={20} />
                  <span>{t(label)}</span>
                  <strong>{count}</strong>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
            <section className="panel">
              <div className="section-heading">
                <h2>{t("Recent worksheets")}</h2>
                <Link className="text-link" to="/sheets">
                  {t("View all worksheets")}
                  <ArrowUpRight size={14} />
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
                    .map((sheet) => (
                      <article className="recent-card" key={sheet.id}>
                        <span className="feature-icon">
                          <BookOpen size={22} />
                        </span>
                        <Link to={"/teacher/" + sheet.id}>
                          <h3>{sheet.name}</h3>
                          <span className="muted">
                            {t(
                              sheet.items.length === 1
                                ? "{count} activity"
                                : "{count} activities",
                              { count: sheet.items.length },
                            )}
                          </span>
                        </Link>
                        <Button
                          variant="ghost"
                          aria-label={t("Share worksheet") + ": " + sheet.name}
                          disabled={!sheet.items.length}
                          onClick={() => setShare(sheet.id)}
                        >
                          {t("Share worksheet")}
                        </Button>
                      </article>
                    ))}
                </div>
              ) : (
                <Empty
                  description={t(
                    "No worksheets yet. Create your first worksheet to begin.",
                  )}
                >
                  <Link className="button button--primary" to="/sheets">
                    {t("Open worksheets")}
                  </Link>
                </Empty>
              )}
            </section>
          </>
        )}
      </Resource>
      <ShareDialog worksheetId={share} onClose={() => setShare(null)} />
    </Page>
  );
}
function TeacherGuide({ counts }: { counts: number[] }) {
  const { t } = useLanguage();
  if (counts.every(Boolean)) return null;
  return (
    <section className="panel teacher-guide">
      <h2>{t("teacher.getStarted")}</h2>
      <div className="teacher-guide-steps">
        {[
          { to: "/classes", key: "teacher.addClass" },
          { to: "/sheets", key: "teacher.makeWorksheet" },
          { to: "/assignments", key: "teacher.giveWork" },
        ].map((step, index) => (
          <Link key={step.to} to={step.to}>
            <span
              className={counts[index] ? "guide-step complete" : "guide-step"}
            >
              {index + 1}
            </span>
            <span>
              {t(step.key)}
              {counts[index] > 0 && <small>{t("teacher.ready")}</small>}
            </span>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
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
