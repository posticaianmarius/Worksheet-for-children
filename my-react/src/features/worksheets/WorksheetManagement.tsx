import { Pencil, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { useId, useRef, useState } from "react";
import { useLanguage } from "../../shared/runtime";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
import { worksheetsApi } from "./api";
import type {
  WorksheetAction,
  WorksheetManagementResult,
} from "./library-model";

export default function WorksheetManagement({
  action,
  onClose,
  onComplete,
  fallbackFocus,
}: {
  action: WorksheetAction;
  onClose: () => void;
  onComplete: (result: WorksheetManagementResult) => void;
  fallbackFocus: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [name, setName] = useState(action.sheet.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const finalFocusRef = useRef<HTMLElement | null>(action.returnFocus);
  const deleting = action.kind === "delete";
  const published =
    error instanceof Error &&
    error.message === "Published worksheets cannot be deleted.";
  async function submit() {
    if (
      lock.current ||
      published ||
      (!deleting && (!name.trim() || name.trim() === action.sheet.name))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const sheet = deleting
        ? undefined
        : await worksheetsApi.renameWorksheet(action.sheet.id, name.trim());
      if (deleting) await worksheetsApi.deleteWorksheet(action.sheet.id);
      finalFocusRef.current = fallbackFocus.current;
      const message = t(deleting ? "library.deleted" : "library.renamed", {
        name: deleting ? action.sheet.name : name.trim(),
      });
      if (sheet) onComplete({ kind: "rename", sheet, message });
      else onComplete({ kind: "delete", id: action.sheet.id, message });
    } catch (error) {
      setError(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => !lock.current && onClose()}
      finalFocus={finalFocusRef}
      className="worksheet-management-dialog"
      title={t(deleting ? "Delete this worksheet?" : "library.rename")}
      description={t(
        deleting
          ? "This removes the editable worksheet. This action cannot be undone."
          : "library.renameHelp",
      )}
    >
      <div
        className={
          "library-dialog-context" +
          (deleting ? " library-dialog-context--danger" : "")
        }
      >
        {deleting ? (
          <Trash2 size={21} aria-hidden="true" />
        ) : (
          <Pencil size={21} aria-hidden="true" />
        )}
        <strong>{action.sheet.name}</strong>
      </div>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {!deleting && (
          <>
            <label htmlFor={id}>{t("Worksheet name")}</label>
            <input
              id={id}
              autoFocus
              required
              maxLength={150}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </>
        )}
        <ErrorNotice error={error} />
        <div className="actions end">
          <Button disabled={busy} onClick={onClose}>
            {t(published ? "Close" : "Cancel")}
          </Button>
          {!published && (
            <Button
              type="submit"
              variant={deleting ? "danger" : "primary"}
              busy={busy}
              disabled={
                !deleting && (!name.trim() || name.trim() === action.sheet.name)
              }
            >
              {t(deleting ? "Delete worksheet" : "library.saveName")}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
