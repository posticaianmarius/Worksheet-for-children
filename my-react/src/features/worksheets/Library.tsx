import { Tabs } from "@base-ui/react/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage, useSession, useSpace } from "../../shared/runtime";
import { resourceKey } from "../../shared/query";
import { Resource, useResource } from "../../shared/resource";
import type { Worksheet } from "../../shared/types";
import { Button, Empty, Page } from "../../shared/ui";
import { ShareDialog } from "../assignments/Sharing";
import { worksheetsApi } from "./api";
import { CreateWorksheet } from "./CreateWorksheet";
import {
  activityCount,
  libraryFilter,
  visibleWorksheets,
  type WorksheetAction,
} from "./library-model";
import WorksheetCard from "./WorksheetCard";
import WorksheetManagement from "./WorksheetManagement";
import "./worksheets.css";
import "./library.css";

export default function Library() {
  const { t } = useLanguage();
  const { user } = useSession();
  const { context } = useSpace();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [share, setShare] = useState<number | null>(null);
  const [action, setAction] = useState<WorksheetAction | null>(null);
  const [notice, setNotice] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const query = useResource(["worksheets"], worksheetsApi.worksheets);
  return (
    <div className="worksheet-library">
      <Page
        title={t("My worksheets")}
        subtitle={t("library.collectionHelp")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" />
            {t("New worksheet")}
          </Button>
        }
      >
        {notice && (
          <p className="library-feedback" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {notice}
          </p>
        )}
        <Resource query={query}>
          {(sheets) => (
            <Collection
              sheets={sheets}
              searchInput={searchInput}
              onCreate={() => setCreating(true)}
              onShare={setShare}
              onManage={(value) => {
                setNotice("");
                setAction(value);
              }}
            />
          )}
        </Resource>
        <ShareDialog worksheetId={share} onClose={() => setShare(null)} />
        {creating && <CreateWorksheet onClose={() => setCreating(false)} />}
        {action && (
          <WorksheetManagement
            action={action}
            fallbackFocus={searchInput}
            onClose={() => setAction(null)}
            onComplete={(result) => {
              // Reconcile this collection after acknowledgement; other read models remain invalidated.
              client.setQueryData<Worksheet[]>(
                resourceKey(user?.id, context?.spaceId, ["worksheets"]),
                (current) =>
                  current &&
                  (result.kind === "delete"
                    ? current.filter((sheet) => sheet.id !== result.id)
                    : current.map((sheet) =>
                        sheet.id === result.sheet.id ? result.sheet : sheet,
                      )),
              );
              setAction(null);
              setNotice(result.message);
            }}
          />
        )}
      </Page>
    </div>
  );
}

function Collection({
  sheets,
  searchInput,
  onCreate,
  onShare,
  onManage,
}: {
  sheets: Worksheet[];
  searchInput: RefObject<HTMLInputElement | null>;
  onCreate: () => void;
  onShare: (id: number) => void;
  onManage: (action: WorksheetAction) => void;
}) {
  const { t, language } = useLanguage();
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsId = useId();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const filter = libraryFilter(params.get("filter"));
  const sort = params.get("sort") === "name" ? "name" : "recent";
  const view = params.get("view") === "list" ? "list" : "grid";
  const visible = visibleWorksheets(sheets, search, filter, sort, language);
  const populated = sheets.filter((sheet) => activityCount(sheet) > 0).length;
  const counts = {
    all: sheets.length,
    "with-activities": populated,
    empty: sheets.length - populated,
  };
  function change(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  function reset() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("q");
        next.delete("filter");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
    searchInput.current?.focus();
  }
  return (
    <>
      <Tabs.Root
        value={filter}
        onValueChange={(value) =>
          change("filter", value === "all" ? "" : String(value))
        }
      >
        <div className="library-toolbar">
          <Tabs.List
            className="library-tabs"
            activateOnFocus
            aria-label={t("library.filter")}
          >
            {(["all", "with-activities", "empty"] as const).map((value) => (
              <Tabs.Tab key={value} value={value}>
                {t("library.filter." + value)}
                <span>{counts[value]}</span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <div className="library-controls">
            <div className="library-search">
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchInput}
                type="search"
                aria-label={t("library.search")}
                placeholder={t("library.search")}
                value={search}
                onChange={(event) => change("q", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && search) {
                    event.preventDefault();
                    change("q", "");
                  }
                }}
              />
              {search && (
                <Button
                  variant="ghost"
                  aria-label={t("library.clearSearch")}
                  onClick={() => {
                    change("q", "");
                    searchInput.current?.focus();
                  }}
                >
                  <X size={17} aria-hidden="true" />
                </Button>
              )}
            </div>
            <Button
              className="library-tools-toggle"
              variant="ghost"
              aria-label={t("library.sortView")}
              title={t("library.sortView")}
              aria-controls={toolsId}
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((value) => !value)}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </Button>
            <div
              className="library-sort-controls"
              id={toolsId}
              data-open={toolsOpen}
            >
              <select
                aria-label={t("library.sort")}
                value={sort}
                onChange={(event) => change("sort", event.target.value)}
              >
                <option value="recent">{t("library.recent")}</option>
                <option value="name">{t("library.name")}</option>
              </select>
              <div
                className="library-view"
                role="group"
                aria-label={t("library.view")}
              >
                <Button
                  variant="ghost"
                  aria-pressed={view === "grid"}
                  aria-label={t("library.grid")}
                  title={t("library.grid")}
                  onClick={() => change("view", "")}
                >
                  <LayoutGrid size={18} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  aria-pressed={view === "list"}
                  aria-label={t("library.list")}
                  title={t("library.list")}
                  onClick={() => change("view", "list")}
                >
                  <List size={19} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="library-results-heading">
          <p role="status" aria-live="polite" aria-atomic="true">
            {t(
              visible.length === 1 ? "library.resultOne" : "library.resultMany",
              { count: visible.length, total: sheets.length },
            )}
          </p>
          {visible.length > 0 && (search || filter !== "all") && (
            <Button variant="ghost" onClick={reset}>
              {t("library.reset")}
            </Button>
          )}
        </div>
        <Tabs.Panel value={filter} className="library-panel">
          {visible.length ? (
            <div
              className={"worksheet-grid library-grid library-grid--" + view}
            >
              {visible.map((sheet) => (
                <WorksheetCard
                  key={sheet.id}
                  sheet={sheet}
                  onShare={onShare}
                  onManage={onManage}
                />
              ))}
            </div>
          ) : (
            <div className="library-empty">
              <Empty
                title={t(
                  sheets.length ? "library.noMatches" : "library.firstTitle",
                )}
                description={t(
                  sheets.length ? "library.noMatchesHelp" : "library.firstHelp",
                )}
              >
                {sheets.length ? (
                  <Button onClick={reset}>{t("library.reset")}</Button>
                ) : (
                  <>
                    <Button variant="primary" onClick={onCreate}>
                      <Plus size={18} />
                      {t("New worksheet")}
                    </Button>
                    <ol className="library-first-steps">
                      <li>{t("library.firstName")}</li>
                      <li>{t("library.firstBuild")}</li>
                      <li>{t("library.firstShare")}</li>
                    </ol>
                  </>
                )}
              </Empty>
            </div>
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </>
  );
}
