import "./classrooms.css";
import { Link, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Brand } from "../../shared/Brand";
import { Button, Empty, Page } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
export default function AccessCards() {
  const { id = "" } = useParams(),
    { t } = useLanguage();
  const query = useResource(["access-cards", id], async () => ({
    classroom: await api.classroom(id),
    members: await api.members(id),
  }));
  return (
    <div className="access-page">
      <Page
        title={t("class.accessCards")}
        actions={
          <div className="actions access-toolbar">
            <Link className="button" to={"/classes/" + id}>
              {t("Back")}
            </Link>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={17} />
              {t("class.printCards")}
            </Button>
          </div>
        }
      >
        <Resource query={query}>
          {({ classroom, members }) =>
            members.length ? (
              <div className="access-card-grid">
                {members.map((member) => (
                  <article className="access-card" key={member.userId}>
                    <Brand />
                    <h2>{member.name}</h2>
                    <p>{classroom.name}</p>
                    <p className="muted">{t("Student code")}</p>
                    <strong className="access-code">
                      {member.studentCode ?? t("class.noCode")}
                    </strong>
                    <p>{window.location.origin}</p>
                    <small>{t("class.keepCodePrivate")}</small>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                description={t(
                  "No students in this class. Add your first student.",
                )}
              />
            )
          }
        </Resource>
      </Page>
    </div>
  );
}
