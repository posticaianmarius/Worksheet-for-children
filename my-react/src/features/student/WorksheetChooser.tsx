import { Link } from "react-router-dom";
import { useLanguage } from "../../shared/runtime";
import { assignmentsApi } from "../assignments/api";

import { Resource, useResource } from "../../shared/resource";
import { Modal } from "../../shared/ui";
export default function WorksheetChooser({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const { t, language } = useLanguage(),
    query = useResource(["worksheet-choices", code], () =>
      assignmentsApi.worksheetChoices(code),
    );
  return (
    <Modal open title={t("Choose your assignment")} onClose={onClose}>
      <Resource query={query}>
        {(choices) => (
          <div className="form-stack">
            {choices.map((choice) => (
              <Link
                className="button worksheet-choice"
                key={choice.assignmentId}
                to={"/assignments/" + choice.assignmentId}
                onClick={onClose}
              >
                <strong>
                  {choice.title || choice.worksheetName || t("Assignment")}
                </strong>
                <span>{choice.classroomName || t("Direct assignment")}</span>
                {choice.assignedAt && (
                  <small>
                    {new Date(choice.assignedAt).toLocaleString(
                      language === "ro" ? "ro-RO" : "en-GB",
                    )}
                  </small>
                )}
              </Link>
            ))}
            {!choices.length && (
              <p>{t("No current assignment matches this code.")}</p>
            )}
          </div>
        )}
      </Resource>
    </Modal>
  );
}
