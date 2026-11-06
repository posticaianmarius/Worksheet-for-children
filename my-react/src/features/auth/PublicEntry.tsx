import "./auth.css";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage, useSession } from "../../app/state";
import { pendingWork } from "../assignments/DeliveryEntry";
import { api, canTeach, ApiError } from "../../shared/api";
import { Brand } from "../../shared/Brand";
import { Button, ErrorNotice } from "../../shared/ui";
export default function PublicEntry() {
  const { t } = useLanguage(),
    { user, refresh } = useSession(),
    navigate = useNavigate();
  const [qrCode] = useState(() => {
    try {
      return window.location.hash.startsWith("#student-code=")
        ? decodeURIComponent(window.location.hash.slice(14))
        : "";
    } catch {
      return "";
    }
  });
  const qrStarted = useRef(false);
  const [studentCode, setStudentCode] = useState(qrCode),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(!!qrCode),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!qrCode || qrStarted.current) return;
    qrStarted.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void api
      .studentLogin(qrCode)
      .then(() => window.location.replace(pendingWork() ?? "/student"))
      .catch((e) => {
        setError(e);
        setBusy(false);
      });
  }, [qrCode]);
  async function join() {
    if (busy) return;
    if (!studentCode.trim()) {
      setError(new Error(t("student.enterCode")));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!code.trim()) {
        await api.studentLogin(studentCode);
        await refresh();
        navigate(pendingWork() ?? "/student", { replace: true });
        return;
      }
      const joined = await api.enterGame(studentCode, code);
      await refresh();
      const history = await api.history(joined.assignmentId);
      const attempt =
        history.find((item) => item.status === "IN_PROGRESS") ??
        (await api.start(joined.assignmentId));
      navigate("/attempts/" + attempt.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && code.trim()) {
        try {
          await api.studentLogin(studentCode);
          sessionStorage.setItem("playsheets.worksheet-choice", code.trim());
          await refresh();
          navigate("/student", { replace: true });
          return;
        } catch (error) {
          setError(error);
        }
      } else setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="join-title">
        <Link className="auth-brand" to="/" aria-label="PlaySheets">
          <Brand />
        </Link>
        <h1 id="join-title">{t("student.access")}</h1>
        <p className="muted entry-help">{t("student.accessHelp")}</p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <div className="auth-field">
            <label htmlFor="student-code">{t("Student code")}</label>
            <input
              id="student-code"
              placeholder={t("student.codeExample")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              value={studentCode}
              onChange={(event) =>
                setStudentCode(event.target.value.toUpperCase())
              }
              disabled={busy}
              required
            />
          </div>
          <details className="entry-shortcut">
            <summary>{t("student.shortcut")}</summary>
            <div className="auth-field">
              <label htmlFor="worksheet-code">{t("Worksheet code")}</label>
              <input
                id="worksheet-code"
                placeholder={t("student.worksheetCodeExample")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={9}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                disabled={busy}
              />
            </div>
          </details>
          <ErrorNotice error={error} />
          <Button type="submit" variant="primary" busy={busy}>
            {t(code.trim() ? "Check and start" : "Continue")}
          </Button>
        </form>
        <p className="auth-switch">
          <Link className="text-link" to={canTeach(user) ? "/home" : "/login"}>
            {t(canTeach(user) ? "Home" : "Teacher login")}
          </Link>
          {user?.role === "USER" && (
            <Link className="text-link" to="/student">
              {t("student.work")}
            </Link>
          )}
        </p>
      </section>
    </main>
  );
}
