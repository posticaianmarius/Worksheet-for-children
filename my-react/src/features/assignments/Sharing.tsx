import { useQueryClient } from "@tanstack/react-query";
import { Copy, Presentation, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage, useSession, useSpace } from "../../shared/runtime";
import type { Worksheet } from "../../shared/types";
import { classroomsApi } from "../classrooms/api";
import { assignmentsApi } from "./api";
import "./sharing.css";

import { Resource, useResource } from "../../shared/resource";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
export function ShareDialog({
  worksheetId,
  onClose,
}: {
  worksheetId: number | null;
  onClose: () => void;
}) {
  return worksheetId !== null ? (
    <ShareContent
      key={worksheetId}
      worksheetId={worksheetId}
      onClose={onClose}
    />
  ) : null;
}
function ShareContent({
  worksheetId,
  onClose,
}: {
  worksheetId: number;
  onClose: () => void;
}) {
  const { t } = useLanguage(),
    { user } = useSession(),
    client = useQueryClient();
  const { context } = useSpace();
  const query = useResource(["share", worksheetId], () =>
    assignmentsApi.share(worksheetId),
  );
  const [replacing, setReplacing] = useState(false),
    [present, setPresent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  async function rotate() {
    setBusy(true);
    try {
      const result = await assignmentsApi.share(worksheetId, true);
      client.setQueryData(
        [user?.id, context?.spaceId, "share", worksheetId],
        result,
      );
      setReplacing(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t("Share worksheet")}
      description={t(
        "This code opens a saved version. Later edits do not change what children receive.",
      )}
    >
      <ErrorNotice error={error} />
      <Resource query={query}>
        {(value) => {
          const code = value.shareCode ?? value.code ?? "";
          return (
            <>
              <div className="share-code">
                <span className="muted">{t("Worksheet code")}</span>
                <h2>{code}</h2>
              </div>
              <div className="actions">
                <Button
                  onClick={() =>
                    void navigator.clipboard.writeText(code).then(
                      () => setNotice(t("Code copied!")),
                      () =>
                        setNotice(
                          t(
                            "Could not copy the code. You can select it manually.",
                          ),
                        ),
                    )
                  }
                >
                  <Copy size={16} />
                  {t("Copy code")}
                </Button>
                <Button onClick={() => setPresent(true)}>
                  <Presentation size={16} />
                  {t("class.present")}
                </Button>
              </div>
              <p className="muted">
                {t(
                  "Give each child their personal code and this worksheet code.",
                )}
              </p>
              <Button variant="ghost" onClick={() => setReplacing(true)}>
                <RefreshCw size={16} />
                {t("Publish latest and replace code")}
              </Button>
              {notice && <p role="status">{notice}</p>}
              <Modal
                open={present}
                onClose={() => setPresent(false)}
                title={t("Worksheet code")}
                className="presentation-dialog"
              >
                <div className="presentation-code">{code}</div>
                <p>{t("class.presentCopy")}</p>
              </Modal>
            </>
          );
        }}
      </Resource>
      <Modal
        open={replacing}
        onClose={() => !busy && setReplacing(false)}
        title={t("Replace the worksheet code?")}
        description={t(
          "The old code will stop working. Existing assignments keep their original version.",
        )}
      >
        <ErrorNotice error={error} />
        <div className="actions">
          <Button onClick={() => setReplacing(false)}>{t("Cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={() => void rotate()}>
            {t("Publish latest and replace code")}
          </Button>
        </div>
      </Modal>
    </Modal>
  );
}
export function AssignDialog({
  worksheetId,
  onClose,
  classroomId,
}: {
  worksheetId: number | null;
  onClose: () => void;
  classroomId?: string;
}) {
  return worksheetId !== null ? (
    <AssignContent
      worksheetId={worksheetId}
      classroomId={classroomId}
      onClose={onClose}
    />
  ) : null;
}
function AssignContent({
  worksheetId,
  onClose,
  classroomId,
}: {
  worksheetId: number;
  onClose: () => void;
  classroomId?: string;
}) {
  const { t } = useLanguage(),
    navigate = useNavigate(),
    classes = useResource(["classes"], classroomsApi.classes);
  const [classId, setClassId] = useState(classroomId ?? ""),
    [mode, setMode] = useState("all"),
    [selected, setSelected] = useState<number[]>([]),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [preview, setPreview] = useState<{
      revisionId: number;
      worksheet: Worksheet;
    } | null>(null);
  const members = useResource(["assignment-members", classId], () =>
    classId ? classroomsApi.members(classId) : Promise.resolve([]),
  );
  const active = (members.data ?? []).filter((m) => !m.leftAt),
    recipients =
      mode === "all"
        ? active
        : active.filter((m) => selected.includes(m.userId));
  async function review() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await assignmentsApi.assignmentPreview(worksheetId));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (!preview || busy) return;
    setBusy(true);
    setError(null);
    try {
      await assignmentsApi.assign(worksheetId, {
        classroomId: Number(classId),
        ...(mode === "selected" ? { userIds: selected } : {}),
        title: title.trim() || undefined,
        revisionId: preview.revisionId,
      });
      onClose();
      navigate("/classes/" + classId + "?tab=assignments");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={t(preview ? "Review assignment" : "Choose recipients")}
      onClose={() => !busy && onClose()}
    >
      <ErrorNotice error={error} />
      {preview ? (
        <div className="form-stack">
          <dl className="assignment-review">
            <div>
              <dt>{t("Worksheet")}</dt>
              <dd>{preview.worksheet.name}</dd>
            </div>
            <div>
              <dt>{t("Class")}</dt>
              <dd>
                {classes.data?.find((c) => String(c.id) === classId)?.name}
              </dd>
            </div>
            <div>
              <dt>{t("Students")}</dt>
              <dd>
                {recipients.length} · {recipients.map((m) => m.name).join(", ")}
              </dd>
            </div>
            <div>
              <dt>{t("Activities")}</dt>
              <dd>{preview.worksheet.items.length}</dd>
            </div>
          </dl>
          <p className="muted">
            {t(
              "This saved version will be assigned. Later edits will not change it.",
            )}
          </p>
          <label htmlFor="delivery-title">
            {t("Assignment title (optional)")}
          </label>
          <input
            id="delivery-title"
            value={title}
            maxLength={150}
            placeholder={t("e.g. Monday number practice")}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="actions">
            <Button disabled={busy} onClick={() => setPreview(null)}>
              {t("Back")}
            </Button>
            <Button
              variant="primary"
              busy={busy}
              disabled={!preview.worksheet.items.length || !recipients.length}
              onClick={() => void assign()}
            >
              {t("Assign worksheet")}
            </Button>
          </div>
        </div>
      ) : (
        <Resource query={classes}>
          {(items) => (
            <div className="form-stack">
              <label htmlFor="assign-class">{t("Class")}</label>
              <select
                id="assign-class"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSelected([]);
                }}
              >
                <option value="">{t("Choose class")}</option>
                {items
                  .filter((c) => !c.archivedAt)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <Resource query={members}>
                {() => (
                  <>
                    <label htmlFor="recipient-mode">{t("Recipients")}</label>
                    <select
                      id="recipient-mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="all">{t("Whole class")}</option>
                      <option value="selected">
                        {t("assignment.selected")}
                      </option>
                    </select>
                    {mode === "selected" && (
                      <fieldset className="recipient-selection">
                        <legend>{t("assignment.selected")}</legend>
                        {active.map((m) => (
                          <label className="check-field" key={m.userId}>
                            <input
                              type="checkbox"
                              checked={selected.includes(m.userId)}
                              onChange={(e) =>
                                setSelected((current) =>
                                  e.target.checked
                                    ? [...current, m.userId]
                                    : current.filter((id) => id !== m.userId),
                                )
                              }
                            />
                            {m.name}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </>
                )}
              </Resource>
              <Button
                variant="primary"
                busy={busy}
                disabled={!classId || !recipients.length}
                onClick={() => void review()}
              >
                {t("Review assignment")}
              </Button>
            </div>
          )}
        </Resource>
      )}
    </Modal>
  );
}
