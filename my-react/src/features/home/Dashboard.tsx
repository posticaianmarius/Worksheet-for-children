import "./home.css";
import { useState } from "react";
import {
  BookOpen,
  Users,
  ClipboardList,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage, usePreferences, useSession } from "../../app/state";
import { api, canTeach } from "../../shared/api";
import { Page, Button, Empty, ErrorNotice, Status } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { ShareDialog } from "../worksheets/Sharing";
export default function Dashboard() {
  const { user } = useSession(),
    { t } = useLanguage();
  const teacher = canTeach(user);
  const [share, setShare] = useState<number | null>(null);
  const query = useResource(["dashboard"], async () => {
    const [worksheets, classes, assignments] = await Promise.all([
      teacher ? api.worksheets() : Promise.resolve([]),
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
        teacher && (
          <Link className="button button--primary" to="/sheets">
            <Plus size={18} />
            {t("Create and edit activities")}
          </Link>
        )
      }
    >
      <Resource query={query}>
        {({ worksheets, classes, assignments }) => (
          <>
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
                  count: assignments.length,
                  to: "/assignments",
                  Icon: ClipboardList,
                },
              ]
                .filter((item) => teacher || item.to !== "/sheets")
                .map(({ label, count, to, Icon }) => (
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
                <h2>
                  {t(teacher ? "Recent worksheets" : "Continue learning")}
                </h2>
                <Link
                  className="text-link"
                  to={teacher ? "/sheets" : "/assignments"}
                >
                  {t(teacher ? "View all worksheets" : "Assignments")}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              {teacher ? (
                worksheets.length ? (
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
                                sheet.items?.length === 1
                                  ? "{count} activity"
                                  : "{count} activities",
                                { count: sheet.items?.length ?? 0 },
                              )}
                            </span>
                          </Link>
                          <Button
                            variant="ghost"
                            aria-label={
                              t("Share worksheet") + ": " + sheet.name
                            }
                            disabled={!sheet.items?.length}
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
                )
              ) : (
                <div className="list">
                  {assignments.map((item) => (
                    <Link
                      className="list-row"
                      to={"/assignments/" + item.id}
                      key={item.id}
                    >
                      <strong>{item.worksheet.name}</strong>
                      <Status value={item.status} />
                    </Link>
                  ))}
                  {!assignments.length && (
                    <Empty description={t("No assignments yet.")} />
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </Resource>
      <ShareDialog worksheetId={share} onClose={() => setShare(null)} />
    </Page>
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
