import "./classrooms.css";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, Plus, Trash2, Users } from "lucide-react";
import { useLanguage, useSession } from "../../app/state";
import { api, canTeach } from "../../shared/api";
import {
  Button,
  Confirm,
  Empty,
  ErrorNotice,
  Modal,
  Page,
} from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
export default function Classes() {
  const { t } = useLanguage(),
    { user } = useSession(),
    teacher = canTeach(user),
    navigate = useNavigate(),
    query = useResource(["classes"], api.classes);
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function submit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      const classroom = teacher
        ? await api.createClass(value.trim())
        : await api.joinClass(value);
      navigate("/classes/" + classroom.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={t("Classes")}
      subtitle={t("dashboard.subtitle")}
      actions={
        <Button
          variant="primary"
          onClick={() => {
            setValue("");
            setError(null);
            setOpen(true);
          }}
        >
          <Plus size={17} />
          {t(teacher ? "New class" : "Join class")}
        </Button>
      }
    >
      <Resource query={query}>
        {(items) =>
          items.length ? (
            <div className="class-grid">
              {items.map((item) => (
                <article className="panel classListCard" key={item.id}>
                  <span className="feature-icon">
                    <Users size={24} />
                  </span>
                  <Link to={"/classes/" + item.id}>
                    <h2>{item.name}</h2>
                    <span className="muted">{item.teacherName}</span>
                    <span className="text-link">
                      {t("Open class")}
                      <ArrowUpRight size={16} />
                    </span>
                  </Link>
                  {teacher && (
                    <Confirm
                      title={t("Delete this class?")}
                      description={t(
                        "Student access will stop. Saved results remain available in history.",
                      )}
                      onConfirm={async () => {
                        await api.deleteClass(item.id);
                        await query.refetch();
                      }}
                    >
                      {(show) => (
                        <Button
                          variant="ghost"
                          aria-label={t("Delete class {name}", {
                            name: item.name,
                          })}
                          onClick={show}
                        >
                          <Trash2 size={17} />
                        </Button>
                      )}
                    </Confirm>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty description={t("No classes yet.")} />
          )
        }
      </Resource>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t(teacher ? "New class" : "Join class")}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="class-value">
            {t(teacher ? "Class name" : "Class code")}
          </label>
          <input
            id="class-value"
            required
            maxLength={100}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            placeholder={t(teacher ? "Class name" : "Class code")}
          />
          <ErrorNotice error={error} />
          <Button variant="primary" type="submit" busy={busy}>
            {t(teacher ? "New class" : "Join class")}
          </Button>
        </form>
      </Modal>
    </Page>
  );
}
export function LegacyClass() {
  const { className, kidName } = useParams();
  const query = useResource(["legacy-class", className, kidName], async () => {
    const classroom = (await api.classes()).find(
      (item) => item.name === className,
    );
    if (!classroom) throw new Error("Class not found.");
    if (!kidName) return "/classes/" + classroom.id;
    const student = (await api.members(classroom.id)).find(
      (item) => item.name === kidName,
    );
    if (!student) throw new Error("Student not found.");
    return "/classes/" + classroom.id + "/children/" + student.userId;
  });
  return (
    <Resource query={query}>{(to) => <Navigate to={to} replace />}</Resource>
  );
}
