import { CreateWorksheet } from "./CreateWorksheet";
import {
  ArrowUpRight,
  BookOpen,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../shared/runtime";
import { worksheetsApi } from "./api";
import "./worksheets.css";

import { Resource, useResource } from "../../shared/resource";
import { Button, Confirm, Empty, Page } from "../../shared/ui";
import { ShareDialog } from "../assignments/Sharing";
export default function Library() {
  const { t, language } = useLanguage(),
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false),
    [share, setShare] = useState<number | null>(null);
  const query = useResource(["worksheets"], worksheetsApi.worksheets),
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
  return (
    <Page
      title={t("My worksheets")}
      subtitle={t("library.subtitle")}
      actions={
        <Button
          variant="primary"
          onClick={() => {
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
                          await worksheetsApi.deleteWorksheet(sheet.id);
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
      {open && <CreateWorksheet onClose={() => setOpen(false)} />}
    </Page>
  );
}
