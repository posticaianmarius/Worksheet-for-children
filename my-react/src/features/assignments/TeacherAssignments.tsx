import "./assignments.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import {
  Button,
  Confirm,
  Empty,
  ErrorNotice,
  Modal,
  Page,
  Status,
} from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { AssignDialog } from "../worksheets/Sharing";
import { deliveries } from "./deliveries";
export default function TeacherAssignments({
  classroomId,
  embedded = false,
  readOnly = false,
}: {
  classroomId?: string;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const { t, language } = useLanguage();
  const [history, setHistory] = useState(readOnly),
    [choose, setChoose] = useState(false),
    [worksheet, setWorksheet] = useState<number | null>(null),
    [error, setError] = useState<unknown>(null);
  const query = useResource(["deliveries", history, classroomId], () =>
    api.report(history, classroomId),
  );
  const sheets = useResource(["assign-worksheets", choose], () =>
    choose ? api.worksheets() : Promise.resolve([]),
  );
  const actions = (
    <div className="actions">
      <Button onClick={() => setHistory((value) => !value)}>
        {t(history ? "assignment.active" : "assignment.closed")}
      </Button>
      {!readOnly && (
        <Button variant="primary" onClick={() => setChoose(true)}>
          <Plus size={17} />
          {t("Assign worksheet")}
        </Button>
      )}
    </div>
  );
  const content = (
    <>
      {embedded && (
        <div className="section-heading">
          <h2>{t("Assignments")}</h2>
          {actions}
        </div>
      )}
      <ErrorNotice error={error} />
      <Resource query={query}>
        {(rows) => {
          const groups = deliveries(
            rows.filter(
              (row) =>
                (!classroomId || String(row.classroomId) === classroomId) &&
                (history ? !!row.removedAt : !row.removedAt),
            ),
          );
          return groups.length ? (
            <div className="delivery-list">
              {groups.map((group) => (
                <article className="panel delivery-card" key={group.id}>
                  <div>
                    <h2>
                      {group.first.deliveryTitle || group.first.worksheetName}
                    </h2>
                    {group.first.deliveryTitle && (
                      <p>{group.first.worksheetName}</p>
                    )}
                    <p className="muted">
                      {group.first.classroomName ?? t("Direct assignments")} ·{" "}
                      {t("Version {number}", {
                        number: group.first.revisionNumber,
                      })}
                    </p>
                    <p className="muted">
                      {new Date(group.first.assignedAt).toLocaleString(
                        language === "ro" ? "ro-RO" : "en-GB",
                        { dateStyle: "medium", timeStyle: "short" },
                      )}{" "}
                      ·{" "}
                      {t(
                        group.rows.length === 1
                          ? "assignment.recipient"
                          : "assignment.recipients",
                        { count: group.rows.length },
                      )}
                    </p>
                  </div>
                  <div className="delivery-progress">
                    <strong>
                      {group.completed} / {group.rows.length}
                    </strong>
                    <span className="muted">{t("Completed")}</span>
                  </div>
                  <div className="actions">
                    <Link
                      className="button"
                      to={"/results?batch=" + encodeURIComponent(group.id)}
                    >
                      {t("Results")}
                    </Link>
                    {!group.removed && group.first.batchId && (
                      <Button
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(
                              window.location.origin + "/work/" + group.id,
                            )
                            .catch(setError)
                        }
                      >
                        {t("Copy assignment link")}
                      </Button>
                    )}
                    {group.removed ? (
                      <Status value="REVOKED" />
                    ) : readOnly ? null : (
                      <Confirm
                        title={t("assignment.closeTitle")}
                        confirmLabel={t("assignment.close")}
                        description={t("assignment.closeHelp")}
                        onConfirm={async () => {
                          if (group.first.batchId)
                            await api.removeAssignmentBatch(group.id);
                          else
                            await api.removeAssignmentGroup(
                              classroomId ??
                                String(group.first.classroomId ?? "direct"),
                              group.first.revisionId,
                            );
                          await query.refetch();
                        }}
                      >
                        {(show) => (
                          <Button variant="ghost" onClick={show}>
                            {t("assignment.close")}
                          </Button>
                        )}
                      </Confirm>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty description={t("No assignments yet.")} />
          );
        }}
      </Resource>
      <Modal
        open={choose}
        onClose={() => setChoose(false)}
        title={t("Assign worksheet")}
      >
        <Resource query={sheets}>
          {(items) =>
            items.length ? (
              <div className="list">
                {items
                  .filter((item) => item.items.length)
                  .map((item) => (
                    <Button
                      key={item.id}
                      onClick={() => {
                        setChoose(false);
                        setWorksheet(item.id);
                      }}
                    >
                      <BookOpen size={18} />
                      {item.name}
                    </Button>
                  ))}
                {!items.some((item) => item.items.length) && (
                  <p>{t("assignment.addActivity")}</p>
                )}
              </div>
            ) : (
              <Empty
                description={t(
                  "No worksheets yet. Create your first worksheet to begin.",
                )}
              >
                <Link className="button" to="/sheets">
                  {t("Open worksheets")}
                </Link>
              </Empty>
            )
          }
        </Resource>
      </Modal>
      <AssignDialog
        worksheetId={worksheet}
        classroomId={classroomId}
        onClose={() => {
          setWorksheet(null);
          void query.refetch().catch(setError);
        }}
      />
    </>
  );
  return embedded ? (
    content
  ) : (
    <Page
      title={t("Assignments")}
      subtitle={t("assignment.help")}
      actions={actions}
    >
      {content}
    </Page>
  );
}
