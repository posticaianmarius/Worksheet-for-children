import "./classrooms.css";

import { lazy, Suspense, useState } from "react";

import { Link, useParams, useSearchParams } from "react-router-dom";

import { useLanguage } from "../../shared/runtime";

import { assignmentsApi } from "../assignments/api";
import { classroomsApi } from "./api";

import { Breadcrumbs, Button, Empty, Loading, Page } from "../../shared/ui";

import { Resource, useResource } from "../../shared/resource";

import type { Classroom as ClassroomType } from "../../shared/types";

import { StudentPicker } from "../spaces/StudentPicker";

import AssignmentLauncher from "../assignments/AssignmentLauncher";

import ClassRoster from "./ClassRoster";

import ClassTeachers from "./ClassTeachers";

const TeacherAssignments = lazy(
  () => import("../assignments/TeacherAssignments"),
);

const Results = lazy(() => import("../assignments/Results"));

export default function Classroom() {
  const { id = "" } = useParams(),
    { t } = useLanguage(),
    [params] = useSearchParams();

  const tab = params.get("tab") ?? "overview",
    query = useResource(["class", id], () => classroomsApi.classroom(id));

  return (
    <Resource query={query}>
      {(classroom) => (
        <Page title={classroom.name} subtitle={classroom.teacherName}>
          <Breadcrumbs
            items={[
              { label: t("Classes"), to: "/classes" },
              { label: classroom.name },
            ]}
          />

          {classroom.archivedAt && (
            <p className="notice">{t("Archived class · read-only history")}</p>
          )}

          <nav className="class-tabs" aria-label={t("Class sections")}>
            {["overview", "students", "assignments", "progress"].map((key) => (
              <Link
                key={key}
                to={"?tab=" + key}
                aria-current={tab === key ? "page" : undefined}
              >
                {t(
                  {
                    overview: "Overview",
                    students: "Students",
                    assignments: "Assignments",
                    progress: "Progress",
                  }[key]!,
                )}
              </Link>
            ))}
          </nav>

          <Suspense fallback={<Loading />}>
            {tab === "overview" ? (
              <Overview classroom={classroom} />
            ) : tab === "students" ? (
              <ClassRoster classroom={classroom} />
            ) : tab === "assignments" ? (
              <TeacherAssignments
                embedded
                classroomId={id}
                readOnly={!!classroom.archivedAt}
              />
            ) : tab === "progress" ? (
              <Results embedded classroomId={id} />
            ) : (
              <Empty description={t("Choose a class section.")} />
            )}
          </Suspense>
        </Page>
      )}
    </Resource>
  );
}

function Overview({ classroom }: { classroom: ClassroomType }) {
  const { t } = useLanguage(),
    id = String(classroom.id),
    [adding, setAdding] = useState(false),
    [assigning, setAssigning] = useState(false);

  const members = useResource(["class-members", id], () =>
    classroomsApi.members(id),
  );

  const report = useResource(["class-report", id], () =>
    assignmentsApi.report(true, id),
  );

  return (
    <>
      <div className="class-summary">
        <section className="panel">
          <span>{t("Students")}</span>
          <Resource query={members}>
            {(rows) => <strong>{rows.filter((m) => !m.leftAt).length}</strong>}
          </Resource>
        </section>
        <section className="panel">
          <span>{t("Assignments")}</span>
          <Resource query={report}>
            {(rows) => (
              <strong>
                {
                  new Set(
                    rows.filter((r) => !r.removedAt).map((r) => r.batchId),
                  ).size
                }
              </strong>
            )}
          </Resource>
        </section>
        <section className="panel">
          <span>{t("Completed")}</span>
          <Resource query={report}>
            {(rows) => (
              <strong>{rows.filter((r) => r.completedAt).length}</strong>
            )}
          </Resource>
        </section>
      </div>

      {!classroom.archivedAt && (
        <section className="panel space-section">
          <h2>
            {t(
              !members.data?.some((m) => !m.leftAt)
                ? "Set up your class"
                : "Ready for the next activity?",
            )}
          </h2>
          <p className="muted">
            {t(
              "Add students from your teaching space, then assign a worksheet.",
            )}
          </p>
          <div className="class-overview-actions">
            <Button
              variant={
                !members.data?.some((m) => !m.leftAt) ? "primary" : "secondary"
              }
              onClick={() => setAdding(true)}
            >
              {t("Add students")}
            </Button>
            <Button
              variant={
                members.data?.some((m) => !m.leftAt) ? "primary" : "secondary"
              }
              disabled={!members.data?.some((m) => !m.leftAt)}
              onClick={() => setAssigning(true)}
            >
              {t("Assign worksheet")}
            </Button>
            <Link className="button" to="?tab=progress">
              {t("View progress")}
            </Link>
          </div>
        </section>
      )}

      <ClassTeachers classroom={classroom} />

      {adding && (
        <StudentPicker
          classroomId={id}
          onClose={() => setAdding(false)}
          onAdded={() => void members.refetch()}
        />
      )}

      {assigning && (
        <AssignmentLauncher
          classroomId={id}
          onClose={() => {
            setAssigning(false);
            void report.refetch();
          }}
        />
      )}
    </>
  );
}
