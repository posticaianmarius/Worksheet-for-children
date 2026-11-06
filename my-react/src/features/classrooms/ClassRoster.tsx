import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Button, Confirm, Empty, SortHeading } from "../../shared/ui";
import { useSort } from "../../shared/sorting";
import { Resource, useResource } from "../../shared/resource";
import type { Classroom, Member, SpaceStudent } from "../../shared/types";
import { useSpace } from "../spaces/SpaceContext";
import { StudentPicker } from "../spaces/StudentPicker";
import { StudentAccess } from "../spaces/StudentAccess";
export default function ClassRoster({ classroom }: { classroom: Classroom }) {
  const { t, language } = useLanguage(),
    { context } = useSpace(),
    id = String(classroom.id);
  const sorting = useSort<Member>("name", { name: (m) => m.name }, language);
  const query = useResource(["class-members", id], () => api.members(id));
  const [search, setSearch] = useState(""),
    [former, setFormer] = useState(!!classroom.archivedAt),
    [adding, setAdding] = useState(false),
    [card, setCard] = useState<SpaceStudent | null>(null);
  function actions(member: Member) {
    return (
      <div className="actions">
        <Link
          className="button"
          to={"/classes/" + id + "/children/" + member.userId}
        >
          {t("Progress")}
        </Link>
        {!classroom.archivedAt && !member.leftAt && (
          <details className="row-menu">
            <summary aria-label={t("Student actions")}>•••</summary>
            <div>
              {context?.manageStudentAccess && member.studentId && (
                <Button
                  onClick={() =>
                    setCard({
                      id: member.studentId!,
                      userId: member.userId,
                      name: member.name,
                      archivedAt: null,
                    })
                  }
                >
                  {t("Login card")}
                </Button>
              )}
              <Confirm
                title={t("Remove from class?")}
                description={t(
                  "Their other classes and saved results will remain available.",
                )}
                confirmLabel={t("Remove from class")}
                onConfirm={async () => {
                  await api.removeMember(id, member.userId);
                  await query.refetch();
                }}
              >
                {(show) => (
                  <Button variant="danger" onClick={show}>
                    {t("Remove from class")}
                  </Button>
                )}
              </Confirm>
            </div>
          </details>
        )}
      </div>
    );
  }
  return (
    <section>
      <div className="section-toolbar">
        <h2>{t("Students")}</h2>
        {!classroom.archivedAt && (
          <div className="actions">
            {context?.manageStudentAccess && (
              <Link className="button" to={"/classes/" + id + "/access-cards"}>
                {t("class.accessCards")}
              </Link>
            )}
            <Button variant="primary" onClick={() => setAdding(true)}>
              {t("Add students")}
            </Button>
          </div>
        )}
      </div>
      <div className="section-toolbar">
        <input
          type="search"
          value={search}
          aria-label={t("Search students")}
          placeholder={t("Search students")}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={former}
            onChange={(e) => setFormer(e.target.checked)}
          />
          {t("Show former students")}
        </label>
      </div>
      <Resource query={query}>
        {(all) => {
          const items = sorting.rows(
            all.filter(
              (m) =>
                (former || !m.leftAt) &&
                m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
            ),
          );
          return items.length ? (
            <>
              <div className="panel table-panel roster-desktop">
                <table>
                  <thead>
                    <tr>
                      <SortHeading
                        label={t("Student")}
                        active={sorting.key === "name"}
                        direction={sorting.direction}
                        onClick={() => sorting.toggle("name")}
                      />
                      <th>{t("Status")}</th>
                      <th>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((member) => (
                      <tr key={member.userId}>
                        <td>
                          <Link
                            to={"/classes/" + id + "/children/" + member.userId}
                          >
                            {member.name}
                          </Link>
                          <small className="muted"> #{member.studentId}</small>
                        </td>
                        <td>
                          {t(member.leftAt ? "Former student" : "Active")}
                        </td>
                        <td>{actions(member)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="roster-mobile">
                {items.map((member) => (
                  <article className="panel" key={member.userId}>
                    <strong>{member.name}</strong>
                    <p className="muted">
                      {t(member.leftAt ? "Former student" : "Active")}
                    </p>
                    {actions(member)}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <Empty description={t("No students yet.")} />
          );
        }}
      </Resource>
      {adding && (
        <StudentPicker
          classroomId={id}
          onClose={() => setAdding(false)}
          onAdded={() => void query.refetch()}
        />
      )}
      {card && <StudentAccess student={card} onClose={() => setCard(null)} />}
    </section>
  );
}
