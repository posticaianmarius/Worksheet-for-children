import "./classrooms.css";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Button, Empty, ErrorNotice, Loading, Page } from "../../shared/ui";
import type { AccessCard } from "../../shared/types";
import { useSpace } from "../spaces/SpaceContext";
import { spacesApi } from "../spaces/api";
import { LoginCard } from "../spaces/StudentAccess";
export default function AccessCards() {
  const { id = "" } = useParams(),
    { t } = useLanguage(),
    { context } = useSpace();
  const [cards, setCards] = useState<AccessCard[] | null>(null),
    [error, setError] = useState<unknown>(null);
  const space = context?.spaceId,
    permitted = context?.manageStudentAccess;
  useEffect(() => {
    let active = true;
    if (!permitted) return;
    void api
      .members(id)
      .then((members) =>
        Promise.all(
          members
            .filter((m) => !m.leftAt && m.studentId)
            .map((m) => spacesApi.credential(space!, m.studentId!)),
        ),
      )
      .then((value) => {
        if (active) setCards(value);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [id, space, permitted]);
  return (
    <div className="access-page">
      <Page
        title={t("class.accessCards")}
        actions={
          <div className="actions access-toolbar">
            <Link className="button" to={"/classes/" + id + "?tab=students"}>
              {t("Back")}
            </Link>
            <Button
              variant="primary"
              disabled={!cards?.length}
              onClick={() => window.print()}
            >
              {t("class.printCards")}
            </Button>
          </div>
        }
      >
        <ErrorNotice error={error} />
        {!permitted ? (
          <p>{t("Ask the space owner for student login access.")}</p>
        ) : cards === null && !error ? (
          <Loading />
        ) : cards?.length ? (
          <div className="access-card-grid print-card-area">
            {cards.map((card) => (
              <LoginCard key={card.studentId} card={card} />
            ))}
          </div>
        ) : (
          <Empty description={t("No students yet.")} />
        )}
      </Page>
    </div>
  );
}
