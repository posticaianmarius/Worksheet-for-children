import "./worksheets.css";
import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Share2,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import {
  Button,
  Confirm,
  Empty,
  ErrorNotice,
  Modal,
  Page,
} from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { ShareDialog } from "./Sharing";
export default function Library() {
  const { t, language } = useLanguage(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [share, setShare] = useState<number | null>(null);
  const query = useResource(["worksheets"], api.worksheets),
    search = params.get("q") ?? "",
    sort = params.get("sort") ?? "recent";
  function filter(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const sheet = await api.createWorksheet(name.trim());
      navigate("/teacher/" + sheet.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title={t("My worksheets")}
      subtitle={t("library.subtitle")}
      actions={
        <Button
          variant="primary"
          onClick={() => {
            setName("");
            setError(null);
            setOpen(true);
          }}
        >
          <Plus size={18} />
          {t("New worksheet")}
        </Button>
      }
    >
      <div className="filter-bar">
        <label className="search-field">
          <Search size={18} />
          <input
            type="search"
            aria-label={t("library.search")}
            placeholder={t("library.search")}
            value={search}
            onChange={(e) => filter("q", e.target.value)}
          />
        </label>
        <select
          aria-label={t("library.sort")}
          value={sort}
          onChange={(e) => filter("sort", e.target.value)}
        >
          <option value="recent">{t("library.recent")}</option>
          <option value="name">{t("library.name")}</option>
        </select>
      </div>
      {!open && <ErrorNotice error={error} />}
      <Resource query={query}>
        {(sheets) => {
          const filtered = sheets
            .filter((sheet) =>
              sheet.name
                .toLocaleLowerCase(language)
                .includes(search.toLocaleLowerCase(language)),
            )
            .sort((a, b) =>
              sort === "name"
                ? a.name.localeCompare(b.name, language)
                : Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""),
            );
          return filtered.length ? (
            <div className="worksheet-grid">
              {filtered.map((sheet) => (
                <article
                  className="worksheet-card"
                  key={sheet.id}
                  onClick={(event) => {
                    if (!(event.target as Element).closest("button,a"))
                      navigate("/teacher/" + sheet.id);
                  }}
                >
                  <div className="worksheet-cover" aria-hidden="true">
                    <BookOpen size={30} />
                    <span>{sheet.items?.length ?? 0}</span>
                  </div>
                  <div className="worksheet-card-body">
                    <a
                      href={"/teacher/" + sheet.id}
                      onClick={(event) => {
                        event.preventDefault();
                        navigate("/teacher/" + sheet.id);
                      }}
                      className="worksheet-title worksheetOpenButton"
                    >
                      <h2>{sheet.name}</h2>
                      <ArrowUpRight size={18} />
                    </a>
                    <p className="muted">
                      {t(
                        sheet.items?.length === 1
                          ? "{count} activity"
                          : "{count} activities",
                        { count: sheet.items?.length ?? 0 },
                      )}
                    </p>
                    {sheet.updatedAt && (
                      <small className="muted">
                        {t("Last updated {date}", {
                          date: new Date(sheet.updatedAt).toLocaleDateString(
                            language === "ro" ? "ro-RO" : "en-GB",
                          ),
                        })}
                      </small>
                    )}
                    <div className="worksheet-card-actions">
                      <Button
                        variant="ghost"
                        disabled={!sheet.items?.length}
                        aria-label={t("Share worksheet") + ": " + sheet.name}
                        onClick={() => setShare(sheet.id)}
                      >
                        <Share2 size={16} />
                        {t("Share worksheet")}
                      </Button>
                      <Confirm
                        title={t("Delete this worksheet?")}
                        description={t(
                          "This removes the editable worksheet. This action cannot be undone.",
                        )}
                        onConfirm={async () => {
                          await api.deleteWorksheet(sheet.id);
                          await query.refetch();
                        }}
                      >
                        {(show) => (
                          <Button
                            variant="ghost"
                            aria-label={
                              t("Delete worksheet") + ": " + sheet.name
                            }
                            onClick={show}
                          >
                            <Trash2 size={17} />
                          </Button>
                        )}
                      </Confirm>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              description={t(
                sheets.length
                  ? "common.noMatches"
                  : "No worksheets yet. Create your first worksheet to begin.",
              )}
            >
              {!sheets.length && (
                <Button variant="primary" onClick={() => setOpen(true)}>
                  {t("New worksheet")}
                </Button>
              )}
            </Empty>
          );
        }}
      </Resource>
      <ShareDialog worksheetId={share} onClose={() => setShare(null)} />
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t("Create worksheet")}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <label htmlFor="worksheet-name">{t("Worksheet name")}</label>
          <input
            id="worksheet-name"
            autoFocus
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("For example: Animals and colours")}
            disabled={busy}
          />
          <ErrorNotice error={error} />
          <div className="actions end">
            <Button disabled={busy} onClick={() => setOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button variant="primary" type="submit" busy={busy}>
              {t("Create worksheet")}
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
