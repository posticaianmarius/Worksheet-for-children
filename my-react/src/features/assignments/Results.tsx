import "./assignments.css";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Empty, Page, Status } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
export default function Results({
  classroomId,
  embedded = false,
}: {
  classroomId?: string;
  embedded?: boolean;
}) {
  const { t, language } = useLanguage(),
    [params] = useSearchParams();
  const [student, setStudent] = useState(""),
    [status, setStatus] = useState("");
  const query = useResource(["results"], () => api.report(true));
  const content = (
    <Resource query={query}>
      {(rows) => {
        const selected = rows.filter(
          (row) =>
            (!classroomId || String(row.classroomId) === classroomId) &&
            (!params.get("batch") || row.batchId === params.get("batch")),
        );
        const visible = selected.filter(
          (row) =>
            row.userName
              .toLocaleLowerCase(language)
              .includes(student.toLocaleLowerCase(language)) &&
            (!status ||
              (status === "COMPLETED"
                ? !!row.completedAt
                : row.status === status)),
        );
        return (
          <>
            <div className="results-overview">
              <strong>
                {t("assignment.progress", {
                  completed: selected.filter((row) => row.completedAt).length,
                  total: selected.length,
                })}
              </strong>
            </div>
            <div className="results-filters">
              <label>
                {t("Search students")}
                <input
                  type="search"
                  value={student}
                  onChange={(event) => setStudent(event.target.value)}
                />
              </label>
              <div className="results-filter">
                <label htmlFor="results-status">{t("Status")}</label>
                <select
                  id="results-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">{t("All")}</option>
                  {[
                    { value: "NOT_STARTED", label: "Not started" },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "REVOKED", label: "assignment.closedLabel" },
                  ].map(({ value, label }) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {visible.length ? (
              <div className="panel table-panel table-scroll">
                <table>
                  <caption>{t("results.caption")}</caption>
                  <thead>
                    <tr>
                      <th>{t("Student")}</th>
                      <th>{t("Worksheet")}</th>
                      <th>{t("Class")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Score")}</th>
                      <th>{t("History")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={row.assignmentId}>
                        <th scope="row">
                          {row.classroomId ? (
                            <Link
                              to={`/classes/${row.classroomId}/children/${row.userId}`}
                            >
                              {row.userName}
                            </Link>
                          ) : (
                            row.userName
                          )}
                        </th>
                        <td>
                          {row.worksheetName}
                          <small className="muted result-date">
                            {new Date(row.assignedAt).toLocaleDateString(
                              language === "ro" ? "ro-RO" : "en-GB",
                            )}
                          </small>
                        </td>
                        <td>{row.classroomName ?? "—"}</td>
                        <td>
                          {row.completedAt ? (
                            <Status value="COMPLETED" />
                          ) : row.removedAt ? (
                            <span className="status status--revoked">
                              {t("assignment.closedLabel")}
                            </span>
                          ) : (
                            <Status value={row.status} />
                          )}
                          {row.completedAt && row.removedAt && (
                            <small className="muted result-date">
                              {t("assignment.closedLabel")}
                            </small>
                          )}
                        </td>
                        <td>
                          {row.totalScore == null ? (
                            "—"
                          ) : row.attemptId ? (
                            <Link
                              aria-label={t("View {name}'s result", {
                                name: row.userName,
                              })}
                              to={"/attempts/" + row.attemptId}
                            >
                              {row.totalScore} / {row.maxScore}
                            </Link>
                          ) : (
                            row.totalScore + " / " + row.maxScore
                          )}
                        </td>
                        <td>
                          <Link to={"/assignments/" + row.assignmentId}>
                            {t("History")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty description={t("results.empty")} />
            )}
          </>
        );
      }}
    </Resource>
  );
  return embedded ? (
    content
  ) : (
    <Page title={t("Results")} subtitle={t("results.help")}>
      {content}
    </Page>
  );
}
