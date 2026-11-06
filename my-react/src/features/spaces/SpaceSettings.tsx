import { useState } from "react";
import { useLanguage, useSession } from "../../app/state";
import { Button, Confirm, ErrorNotice, Page } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { useSpace } from "./SpaceContext";
import { spacesApi } from "./api";
export default function SpaceSettings() {
  const { context, refresh } = useSpace(),
    { user } = useSession(),
    { t } = useLanguage(),
    space = context!.spaceId!;
  const query = useResource(["space-team"], () => spacesApi.team(space));
  const invitations = useResource(["space-invitations"], () =>
    context!.owner ? spacesApi.invitations(space) : Promise.resolve([]),
  );
  const [name, setName] = useState(
      context?.spaces.find((s) => s.id === space)?.name??"",
    ),
    [link, setLink] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [permissions, setPermissions] = useState<Record<number, boolean>>({});
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      await query.refetch();
      await invitations.refetch();
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setPermissions({});
    }
  }
  return (
    <Page
      title={t("Teaching space")}
      subtitle={t("Manage your team and student access.")}
    >
      <ErrorNotice error={error} />
      {notice && <p role="status">{notice}</p>}
      {context!.owner && (
        <section className="panel space-section">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action(() => spacesApi.rename(space, name));
            }}
          >
            <label htmlFor="space-name">{t("Space name")}</label>
            <input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={150}
            />
            <Button type="submit" busy={busy}>
              {t("Save")}
            </Button>
          </form>
        </section>
      )}
      <section className="panel space-section">
        <div className="section-toolbar">
          <h2>{t("Teaching team")}</h2>
          {context!.owner && (
            <Button
              variant="primary"
              busy={busy}
              onClick={() =>
                void action(async () => {
                  const invite = await spacesApi.invite(space);
                  setLink(window.location.origin + "/invite#" + invite.token);
                })
              }
            >
              {t("Invite teacher")}
            </Button>
          )}
        </div>
        <p className="muted">
          {t(
            "Student login access allows printing and resetting codes for the whole teaching space.",
          )}
        </p>
        {link && (
          <div className="invitation-link">
            <label htmlFor="invitation-url">
              {t("Single-use invitation · expires in 7 days")}
            </label>
            <input id="invitation-url" value={link} readOnly />
            <Button
              onClick={() =>
                void navigator.clipboard.writeText(link).then(
                  () => setNotice(t("Link copied")),
                  () => setNotice(t("Select the link and copy it manually.")),
                )
              }
            >
              {t("Copy link")}
            </Button>
          </div>
        )}
        <Resource query={query}>
          {(members) => (
            <div className="directory-list">
              {members.map((member) => (
                <article className="directory-row" key={member.userId}>
                  <div>
                    <strong>
                      {member.name}{" "}
                      {member.userId === user?.id ? t("(you)") : ""}
                    </strong>
                    <small>{member.email}</small>
                  </div>
                  <div className="actions">
                    {member.owner ? (
                      <span className="status">{t("Space owner")}</span>
                    ) : context!.owner ? (
                      <>
                        <label>
                          <input
                            type="checkbox"
                            checked={
                              permissions[member.userId] ??
                              member.manageStudentAccess
                            }
                            disabled={busy}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPermissions((current) => ({
                                ...current,
                                [member.userId]: checked,
                              }));
                              void action(() =>
                                spacesApi.permission(
                                  space,
                                  member.userId,
                                  checked,
                                ),
                              );
                            }}
                          />
                          {t("Student login access")}
                        </label>
                        <details className="row-menu">
                          <summary aria-label={t("Teacher actions")}>
                            •••
                          </summary>
                          <div>
                            <Confirm
                              title={t("Transfer space ownership?")}
                              description={t(
                                "This teacher will become the owner. You will remain a teacher.",
                              )}
                              onConfirm={() =>
                                action(() =>
                                  spacesApi.transfer(space, member.userId),
                                )
                              }
                            >
                              {(show) => (
                                <Button onClick={show}>
                                  {t("Make owner")}
                                </Button>
                              )}
                            </Confirm>
                            <Confirm
                              title={t("Remove teacher?")}
                              description={t(
                                "They will lose access to this space. Reassign their lead classes first.",
                              )}
                              onConfirm={() =>
                                action(() =>
                                  spacesApi.removeTeacher(space, member.userId),
                                )
                              }
                            >
                              {(show) => (
                                <Button variant="danger" onClick={show}>
                                  {t("Remove teacher")}
                                </Button>
                              )}
                            </Confirm>
                          </div>
                        </details>
                      </>
                    ) : (
                      <span>{t("Teacher")}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Resource>
      </section>
      {context!.owner && (
        <section className="panel space-section">
          <h2>{t("Invitations")}</h2>
          <Resource query={invitations}>
            {(items) => (
              <div>
                {items
                  .filter(
                    (i) =>
                      !i.usedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > new Date(),
                  )
                  .map((invite) => (
                    <div className="directory-row" key={invite.id}>
                      <span>
                        {t("Invitation")} #{invite.id} ·{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void action(() => spacesApi.revoke(space, invite.id))
                        }
                      >
                        {t("Revoke")}
                      </Button>
                    </div>
                  ))}
                {!items.some(
                  (i) =>
                    !i.usedAt &&
                    !i.revokedAt &&
                    new Date(i.expiresAt) > new Date(),
                ) && <p className="muted">{t("No active invitations.")}</p>}
              </div>
            )}
          </Resource>
        </section>
      )}
    </Page>
  );
}
