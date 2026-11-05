import "./auth.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage, useSession } from "../../app/state";
import { api, canTeach } from "../../shared/api";
import { Button, ErrorNotice } from "../../shared/ui";
export default function PublicEntry() {
  const { t } = useLanguage(),
    { user, refresh } = useSession(),
    navigate = useNavigate();
  const [studentCode, setStudentCode] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function join() {
    if (busy) return;
    if (!studentCode.trim() || !code.trim()) {
      setError(
        new Error(
          t("Enter your code and the worksheet code from your teacher."),
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const joined = await api.enterGame(studentCode, code);
      await refresh();
      const history = await api.history(joined.assignmentId);
      const attempt =
        history.find((item) => item.status === "IN_PROGRESS") ??
        (await api.start(joined.assignmentId));
      navigate("/attempts/" + attempt.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="entry">
      <section className="entry-card" aria-labelledby="join-title">
        <h1 id="join-title">{t("Play")}</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
          className="form-stack"
        >
          <label htmlFor="student-code">{t("Student code")}</label>
          <input
            id="student-code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
            disabled={busy}
          />
          <label htmlFor="worksheet-code">{t("Worksheet code")}</label>
          <input
            id="worksheet-code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={busy}
          />
          <ErrorNotice error={error} />
          <Button type="submit" variant="primary" busy={busy}>
            {t("Check and start")}
          </Button>
        </form>
        <p className="auth-switch">
          <Link to={canTeach(user) ? "/home" : "/login"} className="text-link">
            {t(canTeach(user) ? "My classes" : "Teacher login")}
          </Link>
        </p>
      </section>
    </main>
  );
}
