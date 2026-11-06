import "./auth.css";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, canTeach } from "../../shared/api";
import { Brand } from "../../shared/Brand";
import { useLanguage, useSession } from "../../app/state";
import { Button, ErrorNotice } from "../../shared/ui";
export default function AuthPage() {
  const { pathname, state } = useLocation(),
    signup = pathname === "/signup",
    { t } = useLanguage(),
    { refresh } = useSession(),
    navigate = useNavigate();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit() {
    if (busy) return;
    if (signup && password !== confirm) {
      setError(new Error(t("Passwords do not match.")));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = signup
        ? await api.signup(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      await refresh();
      const from = (state as { from?: string } | null)?.from;
      const safe =
        from?.startsWith("/") && !from.startsWith("//") ? from : undefined;
      navigate(safe ?? (canTeach(user) ? "/home" : "/student"), {
        replace: true,
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="auth-brand" to="/" aria-label={t("Play")}>
          <Brand />
        </Link>
        <h1 id="auth-title">
          {t(signup ? "Account for teachers" : "auth.login")}
        </h1>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {signup && (
            <div className="auth-field">
              <label htmlFor="name">{t("Username")}</label>
              <input
                id="name"
                autoComplete="nickname"
                placeholder={t("auth.nameExample")}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="email">{t("Email")}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailExample")}
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">{t("Password")}</label>
            <div className="password-field">
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder={t(
                  signup ? "auth.createPassword" : "auth.enterPassword",
                )}
                minLength={15}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
                aria-describedby={signup ? "password-hint" : undefined}
              />
              <Button
                variant="ghost"
                aria-label={t(visible ? "Hide password" : "Show password")}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
            {signup && (
              <small className="muted" id="password-hint">
                {t("auth.password")}
              </small>
            )}
          </div>
          {signup && (
            <div className="auth-field">
              <label htmlFor="confirmation">{t("Confirm password")}</label>
              <input
                id="confirmation"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("auth.repeatPassword")}
                minLength={15}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={busy}
              />
            </div>
          )}
          <ErrorNotice error={error} />
          <Button variant="primary" type="submit" busy={busy}>
            {t(signup ? "Create account" : "Log in")}
          </Button>
        </form>
        <p className="auth-switch">
          <Link className="text-link" to={signup ? "/login" : "/signup"}>
            {t(signup ? "Log in" : "Create account")}
          </Link>
        </p>
      </section>
    </main>
  );
}
