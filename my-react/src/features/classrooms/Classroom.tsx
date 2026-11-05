import "./classrooms.css";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Copy, Play, Presentation } from "lucide-react";
import { useLanguage, useSession } from "../../app/state";
import { api, canTeach } from "../../shared/api";
import {
  Breadcrumbs,
  Button,
  Confirm,
  Empty,
  ErrorNotice,
  Modal,
  Page,
  SortHeading,
  Status,
} from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { useSort } from "../../shared/sorting";
import type { Member, Worksheet } from "../../shared/types";
export default function Classroom() {
  const { id = "" } = useParams(),
    { t, language } = useLanguage(),
    { user } = useSession(),
    teacher = canTeach(user);
  const query = useResource(["classroom", id], async () => {
    const [classroom, students, worksheets, assignments] = await Promise.all([
      api.classroom(id),
      teacher ? api.members(id) : Promise.resolve([]),
      teacher ? api.worksheets() : Promise.resolve([]),
      teacher ? Promise.resolve([]) : api.assignments(),
    ]);
    return { classroom, students, worksheets, assignments };
  });
  const sorting = useSort<Member>(
    "name",
    {
      name: (row) => row.name,
      test: (row) => row.lastTestPercent,
      average: (row) => row.averagePercent,
      worst: (row) => row.worstTest,
    },
    language,
  );
  const [student, setStudent] = useState<Partial<Member> | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [testOpen, setTestOpen] = useState(false),
    [search, setSearch] = useState(""),
    [testCode, setTestCode] = useState<{ name: string; code: string } | null>(
      null,
    ),
    [present, setPresent] = useState(false),
    [notice, setNotice] = useState("");
  function edit(item: Partial<Member> = {}) {
    setError(null);
    setStudent(item);
    setName(item.name ?? "");
  }
  async function saveStudent() {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      if (student?.userId)
        await api.renameStudent(id, student.userId, name.trim());
      else await api.addStudent(id, name.trim());
      setStudent(null);
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function startTest(sheet: Worksheet) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.startClassTest(id, sheet.id);
      setTestCode({ name: sheet.name, code: result.code });
      setTestOpen(false);
      await query.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(t("Code copied!"));
    } catch {
      setNotice(t("Could not copy the code. You can select it manually."));
    }
  }
  return (
    <Resource query={query}>
      {({ classroom, students, worksheets, assignments }) => (
        <Page
          title={classroom.name}
          subtitle={classroom.teacherName}
          actions={
            teacher && (
              <>
                <Button
                  onClick={() => {
                    setError(null);
                    setSearch("");
                    setTestOpen(true);
                  }}
                >
                  <Play size={16} />
                  {t("Start a test")}
                </Button>
                <Button variant="primary" onClick={() => edit()}>
                  <Plus size={17} />
                  {t("Add student")}
                </Button>
              </>
            )
          }
        >
          <Breadcrumbs
            items={[
              { label: t("Classes"), to: "/classes" },
              { label: t("Members") },
            ]}
          />
          {student === null && !testOpen && <ErrorNotice error={error} />}
          {testCode && (
            <section className="test-code-banner">
              <div>
                <span className="muted">{testCode.name}</span>
                <strong>{testCode.code}</strong>
                <small>{t("class.presentCopy")}</small>
              </div>
              <div className="actions">
                <Button onClick={() => void copy(testCode.code)}>
                  <Copy size={16} />
                  {t("Copy worksheet code")}
                </Button>
                <Button onClick={() => setPresent(true)}>
                  <Presentation size={16} />
                  {t("class.present")}
                </Button>
              </div>
            </section>
          )}
          {notice && <p role="status">{notice}</p>}
          {teacher ? (
            students.length ? (
              <section className="panel table-panel">
                <div className="table-scroll">
                  <table className="roster-table">
                    <caption className="visually-hidden">
                      {t("Members")}
                    </caption>
                    <thead>
                      <tr>
                        {[
                          ["name", "Name / code"],
                          ["test", "Last test"],
                          ["average", "Average"],
                          ["worst", "Lowest scoring test"],
                        ].map(([key, label]) => (
                          <SortHeading
                            key={key}
                            label={t(label)}
                            active={sorting.key === key}
                            direction={sorting.direction}
                            onClick={() => sorting.toggle(key)}
                          />
                        ))}
                        <th>{t("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorting.rows(students).map((item) => (
                        <tr className="student-block" key={item.userId}>
                          <th scope="row">
                            <Link
                              className="student-name-button"
                              to={"/classes/" + id + "/children/" + item.userId}
                            >
                              {item.name}
                            </Link>
                            {item.studentCode && (
                              <div className="student-access-code">
                                <code>{item.studentCode}</code>
                                <Button
                                  variant="ghost"
                                  aria-label={t("Copy {name}'s code", {
                                    name: item.name,
                                  })}
                                  onClick={() => void copy(item.studentCode!)}
                                >
                                  <Copy size={13} />
                                </Button>
                              </div>
                            )}
                          </th>
                          <td>
                            {item.lastTestPercent == null
                              ? "—"
                              : item.lastTestPercent + "%"}
                          </td>
                          <td>
                            {item.averagePercent == null
                              ? "—"
                              : item.averagePercent + "%"}
                          </td>
                          <td>{item.worstTest ?? "—"}</td>
                          <td>
                            <div className="actions">
                              {!item.email && (
                                <Button onClick={() => edit(item)}>
                                  {t("Rename")}
                                </Button>
                              )}
                              {!item.studentCode && (
                                <Button
                                  onClick={() =>
                                    void api
                                      .issueCode(id, item.userId)
                                      .then(() => query.refetch(), setError)
                                  }
                                >
                                  {t("Generate code")}
                                </Button>
                              )}
                              <Confirm
                                title={t("Remove the student from this class?")}
                                description={t(
                                  "Test access will be revoked. Results remain saved.",
                                )}
                                onConfirm={async () => {
                                  await api.removeMember(id, item.userId);
                                  await query.refetch();
                                }}
                              >
                                {(show) => (
                                  <Button variant="ghost" onClick={show}>
                                    {t("Delete")}
                                  </Button>
                                )}
                              </Confirm>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <Empty
                description={t(
                  "No students in this class. Add your first student.",
                )}
              />
            )
          ) : (
            <section className="panel">
              <h2>{t("Assignments")}</h2>
              {assignments
                .filter((item) => item.classroomId === Number(id))
                .map((item) => (
                  <Link
                    className="list-row"
                    to={"/assignments/" + item.id}
                    key={item.id}
                  >
                    <strong>{item.worksheet.name}</strong>
                    <Status value={item.status} />
                  </Link>
                ))}
            </section>
          )}
          <Modal
            open={student !== null}
            onClose={() => !busy && setStudent(null)}
            title={t(student?.userId ? "Rename student" : "New student")}
          >
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void saveStudent();
              }}
            >
              <label htmlFor="student-name">{t("Student name")}</label>
              <input
                id="student-name"
                required
                maxLength={100}
                value={name}
                autoFocus
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
              <ErrorNotice error={error} />
              <div className="actions end">
                <Button onClick={() => setStudent(null)}>{t("Cancel")}</Button>
                <Button type="submit" variant="primary" busy={busy}>
                  {t("Save")}
                </Button>
              </div>
            </form>
          </Modal>
          <Modal
            open={testOpen}
            onClose={() => !busy && setTestOpen(false)}
            title={t("Start a test")}
          >
            <input
              type="search"
              aria-label={t("Search for a test")}
              placeholder={t("Search for a test")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ErrorNotice error={error} />
            <div className="form-stack">
              {worksheets
                .filter((sheet) =>
                  sheet.name
                    .toLocaleLowerCase(language)
                    .includes(search.toLocaleLowerCase(language)),
                )
                .map((sheet) => (
                  <Button
                    key={sheet.id}
                    disabled={busy || !students.length || !sheet.items.length}
                    onClick={() => void startTest(sheet)}
                  >
                    {sheet.name}
                  </Button>
                ))}
            </div>
            {!students.length && (
              <p>{t("Add students before starting a test.")}</p>
            )}
            {!worksheets.length && <p>{t("Create a worksheet first.")}</p>}
          </Modal>
          <Modal
            open={present}
            onClose={() => setPresent(false)}
            title={testCode?.name ?? t("Worksheet code")}
            className="presentation-dialog"
          >
            <div className="presentation-code">{testCode?.code}</div>
            <p>{t("class.presentCopy")}</p>
          </Modal>
        </Page>
      )}
    </Resource>
  );
}
