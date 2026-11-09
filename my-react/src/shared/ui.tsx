import { Button as BaseButton } from "@base-ui/react/button";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronDown,
  LoaderCircle,
  X,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "./runtime";
export function Button({
  children,
  className = "",
  variant = "secondary",
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <BaseButton
      {...props}
      className={"button button--" + variant + " " + className}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle className="spin" size={16} aria-hidden="true" />}
      {children}
    </BaseButton>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = "",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && dismissible) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup className={"dialog " + className}>
            <div className="dialog-heading">
              <Dialog.Title>{title}</Dialog.Title>
              {dismissible && (
                <Dialog.Close
                  render={<Button variant="ghost" aria-label={t("Close")} />}
                >
                  <X size={20} />
                </Dialog.Close>
              )}
            </div>
            {description && (
              <Dialog.Description className="muted">
                {description}
              </Dialog.Description>
            )}
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Dropdown({
  label,
  children,
  ariaLabel,
}: {
  label: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<Button aria-label={ariaLabel} />}>
        {label}
        <ChevronDown size={14} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} className="menu-positioner">
          <Menu.Popup className="menu-popup">{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
export function MenuAction({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Menu.Item className="menu-item" onClick={onClick} disabled={disabled}>
      {children}
    </Menu.Item>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  children,
  confirmLabel,
  confirmVariant = "danger",
}: {
  title: string;
  description?: string;
  onConfirm: () => Promise<unknown> | void;
  children: (open: () => void) => ReactNode;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {children(() => {
        setError(null);
        setOpen(true);
      })}
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={title}
        description={description}
      >
        <ErrorNotice error={error} />
        <div className="actions end">
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
          <Button
            variant={confirmVariant}
            busy={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel ?? t("Delete")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label id={id}>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
      {error && (
        <small role="alert" className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useLanguage();
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="notice notice--error" role="alert">
      <span>{t(message)}</span>
      {retry && <Button onClick={retry}>{t("Try again")}</Button>}
    </div>
  );
}
export function Loading() {
  const { t } = useLanguage();
  return (
    <div role="status" aria-label={t("Loading…")} className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>{t("Loading…")}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title?: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookOpen size={28} />
      </span>
      {title && <h2>{title}</h2>}
      <p className="muted">{description}</p>
      {children}
    </div>
  );
}
export function Page({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="page platformPage">
      <header className="page-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </header>
      {children}
    </main>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useLanguage();
  const labels: Record<string, string> = {
    COMPLETED: "Completed",
    IN_PROGRESS: "In progress",
    NOT_STARTED: "Not started",
    ASSIGNED: "Assigned",
    ACTIVE: "Active",
    REVOKED: "Revoked",
    ABANDONED: "Abandoned",
    SKIPPED: "Skipped",
    TEACHER: "Teacher",
    ADMIN: "Admin",
    USER: "Student",
  };
  return (
    <span className={"status status--" + value.toLowerCase()}>
      {value === "COMPLETED" && <Check size={13} />} {t(labels[value] || value)}
    </span>
  );
}
export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> / </span>}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
export function SortHeading({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th
      scope="col"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button className="sort-button" onClick={onClick}>
        {label}
        <ArrowUpDown size={13} />
      </button>
    </th>
  );
}
export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
