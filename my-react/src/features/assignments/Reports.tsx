import { BookOpen, Copy, Trash2, Users } from "lucide-react";
import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useLanguage } from "../../shared/runtime";
import { classroomsApi } from "../classrooms/api";
import { assignmentsApi } from "./api";
import "./assignments.css";

import { Resource, useResource } from "../../shared/resource";
import { percentage, timestamp, useSort } from "../../shared/sorting";
import type { ReportRow } from "../../shared/types";
import {
  Breadcrumbs,
  Button,
  Confirm,
  Empty,
  Page,
  SortHeading,
  Status,
} from "../../shared/ui";
import { groupAssignmentReport } from "./report-model";
interface ReportWorksheet extends ReportRow {
  id: string;
  rows: ReportRow[];
  recipients: ReportRow[];
  completedCount: number;
  removed: boolean;
}
interface ReportGroup {
  id: string;
  name: string;
  worksheets: ReportWorksheet[];
}
export default function Reports() {
  const { t, language } = useLanguage(),
    { classId, revisionId } = useParams(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    history = params.get("history") === "1",
    suffix = history ? "?history=1" : "";
  const [notice, setNotice] = useState("");
  const query = useResource(["assignment-report", history], async () => {
    const [classes, rows] = await Promise.all([
      classroomsApi.classes(),
      assignmentsApi.report(history),
    ]);
    return groupAssignmentReport(
      history ? [] : classes,
      history ? rows.filter((row) => row.removedAt != null) : rows,
    ) as ReportGroup[];
  });
  const sorting = useSort<ReportRow>(
    "name",
    {
      name: (row) => row.userName,
      assigned: (row) => timestamp(row.assignedAt),
      completed: (row) => timestamp(row.completedAt),
      score: (row) => percentage(row.totalScore, row.maxScore),
    },
    language,
  );
  const date = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString(
          language === "ro" ? "ro-RO" : "en-GB",
        )
      : "—";
  const name = (group: ReportGroup) =>
    group.id === "direct" ? t("Direct assignments") : group.name;
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(t("Code copied!"));
    } catch {
      setNotice(t("Could not copy the code. You can select it manually."));
    }
  }
  function removeButton(worksheet: ReportWorksheet) {
    return worksheet.removed ? (
      <Status value="Deleted" />
    ) : (
      <Confirm
        title={t("Delete this homework?")}
        description={t(
          "Student access will stop. Saved results remain available in history.",
        )}
        onConfirm={async () => {
          await assignmentsApi.removeAssignmentGroup(
            classId ?? "direct",
            worksheet.id,
          );
          await query.refetch();
          if (revisionId) navigate("/assignments/classes/" + classId);
        }}
      >
        {(show) => (
          <Button
            variant="ghost"
            aria-label={t("Delete homework {name}, version {version}", {
              name: worksheet.worksheetName,
              version: worksheet.revisionNumber,
            })}
            onClick={show}
          >
            <Trash2 size={17} />
          </Button>
        )}
      </Confirm>
    );
  }
  function codeBlock(worksheet: ReportWorksheet) {
    return (
      <div className="assignmentWorksheetCode">
        <small className="muted">{t("Worksheet code")}</small>
        {worksheet.worksheetCode ? (
          <div className="actions">
            <code>{worksheet.worksheetCode}</code>
            <Button
              variant="ghost"
              aria-label={t("Copy {name}'s worksheet code", {
                name: worksheet.worksheetName,
              })}
              onClick={() => void copy(worksheet.worksheetCode!)}
            >
              <Copy size={14} />
              {t("Copy")}
            </Button>
          </div>
        ) : (
          <strong>
            {t(
              worksheet.codeStatus === "VERSION_CHANGED"
                ? "Code replaced"
                : "No active code",
            )}
          </strong>
        )}
      </div>
    );
  }
  return (
    <Resource query={query}>
      {(groups) => {
        const group = groups.find((item) => item.id === classId),
          worksheet = group?.worksheets.find((item) => item.id === revisionId),
          classUrl = "/assignments/classes/" + classId;
        return (
          <Page
            title={
              worksheet?.worksheetName ??
              (group ? name(group) : t("Assignments"))
            }
            actions={
              <Button
                onClick={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    if (history) next.delete("history");
                    else next.set("history", "1");
                    return next;
                  })
                }
              >
                {t(history ? "Hide deleted homework" : "Show deleted homework")}
              </Button>
            }
          >
            {classId && (
              <Breadcrumbs
                items={[
                  { label: t("Assignments"), to: "/assignments" + suffix },
                  ...(group
                    ? [
                        {
                          label: name(group),
                          to: revisionId ? classUrl + suffix : undefined,
                        },
                      ]
                    : []),
                  ...(worksheet ? [{ label: worksheet.worksheetName }] : []),
                ]}
              />
            )}
            {notice && <p role="status">{notice}</p>}
            {classId && !group ? (
              <Empty description={t("Class not found.")} />
            ) : revisionId && !worksheet ? (
              <Empty description={t("Assignment not found.")} />
            ) : worksheet ? (
              <section className="panel table-panel">
                <div className="report-summary">
                  {codeBlock(worksheet)}
                  <strong>
                    {t("{completed} / {total} completed", {
                      completed: worksheet.completedCount,
                      total: worksheet.recipients.length,
                    })}
                  </strong>
                  {removeButton(worksheet)}
                </div>
                <div className="assignmentTableScroll table-scroll">
                  <table className="assignmentResultsTable">
                    <caption>{t("Latest completed score")}</caption>
                    <thead>
                      <tr>
                        <SortHeading
                          label={t("Student")}
                          active={sorting.key === "name"}
                          direction={sorting.direction}
                          onClick={() => sorting.toggle("name")}
                        />
                        <SortHeading
                          label={t("Assigned")}
                          active={sorting.key === "assigned"}
                          direction={sorting.direction}
                          onClick={() => sorting.toggle("assigned")}
                        />
                        <th>{t("Status")}</th>
                        <SortHeading
                          label={t("Score")}
                          active={sorting.key === "score"}
                          direction={sorting.direction}
                          onClick={() => sorting.toggle("score")}
                        />
                        <SortHeading
                          label={t("Completed on")}
                          active={sorting.key === "completed"}
                          direction={sorting.direction}
                          onClick={() => sorting.toggle("completed")}
                        />
                        <th>{t("History")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorting.rows(worksheet.recipients).map((student) => (
                        <tr key={student.userId}>
                          <th scope="row">{student.userName}</th>
                          <td>{date(student.assignedAt)}</td>
                          <td>
                            <Status value={student.status} />
                          </td>
                          <td>
                            {student.totalScore == null ? (
                              "—"
                            ) : student.attemptId ? (
                              <Link
                                aria-label={t("View {name}'s result", {
                                  name: student.userName,
                                })}
                                to={"/attempts/" + student.attemptId}
                              >
                                {student.totalScore} / {student.maxScore}
                              </Link>
                            ) : (
                              student.totalScore + " / " + student.maxScore
                            )}
                          </td>
                          <td>{date(student.completedAt)}</td>
                          <td>
                            <Link
                              aria-label={t("View {name}'s history", {
                                name: student.userName,
                              })}
                              to={"/assignments/" + student.assignmentId}
                            >
                              {t("History")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : group ? (
              group.worksheets.length ? (
                <section className="panel assignmentWorksheets">
                  {group.worksheets.map((item) => (
                    <article className="assignmentWorksheetRow" key={item.id}>
                      <Link
                        className="assignmentWorksheetLink"
                        to={classUrl + "/worksheets/" + item.id + suffix}
                      >
                        <span className="feature-icon">
                          <BookOpen size={20} />
                        </span>
                        <div>
                          <h2>{item.worksheetName}</h2>
                          <span className="muted">
                            {t("Version {number}", {
                              number: item.revisionNumber,
                            })}
                          </span>
                        </div>
                        <span>
                          {t("{completed} / {total} completed", {
                            completed: item.completedCount,
                            total: item.recipients.length,
                          })}
                        </span>
                      </Link>
                      {codeBlock(item)}
                      {removeButton(item)}
                    </article>
                  ))}
                </section>
              ) : (
                <Empty description={t("No assignments yet.")} />
              )
            ) : groups.length ? (
              <div className="class-grid assignmentClasses">
                {groups.map((item) => (
                  <Link
                    key={item.id}
                    className="panel assignmentClassCard"
                    to={"/assignments/classes/" + item.id + suffix}
                  >
                    <span className="feature-icon">
                      <Users size={24} />
                    </span>
                    <h2>{name(item)}</h2>
                    <p className="muted">
                      {t(
                        item.worksheets.length === 1
                          ? "{count} worksheet"
                          : "{count} worksheets",
                        { count: item.worksheets.length },
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                description={t(
                  history ? "No deleted homework." : "No classes yet.",
                )}
              />
            )}
          </Page>
        );
      }}
    </Resource>
  );
}
