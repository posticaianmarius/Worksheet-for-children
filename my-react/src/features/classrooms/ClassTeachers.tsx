import { useState } from "react";
import { Resource, useResource } from "../../shared/resource";
import { useLanguage, useSession, useSpace } from "../../shared/runtime";
import type { Classroom } from "../../shared/types";
import { Button, ErrorNotice } from "../../shared/ui";
import { spacesApi } from "../spaces/api";
export default function ClassTeachers({ classroom }: { classroom: Classroom }) {
  const { context } = useSpace(),
    { user } = useSession(),
    { t } = useLanguage(),
    id = String(classroom.id);
  const query = useResource(["class-teachers", id], () =>
    spacesApi.classTeachers(id),
  );
  const team = useResource(["space-team"], () =>
    spacesApi.team(context!.spaceId!),
  );
  const [selection, setSelection] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const canManage =
    !classroom.archivedAt &&
    (context?.owner || user?.id === classroom.teacherId);
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel space-section class-teachers">
      <h2>{t("Class teachers")}</h2>
      <ErrorNotice error={error} />
      <Resource query={query}>
        {(teachers) => (
          <>
            {teachers.map((teacher) => (
              <div className="directory-row" key={teacher.userId}>
                <span>
                  {teacher.name}{" "}
                  {teacher.userId === classroom.teacherId
                    ? "· " + t("Lead teacher")
                    : ""}
                </span>
                {canManage && teacher.userId !== classroom.teacherId && (
                  <div className="actions">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            t("Make this teacher the lead teacher?"),
                          )
                        )
                          void action(async () => {
                            await spacesApi.classTeacher(
                              id,
                              teacher.userId,
                              true,
                            );
                            window.location.reload();
                          });
                      }}
                    >
                      {t("Make lead teacher")}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(() =>
                          spacesApi.removeClassTeacher(id, teacher.userId),
                        )
                      }
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {canManage && (
              <Resource query={team}>
                {(members) => (
                  <form
                    className="actions"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (selection)
                        void action(() =>
                          spacesApi.classTeacher(id, Number(selection)),
                        );
                    }}
                  >
                    <select
                      aria-label={t("Choose co-teacher")}
                      value={selection}
                      onChange={(e) => setSelection(e.target.value)}
                    >
                      <option value="">{t("Choose co-teacher")}</option>
                      {members
                        .filter(
                          (m) => !teachers.some((c) => c.userId === m.userId),
                        )
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                    <Button type="submit" disabled={!selection} busy={busy}>
                      {t("Add co-teacher")}
                    </Button>
                  </form>
                )}
              </Resource>
            )}
          </>
        )}
      </Resource>
    </section>
  );
}
