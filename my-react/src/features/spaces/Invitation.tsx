import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage, useSession } from "../../app/state";
import { Brand } from "../../shared/Brand";
import { Button, ErrorNotice } from "../../shared/ui";
import { useSpace } from "./SpaceContext";
import { spacesApi } from "./api";
export function pendingInvitation() {
  try {
    return sessionStorage.getItem("playsheets.invitation") ?? undefined;
  } catch {
    return undefined;
  }
}
export function clearInvitation() {
  try {
    sessionStorage.removeItem("playsheets.invitation");
  } catch {
    /* optional storage */
  }
}
export default function Invitation() {
  const { t } = useLanguage(),
    { user } = useSession(),
    { switchSpace } = useSpace(),
    navigate = useNavigate();
  const [token] = useState(() => {
    const value = window.location.hash.slice(1) || pendingInvitation() || "";
    if (value) {
      try {
        sessionStorage.setItem("playsheets.invitation", value);
      } catch {
        /* optional storage */
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
    return value;
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function accept() {
    setBusy(true);
    try {
      const result = await spacesApi.accept(token);
      await switchSpace(result.spaceId);
      clearInvitation();
      navigate("/home", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <Brand />
        <h1>{t("Join a teaching space")}</h1>
        <p className="muted">
          {t("Your personal classes stay separate when you join a team.")}
        </p>
        <ErrorNotice error={error} />
        {!token ? (
          <p>{t("This invitation is missing or has already been accepted.")}</p>
        ) : user ? (
          <Button
            variant="primary"
            busy={busy}
            disabled={user.role !== "TEACHER"}
            onClick={() => void accept()}
          >
            {t("Join teaching space")}
          </Button>
        ) : (
          <div className="form-stack">
            <Link
              className="button button--primary"
              to="/login"
              state={{ from: "/invite" }}
            >
              {t("Teacher login")}
            </Link>
            <Link className="button" to="/signup" state={{ from: "/invite" }}>
              {t("Create teacher account")}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
