import "./student.css";
import { useSpace } from "../spaces/SpaceContext";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { BookOpen, CircleCheck, Settings } from "lucide-react";
import { useLanguage, useSession } from "../../app/state";
import { RequireSession } from "../../app/guards";
import { Brand } from "../../shared/Brand";
import { LanguageMenu } from "../../shared/LanguageMenu";
import { Button, ErrorNotice } from "../../shared/ui";

export function StudentHeader() {
  const { context } = useSpace();
  const { user, logout } = useSession(),
    { t } = useLanguage(),
    navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function leave() {
    setBusy(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="student-header">
        <Link to="/student" aria-label={t("student.work")}>
          <Brand />
        </Link>
        <div className="actions">
          <span className="student-name">
            {context?.student?.name ?? user?.name}
          </span>
          <span className="student-language">
            <LanguageMenu />
          </span>
          <Button busy={busy} onClick={() => void leave()}>
            {t("Another child")}
          </Button>
        </div>
      </header>
      <ErrorNotice error={error} />
    </>
  );
}
export function StudentWorkspace() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  useEffect(() => {
    document.title =
      t(
        pathname === "/student/finished"
          ? "student.finished"
          : pathname === "/student/settings"
            ? "Settings"
            : "student.work",
      ) + " · PlaySheets";
  }, [pathname, t]);
  return (
    <div className="student-shell">
      <StudentHeader />
      <nav className="student-nav" aria-label={t("student.work")}>
        {[
          { to: "/student", key: "student.work", Icon: BookOpen },
          {
            to: "/student/finished",
            key: "student.finished",
            Icon: CircleCheck,
          },
          { to: "/student/settings", key: "Settings", Icon: Settings },
        ].map(({ to, key, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={18} />
            {t(key)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
export default function StudentLayout() {
  return (
    <RequireSession entry="/">
      <StudentOnly />
    </RequireSession>
  );
}
function StudentOnly() {
  const { user } = useSession();
  return user?.role === "USER" ? (
    <StudentWorkspace />
  ) : (
    <Navigate to="/home" replace />
  );
}
