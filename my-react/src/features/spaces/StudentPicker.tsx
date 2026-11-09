import { useMemo, useState } from "react";
import { Resource, useResource } from "../../shared/resource";
import { useLanguage, useSpace } from "../../shared/runtime";
import { Button, ErrorNotice, Modal } from "../../shared/ui";

import { spacesApi } from "./api";
export function StudentPicker({
  classroomId,
  onClose,
  onAdded,
}: {
  classroomId?: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { context } = useSpace(),
    { t } = useLanguage(),
    space = context!.spaceId!;
  const directory = useResource(["directory"], () => spacesApi.students(space));
  const [names, setNames] = useState(""),
    [preview, setPreview] = useState(false),
    [choices, setChoices] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const rows = useMemo(
    () =>
      names
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    [names],
  );
  const exact = (name: string) =>
    (directory.data ?? []).filter(
      (s) =>
        !s.archivedAt &&
        s.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await spacesApi.bulk(
        space,
        rows.map((name, i) => {
          const matches = exact(name),
            choice =
              choices[i] ??
              (matches.length === 1
                ? String(matches[0].id)
                : matches.length
                  ? ""
                  : "new");
          if (!choice)
            throw new Error(
              t("Choose an existing student or confirm a new child."),
            );
          return choice === "new"
            ? { name, allowDuplicate: matches.length > 0 }
            : { studentId: Number(choice) };
        }),
        classroomId ? Number(classroomId) : undefined,
      );
      onAdded();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={t("Add students")} onClose={() => !busy && onClose()}>
      <ErrorNotice error={error} />
      <Resource query={directory}>
        {(students) => (
          <>
            {!preview ? (
              <div className="form-stack">
                <label htmlFor="student-names">
                  {t("Student names, one per line")}
                </label>
                <textarea
                  id="student-names"
                  rows={5}
                  value={names}
                  maxLength={20200}
                  onChange={(e) => setNames(e.target.value)}
                  placeholder={t("Ana Popescu\nMihai Ionescu")}
                />
                <p className="muted">
                  {t(
                    "We will look for existing students before creating profiles.",
                  )}
                </p>
                {rows.length === 1 && (
                  <div className="directory-matches">
                    {students
                      .filter(
                        (s) =>
                          !s.archivedAt &&
                          s.name
                            .toLocaleLowerCase()
                            .includes(rows[0].toLocaleLowerCase()),
                      )
                      .slice(0, 8)
                      .map((s) => (
                        <Button
                          key={s.id}
                          onClick={() => {
                            setNames(s.name);
                            setChoices({ 0: String(s.id) });
                            setPreview(true);
                          }}
                        >
                          {s.name}
                          <small>#{s.id}</small>
                        </Button>
                      ))}
                  </div>
                )}
                <Button
                  variant="primary"
                  disabled={!rows.length || rows.length > 200}
                  onClick={() => setPreview(true)}
                >
                  {t("Review students")}
                </Button>
              </div>
            ) : (
              <div className="form-stack">
                <p>{t("Review each student before adding them.")}</p>
                {rows.map((name, i) => (
                  <label className="student-preview-row" key={i}>
                    <strong>{name}</strong>
                    <select
                      aria-label={t("Profile for {name}", { name })}
                      value={
                        choices[i] ??
                        (exact(name).length === 1
                          ? String(exact(name)[0].id)
                          : exact(name).length
                            ? ""
                            : "new")
                      }
                      onChange={(e) =>
                        setChoices({ ...choices, [i]: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        {t("Choose a profile")}
                      </option>
                      {exact(name).map((s) => (
                        <option key={s.id} value={s.id}>
                          {t("Use existing student")} — {s.name} #{s.id}
                        </option>
                      ))}
                      <option value="new">
                        {t(
                          exact(name).length
                            ? "Create another child with this name"
                            : "Create new student",
                        )}
                      </option>
                    </select>
                  </label>
                ))}
                <div className="actions">
                  <Button disabled={busy} onClick={() => setPreview(false)}>
                    {t("Back")}
                  </Button>
                  <Button
                    variant="primary"
                    busy={busy}
                    onClick={() => void submit()}
                  >
                    {t("Add students")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Resource>
    </Modal>
  );
}
