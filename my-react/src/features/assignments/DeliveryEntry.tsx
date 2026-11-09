import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useLanguage, useSession } from "../../shared/runtime";
import { assignmentsApi } from "./api";

import { Resource, useResource } from "../../shared/resource";
import { Page } from "../../shared/ui";
export default function DeliveryEntry() {
  const { batchId = "" } = useParams(),
    { user } = useSession(),
    { t } = useLanguage();
  const query = useResource(["delivery", batchId], () =>
    user ? assignmentsApi.delivery(batchId) : Promise.resolve([]),
  );
  useEffect(() => {
    if (!user && /^[a-f0-9-]{36}$/i.test(batchId)) {
      try {
        sessionStorage.setItem("playsheets.pending-work", "/work/" + batchId);
      } catch {
        /* optional storage */
      }
    }
  }, [user, batchId]);
  if (!user)
    return (
      <Page
        title={t("Open your assignment")}
        subtitle={t("Sign in with your private student code to continue.")}
      >
        <Link className="button button--primary" to="/">
          {t("Student login")}
        </Link>
        <Link
          className="button"
          to="/login"
          state={{ from: "/work/" + batchId }}
        >
          {t("Teacher login")}
        </Link>
      </Page>
    );
  return (
    <Resource query={query}>
      {(rows) =>
        user.role === "USER" && rows[0] ? (
          <Navigate replace to={"/assignments/" + rows[0].id} />
        ) : (
          <Page
            title={
              rows[0]?.deliveryTitle ||
              rows[0]?.worksheet.name ||
              t("Assignment")
            }
            subtitle={rows[0]?.classroomName ?? undefined}
          >
            <p>
              {rows.length} {t("Students")}
            </p>
            <Link
              className="button button--primary"
              to={"/results?batch=" + batchId}
            >
              {t("View progress")}
            </Link>
          </Page>
        )
      }
    </Resource>
  );
}
