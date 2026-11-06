import "./classrooms.css";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Breadcrumbs, Page, Empty, SortHeading, Status } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { percentage, timestamp, useSort } from "../../shared/sorting";
import type { StudentTest } from "../../shared/types";
import { gameModules } from "../../games/registry";
export default function Student() {
  const { id = "", userId = "" } = useParams(),
    { t, language } = useLanguage();
  const query = useResource(["student", id, userId], async () => {
    const [classroom, student, tests] = await Promise.all([
      api.classroom(id),
      api.student(id, userId),
      api.studentTests(id, userId),
    ]);
    return { classroom, student, tests };
  });
  const sorting = useSort<StudentTest>(
    "date",
    {
      name: (row) => row.name,
      result: (row) =>
        row.status === "COMPLETED"
          ? percentage(row.totalScore, row.maxScore)
          : null,
      date: (row) => timestamp(row.completedAt ?? row.startedAt),
    },
    language,
    "desc",
  );
  return (
    <Resource query={query}>
      {({ classroom, student, tests }) => (
        <Page title={student.name} subtitle={classroom.name}>
          <Breadcrumbs
            items={[
              { label: t("Classes"), to: "/classes" },
              { label: t("Members"), to: "/classes/" + id },
              { label: t("Tests") },
            ]}
          />
          {tests.length ? (
            <section className="panel table-panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        ["name", "Test"],
                        ["result", "Result"],
                        ["date", "Date"],
                      ].map(([key, label]) => (
                        <SortHeading
                          key={key}
                          label={t(label)}
                          active={sorting.key === key}
                          direction={sorting.direction}
                          onClick={() => sorting.toggle(key)}
                        />
                      ))}
                      <th>{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorting.rows(tests).map((test) => (
                      <tr className="test-grid" key={test.attemptId}>
                        <th scope="row">
                          <Link
                            to={
                              "/classes/" +
                              id +
                              "/children/" +
                              userId +
                              "/tests/" +
                              test.attemptId
                            }
                          >
                            {test.name}
                          </Link>
                        </th>
                        <td>
                          {test.status === "COMPLETED"
                            ? test.totalScore + " / " + test.maxScore
                            : "—"}
                        </td>
                        <td>
                          {new Date(
                            test.completedAt ?? test.startedAt ?? "",
                          ).toLocaleDateString(
                            language === "ro" ? "ro-RO" : "en-GB",
                          )}
                        </td>
                        <td>
                          <Status value={test.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <Empty
              description={t("This student has not started a test yet.")}
            />
          )}
        </Page>
      )}
    </Resource>
  );
}
export function StudentResult() {
  const { id = "", userId = "", attemptId = "" } = useParams(),
    { t } = useLanguage();
  const query = useResource(
    ["student-result", id, userId, attemptId],
    async () => {
      const tests = await api.studentTests(id, userId),
        test = tests.find((item) => item.attemptId === Number(attemptId));
      if (!test)
        throw new Error(t("This test does not belong to this student."));
      return { test, attempt: await api.attempt(attemptId) };
    },
  );
  return (
    <Resource query={query}>
      {({ test, attempt }) => (
        <Page title={test.name} subtitle={t("report.activities")}>
          <Breadcrumbs
            items={[
              { label: t("Classes"), to: "/classes" },
              { label: t("Members"), to: "/classes/" + id },
              {
                label: t("Tests"),
                to: "/classes/" + id + "/children/" + userId,
              },
              { label: t("report.activities") },
            ]}
          />
          <section className="panel">
            <div className="result-total">
              {attempt.totalScore} <span>/ {attempt.maxScore}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Activity")}</th>
                    <th>{t("Game")}</th>
                    <th>{t("Result")}</th>
                    <th>{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {attempt.items.map((item, index) => {
                    const result = attempt.results.find(
                      (entry) => entry.revisionItemId === item.id,
                    );
                    return (
                      <tr key={item.id}>
                        <th scope="row">
                          {t("Activity")} {index + 1}
                        </th>
                        <td>
                          {t(
                            gameModules[item.definition?.type ?? ""]
                              ?.titleKey ??
                              item.definition?.name ??
                              "Unavailable activity",
                          )}
                        </td>
                        <td>
                          {result
                            ? result.score + " / " + result.maxScore
                            : "—"}
                        </td>
                        <td>
                          <Status value={result?.outcome ?? "NOT_STARTED"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </Page>
      )}
    </Resource>
  );
}
