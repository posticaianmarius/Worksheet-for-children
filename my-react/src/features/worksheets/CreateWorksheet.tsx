import { useId, useRef, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../shared/runtime";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
import { worksheetsApi } from "./api";
import "./creation.css";

/** Shared creation flow for the library and teacher dashboard. */
export function CreateWorksheet({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage(),
    navigate = useNavigate(),
    inputId = useId(),
    lock = useRef(false);
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
    if (lock.current || !name.trim()) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const worksheet = await worksheetsApi.createWorksheet(name.trim());
      navigate("/teacher/" + worksheet.id);
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
      title={t("Create worksheet")}
      finalFocus={finalFocus}
      className="create-worksheet-dialog"
      description={t("library.createHelp")}
    >
      <ol
        className="worksheet-create-steps"
        aria-label={t("library.createSteps")}
      >
        <li aria-current="step">
          <span aria-hidden="true">1</span>
          <strong>{t("library.nameStep")}</strong>
        </li>
        <li>
          <span aria-hidden="true">2</span>
          <strong>{t("library.labStep")}</strong>
        </li>
      </ol>
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
          aria-describedby={inputId + "-hint"}
        />
        <p className="worksheet-name-hint" id={inputId + "-hint"}>
          {t("library.nameHint")}
        </p>
        <div className="worksheet-create-next">
          <BookOpen size={20} aria-hidden="true" />
          <div>
            <strong>{t("library.nextLab")}</strong>
            <p>{t("library.nextLabHelp")}</p>
          </div>
        </div>
        <ErrorNotice error={error} />
        <div className="actions end">
          <Button disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            busy={busy}
            disabled={!name.trim()}
          >
            {t("Create worksheet")}
            <ArrowRight size={17} aria-hidden="true" />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
