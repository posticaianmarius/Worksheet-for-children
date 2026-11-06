import { useState } from "react";
import { useLanguage } from "../../app/state";
import { Button, Confirm, Empty, ErrorNotice, Page } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import type { SpaceStudent } from "../../shared/types";
import { useSpace } from "./SpaceContext";
import { spacesApi } from "./api";
import { StudentPicker } from "./StudentPicker";
import { StudentAccess } from "./StudentAccess";
export default function Students() {
  const { context } = useSpace(),
    { t } = useLanguage(),
    space = context!.spaceId!;
  const query = useResource(["directory"], () => spacesApi.students(space));
  const [search, setSearch] = useState(""),
    [adding, setAdding] = useState(false),
    [access, setAccess] = useState<SpaceStudent | null>(null),
    [archived, setArchived] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <Page
      title={t("Students")}
      subtitle={t("One profile for every class in this teaching space.")}
      actions={
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t("Add students")}
        </Button>
      }
    >
      <div className="section-toolbar">
        <input
          type="search"
          aria-label={t("Search students")}
          placeholder={t("Search students")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          {t("Show archived students")}
        </label>
      </div>
      <ErrorNotice error={error} />
      <Resource query={query}>
        {(students) => (
          <div className="directory-list">
            {students
              .filter(
                (s) =>
                  (archived || !s.archivedAt) &&
                  s.name
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
              )
              .map((s) => (
                <article className="panel directory-row" key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <small className="muted">
                      #{s.id} {s.archivedAt ? t("Archived") : ""}
                    </small>
                  </div>
                  <div className="actions">
                    {!s.archivedAt && context!.manageStudentAccess && (
                      <Button onClick={() => setAccess(s)}>
                        {t("Login card")}
                      </Button>
                    )}
                    {!s.archivedAt && context!.owner && (
                      <details className="row-menu">
                        <summary aria-label={t("Student actions")}>•••</summary>
                        <div>
                          <Button
                            onClick={() => {
                              const name = window.prompt(
                                t("Student name"),
                                s.name,
                              );
                              if (name?.trim())
                                void spacesApi
                                  .updateStudent(space, s.id, name.trim())
                                  .then(() => query.refetch())
                                  .catch(setError);
                            }}
                          >
                            {t("Rename")}
                          </Button>
                          <Confirm
                            title={t("Archive student?")}
                            description={t(
                              "Their login will stop. Saved work remains available.",
                            )}
                            onConfirm={async () => {
                              await spacesApi.updateStudent(
                                space,
                                s.id,
                                undefined,
                                true,
                              );
                              await query.refetch();
                            }}
                          >
                            {(show) => (
                              <Button variant="danger" onClick={show}>
                                {t("Archive student")}
                              </Button>
                            )}
                          </Confirm>
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            {!students.length && <Empty description={t("No students yet.")} />}
          </div>
        )}
      </Resource>
      {adding && (
        <StudentPicker
          onClose={() => setAdding(false)}
          onAdded={() => void query.refetch()}
        />
      )}
      {access && (
        <StudentAccess student={access} onClose={() => setAccess(null)} />
      )}
    </Page>
  );
}
