import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/runtime";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
import { worksheetsApi } from "./api";

/** Shared creation flow for the library and teacher dashboard. */
export function CreateWorksheet({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage(),
    navigate = useNavigate(),
    inputId = useId();
  const [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [finalFocus] = useState(() => ({
    current:
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
  }));
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const worksheet = await worksheetsApi.createWorksheet(name.trim());
      navigate("/teacher/" + worksheet.id);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t("Create worksheet")}
      finalFocus={finalFocus}
    >
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label htmlFor={inputId}>{t("Worksheet name")}</label>
        <input
          id={inputId}
          autoFocus
          required
          maxLength={150}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("For example: Animals and colours")}
          disabled={busy}
        />
        <ErrorNotice error={error} />
        <div className="actions end">
          <Button disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" type="submit" busy={busy}>
            {t("Create worksheet")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
