import "./worksheets.css";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Presentation, RefreshCw } from "lucide-react";
import { useLanguage, useSession } from "../../app/state";
import { api } from "../../shared/api";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
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
  const query = useResource(["share", worksheetId], () =>
    api.share(worksheetId),
  );
  const [replacing, setReplacing] = useState(false),
    [present, setPresent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  async function rotate() {
    setBusy(true);
    try {
      const result = await api.share(worksheetId, true);
      client.setQueryData([user?.id, "share", worksheetId], result);
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
    classes = useResource(["classes"], api.classes);
  const [classId, setClassId] = useState(classroomId ?? ""),
    [student, setStudent] = useState("all"),
    [selected, setSelected] = useState<number[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const members = useResource(["members", classId], () =>
    classId ? api.members(classId) : Promise.resolve([]),
  );
  async function assign() {
    if (!classId || busy || (student === "selected" && !selected.length))
      return;
    setBusy(true);
    try {
      await api.assign(
        worksheetId,
        student === "all"
          ? { classroomId: Number(classId) }
          : {
              classroomId: Number(classId),
              userIds: student === "selected" ? selected : [Number(student)],
            },
      );
      onClose();
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
      title={t("Assign worksheet")}
    >
      <ErrorNotice error={error} />
      <Resource query={classes}>
        {(items) => (
          <div className="form-stack">
            <label htmlFor="assign-class">{t("Class")}</label>
            <select
              id="assign-class"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStudent("all");
                setSelected([]);
              }}
            >
              <option value="">—</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <label htmlFor="assign-student">{t("Student")}</label>
            <select
              id="assign-student"
              value={student}
              disabled={!classId}
              onChange={(e) => setStudent(e.target.value)}
            >
              <option value="all">{t("Whole class")}</option>
              <option value="selected">{t("assignment.selected")}</option>
              {members.data?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
            {student === "selected" && (
              <fieldset className="recipient-selection">
                <legend>{t("assignment.selected")}</legend>
                {members.error && <ErrorNotice error={members.error} />}
                {members.data?.map((member) => (
                  <label className="check-field" key={member.userId}>
                    <input
                      type="checkbox"
                      checked={selected.includes(member.userId)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, member.userId]
                            : current.filter((id) => id !== member.userId),
                        )
                      }
                    />
                    {member.name}
                  </label>
                ))}
              </fieldset>
            )}
            <Button
              variant="primary"
              disabled={
                !classId || (student === "selected" && !selected.length)
              }
              busy={busy}
              onClick={() => void assign()}
            >
              {t("Assign")}
            </Button>
          </div>
        )}
      </Resource>
    </Modal>
  );
}
