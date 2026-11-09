import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ClipboardList,
  House,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router-dom";
import { SpaceSwitcher } from "../features/spaces/SpaceContext";
import "../features/spaces/spaces.css";
import {
  StudentHeader,
  StudentWorkspace,
} from "../features/student/StudentLayout";
import { Brand } from "../shared/Brand";
import { canTeach } from "../shared/identity";
import { LanguageMenu } from "../shared/LanguageMenu";
import { RequireSession } from "../shared/RequireSession";
import {
  readStorage,
  useLanguage,
  useSession,
  writeStorage,
} from "../shared/runtime";
import { Button, ErrorNotice, Modal } from "../shared/ui";
import "./layout.css";
export function PublicHeader({ minimal = false }: { minimal?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const { user, logout } = useSession(),
    { t } = useLanguage();
  async function leave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="public-header">
        <Link to="/" aria-label={t("Play")}>
          <Brand />
        </Link>
        <div className="actions">
          <LanguageMenu />
          {!minimal &&
            (user ? (
              <>
                {canTeach(user) && (
                  <Link
                    className="button public-workspace-link"
                    aria-label={t("My classes")}
                    to="/home"
                  >
                    <House size={16} />
                    <span>{t("My classes")}</span>
                  </Link>
                )}
                <Button busy={busy} onClick={() => void leave()}>
                  {t(user.role === "USER" ? "Another child" : "Log out")}
                </Button>
              </>
            ) : (
              <>
                <Link className="text-link" to="/login">
                  {t("Teacher login")}
                  <ArrowUpRight size={14} />
                </Link>
                <Link
                  className="button button--primary teacher-signup"
                  to="/signup"
                >
                  {t("Teacher account")}
                </Link>
              </>
            ))}
        </div>
      </header>
      <ErrorNotice error={error} />
    </>
  );
}
export function PublicLayout() {
  const { pathname } = useLocation(),
    { t } = useLanguage();
  useEffect(() => {
    document.title =
      t(
        pathname === "/login"
          ? "auth.login"
          : pathname === "/signup"
            ? "Account for teachers"
            : "student.access",
      ) + " · PlaySheets";
  }, [pathname, t]);
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
    return (
      <div className="auth-page">
        <header className="auth-toolbar">
          <LanguageMenu />
        </header>
        <Outlet />
      </div>
    );
  }
  return (
    <>
      <PublicHeader minimal />
      <Outlet />
    </>
  );
}
export function Workspace() {
  const { user } = useSession(),
    { t } = useLanguage(),
    { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(
      () => readStorage("practica.sidebar.collapsed", "false") === "true",
    ),
    [drawer, setDrawer] = useState(false);
  const teacher = canTeach(user),
    editor = pathname.startsWith("/teacher/");
  const links = [
    { to: "/home", label: "Home", Icon: House },
    ...(teacher
      ? [{ to: "/sheets", label: "Worksheets", Icon: BookOpen }]
      : []),
    { to: "/classes", label: "Classes", Icon: Users },
    ...(user?.role === "TEACHER"
      ? [
          { to: "/students", label: "Students", Icon: Users },
          { to: "/space", label: "Teaching space", Icon: Settings },
        ]
      : []),
    { to: "/assignments", label: "Assignments", Icon: ClipboardList },
    ...(teacher
      ? [{ to: "/results", label: "Results", Icon: ChartNoAxesCombined }]
      : []),
  ];
  const active =
    links.find((link) => pathname.startsWith(link.to))?.label ??
    (editor ? "Worksheets" : "Account");
  const nav = (
    <>
      <SpaceSwitcher />
      <div className="nav-links">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={t(label)}
            onClick={() => setDrawer(false)}
            className={({ isActive }) =>
              "nav-link" +
              (isActive || (editor && to === "/sheets") ? " active" : "")
            }
          >
            <Icon size={20} />
            <span>{t(label)}</span>
          </NavLink>
        ))}
      </div>
      <div className="sidebar-bottom">
        <NavLink
          to="/account"
          className="nav-link"
          onClick={() => setDrawer(false)}
        >
          <Settings size={20} />
          <span>{t("Account")}</span>
        </NavLink>
        <div className="sidebar-person">
          <span className="avatar">{user?.name.charAt(0)}</span>
          <span>
            <strong>{user?.name}</strong>
            <small>{t(teacher ? "Teacher" : "Student")}</small>
          </span>
        </div>
      </div>
    </>
  );
  useEffect(() => {
    document.title = t(active) + " · PlaySheets";
  }, [active, t]);
  return (
    <div
      className={
        "workspace" +
        (collapsed ? " workspace--collapsed" : "") +
        (editor ? " workspace--editor" : "") +
        (!teacher ? " workspace--learner" : "")
      }
    >
      <aside className="sidebar">
        <Link to="/home" className="sidebar-brand">
          <Brand />
        </Link>
        <p className="nav-label">{t(teacher ? "Home" : "Continue learning")}</p>
        <nav id="desktop-navigation" aria-label={t("Home")}>
          {nav}
        </nav>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="actions">
            <Button
              className="desktop-nav-toggle"
              variant="ghost"
              aria-expanded={!collapsed}
              aria-controls="desktop-navigation"
              aria-label={t(collapsed ? "Open navigation" : "Close navigation")}
              onClick={() => {
                setCollapsed((value) => {
                  writeStorage("practica.sidebar.collapsed", String(!value));
                  return !value;
                });
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} />
              ) : (
                <PanelLeftClose size={20} />
              )}
            </Button>
            <Button
              className="mobile-nav-toggle"
              variant="ghost"
              aria-expanded={drawer}
              aria-label={t("Open navigation")}
              onClick={() => setDrawer(true)}
            >
              <MenuIcon size={20} />
            </Button>
            <span className="header-location">{t(active)}</span>
          </div>
          <LanguageMenu />
        </header>
        <Outlet />
      </div>
      <Modal
        open={drawer}
        onClose={() => setDrawer(false)}
        title={t("Home")}
        className="navigation-drawer"
      >
        <nav aria-label={t("Home")}>{nav}</nav>
      </Modal>
    </div>
  );
}
export function TeacherLayout() {
  return (
    <RequireSession teacher>
      <Workspace />
    </RequireSession>
  );
}
export function SessionLayout() {
  return (
    <RequireSession>
      <SessionWorkspace />
    </RequireSession>
  );
}
function SessionWorkspace() {
  const { user } = useSession();
  return canTeach(user) ? <Workspace /> : <StudentWorkspace />;
}
export function AttemptLayout() {
  const { user } = useSession();
  return (
    <RequireSession entry="/">
      {canTeach(user) ? (
        <Workspace />
      ) : (
        <>
          <StudentHeader />
          <div className="learner-main">
            <Outlet />
          </div>
        </>
      )}
    </RequireSession>
  );
}
export function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="empty-page">
      <BookOpen size={42} />
      <h1>{t("common.notFound")}</h1>
      <p>{t("common.notFoundCopy")}</p>
      <Link className="button button--primary" to="/home">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
export function RouteError() {
  const { t } = useLanguage();
  return (
    <main className="empty-page">
      <h1>{t("Something went wrong.")}</h1>
      <p>{t("Your changes are still on this device.")}</p>
      <Button onClick={() => window.location.reload()}>{t("Try again")}</Button>
    </main>
  );
}
export function RootLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div id="main-content">
        <Outlet />
      </div>
      <ScrollRestoration />
    </>
  );
}
