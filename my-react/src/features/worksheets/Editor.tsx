import {
  ArrowLeft,
  ClipboardList,
  Eye,
  List,
  Plus,
  Save,
  Share2,
  Undo2,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { catalogApi } from "../catalog/api";
import { worksheetsApi } from "./api";
import { useWorksheetEditor } from "./useWorksheetEditor";
import "./worksheets.css";
import "./studio.css";

import GamePlayer from "../../games/Player";
import { gameModules, supports } from "../../games/registry";
import { Resource, useResource } from "../../shared/resource";
import type { Definition, Worksheet } from "../../shared/types";
import {
  Button,
  Dropdown,
  Empty,
  ErrorNotice,
  MenuAction,
  Modal,
} from "../../shared/ui";
import { AssignDialog, ShareDialog } from "../assignments/Sharing";
import ActivityOutline from "./ActivityOutline";
import SettingsInspector from "./SettingsInspector";
import { fingerprint } from "./draft";
import { builtinVisuals } from "../../shared/visuals/catalog";
export default function Editor() {
  const { worksheetId = "" } = useParams();
  const query = useResource(["editor", worksheetId], async () => {
    const [worksheet, definitions] = await Promise.all([
      worksheetsApi.worksheet(worksheetId),
      catalogApi.definitions(),
    ]);
    return {
      worksheet: {
        ...worksheet,
        items: worksheet.items.map((item) => ({
          ...item,
          definition:
            item.definition ??
            definitions.find((def) => def.id === item.miniGameId),
        })),
      },
      definitions,
    };
  });
  return (
    <Resource query={query}>
      {(data) => (
        <WorksheetEditor
          key={data.worksheet.id}
          initial={data.worksheet}
          definitions={data.definitions}
        />
      )}
    </Resource>
  );
}
function WorksheetEditor({
  initial,
  definitions,
}: {
  initial: Worksheet;
  definitions: Definition[];
}) {
  const {
    t,
    draft,
    dispatch,
    recovery,
    setRecovery,
    key,
    saving,
    error,
    notice,
    storageError,
    setPhotoBusy,
    adding,
    setAdding,
    outlineOpen,
    setOutlineOpen,
    tab,
    setTab,
    fullPreview,
    setFullPreview,
    previewIndex,
    setPreviewIndex,
    sharing,
    setSharing,
    assigning,
    setAssigning,
    pending,
    setPending,
    available,
    active,
    definition,
    photoDefinition,
    disabled,
    save,
    requestShare,
    update,
    move,
    recoverCopy,
    previewItem,
    blocker,
  } = useWorksheetEditor(initial, definitions);
  const outline = (
    <ActivityOutline
      items={draft.items}
      selected={draft.selected}
      disabled={disabled}
      onSelect={(clientKey) => {
        dispatch({ type: "select", key: clientKey });
        setOutlineOpen(false);
      }}
      onMove={move}
      onDuplicate={(clientKey) =>
        dispatch({
          type: "duplicate",
          key: clientKey,
          newKey: crypto.randomUUID(),
        })
      }
      onRemove={(clientKey) => dispatch({ type: "remove", key: clientKey })}
      onAdd={() => setAdding(true)}
    />
  );
  return (
    <main className="editor-page" aria-busy={disabled}>
      <header className="editor-toolbar">
        <div className="editor-name">
          <Link to="/sheets" aria-label={t("Worksheets")}>
            <ArrowLeft size={19} />
          </Link>
          <input
            aria-label={t("Worksheet name")}
            value={draft.name}
            maxLength={150}
            disabled={disabled || fullPreview}
            onChange={(e) => dispatch({ type: "name", name: e.target.value })}
          />
          <span
            className={"save-status" + (error ? " error" : "")}
            role="status"
          >
            {t(
              saving
                ? "Saving…"
                : error
                  ? "editor.failed"
                  : draft.dirty
                    ? "editor.unsaved"
                    : "editor.saved",
            )}
          </span>
        </div>
        <div className="actions editor-actions">
          <Button
            variant="ghost"
            aria-label={t("Undo removal")}
            disabled={!draft.undo.length || disabled}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Undo2 size={17} />
          </Button>
          <Button
            className="editor-desktop-action"
            disabled={!draft.items.length || disabled}
            onClick={() => {
              setPreviewIndex(0);
              setFullPreview((value) => !value);
            }}
          >
            <Eye size={17} />
            {t(fullPreview ? "Back to editor" : "Preview as child")}
          </Button>
          <Button
            className="editor-desktop-action"
            disabled={!draft.items.length || disabled}
            onClick={() => requestShare("share")}
          >
            <Share2 size={17} />
            {t("Share worksheet")}
          </Button>
          <Button
            variant="primary"
            disabled={!draft.dirty || disabled}
            busy={saving}
            onClick={() => void save()}
          >
            <Save size={17} />
            {t("Save worksheet")}
          </Button>
          <div className="editor-more">
            <Dropdown label="···" ariaLabel={t("More actions")}>
              <MenuAction
                onClick={() => {
                  setPreviewIndex(0);
                  setFullPreview((value) => !value);
                }}
                disabled={!draft.items.length}
              >
                {t(fullPreview ? "Back to editor" : "Preview as child")}
              </MenuAction>
              <MenuAction
                disabled={!draft.items.length}
                onClick={() => requestShare("share")}
              >
                {t("Share worksheet")}
              </MenuAction>
              <MenuAction
                disabled={!draft.items.length}
                onClick={() => requestShare("assign")}
              >
                {t("Assign worksheet")}
              </MenuAction>
            </Dropdown>
          </div>
          <Button
            className="editor-desktop-action"
            disabled={!draft.items.length || disabled}
            onClick={() => requestShare("assign")}
          >
            <ClipboardList size={17} />
            {t("Assign")}
          </Button>
        </div>
      </header>
      {storageError && (
        <p className="notice">{t("editor.recoveryUnavailable")}</p>
      )}
      <ErrorNotice error={error} retry={() => void save()} />
      {notice && (
        <p className="editor-announcement" role="status">
          {notice}
        </p>
      )}
      <div className="editor-mobile-toolbar">
        <Button onClick={() => setOutlineOpen(true)}>
          <List size={17} />
          {t("Activities")} · {draft.items.length}
        </Button>
        {!fullPreview && (
          <div
            className="segmented"
            role="group"
            aria-label={t("Activity settings")}
          >
            <Button
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              {t("common.settings")}
            </Button>
            <Button
              aria-pressed={tab === "preview"}
              onClick={() => setTab("preview")}
            >
              {t("common.preview")}
            </Button>
          </div>
        )}
      </div>
      {fullPreview ? (
        <section className="full-preview">
          {previewItem ? (
            <>
              <p className="game-step">
                {t("Activity {current} of {total}", {
                  current: previewIndex + 1,
                  total: draft.items.length,
                })}
              </p>
              <GamePlayer
                key={
                  previewItem.key + JSON.stringify(previewItem.configuration)
                }
                type={previewItem.definition?.type ?? ""}
                version={previewItem.definition?.version}
                configuration={previewItem.configuration}
                onComplete={async () => true}
                preview
                onAdvance={() => setPreviewIndex((value) => value + 1)}
              />
            </>
          ) : (
            <Empty description={t("editor.previewComplete")}>
              <Button onClick={() => setFullPreview(false)}>
                {t("Back to editor")}
              </Button>
            </Empty>
          )}
        </section>
      ) : (
        <div className={"editor-layout editor-tab--" + tab}>
          <aside className="worksheetActivitySidebar">{outline}</aside>
          <section className="editor-preview worksheetCanvas">
            <div className="section-heading">
              <span className="eyebrow">{t("editor.preview")}</span>
              {active && (
                <span className="muted">
                  {t("Activity {current} of {total}", {
                    current: draft.items.indexOf(active) + 1,
                    total: draft.items.length,
                  })}
                </span>
              )}
            </div>
            {active ? (
              <>
                <p className="preview-note">{t("editor.previewNote")}</p>
                <GamePlayer
                  key={active.key + JSON.stringify(active.configuration)}
                  type={definition?.type ?? ""}
                  version={definition?.version}
                  configuration={active.configuration}
                />
              </>
            ) : (
              <Empty
                title={t("editor.empty")}
                description={t("editor.emptyCopy")}
              >
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <Plus size={17} />
                  {t("Add activity")}
                </Button>
              </Empty>
            )}
          </section>
          <aside className="editor-settings">
            <h2>{t("editor.settings")}</h2>
            {active &&
            definition &&
            supports(definition.type, definition.version) ? (
              <fieldset disabled={disabled}>
                <SettingsInspector
                  key={active.key}
                  definition={definition}
                  configuration={active.configuration}
                  onChange={(value) => update(value)}
                  photoDefinition={photoDefinition}
                  onPhotoChange={(value) => update(value, true)}
                  onBusy={setPhotoBusy}
                />
              </fieldset>
            ) : (
              <p className="muted">
                {t(active ? "editor.unavailable" : "editor.emptyCopy")}
              </p>
            )}
          </aside>
        </div>
      )}
      <Modal
        open={outlineOpen}
        onClose={() => setOutlineOpen(false)}
        title={t("Activities")}
        className="activity-drawer"
      >
        {outline}
      </Modal>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t("Add activity")}
        className="catalog-dialog"
      >
        {(["numbers", "letters"] as const).map((group) => (
          <section key={group}>
            <h3>{t("catalog." + group)}</h3>
            <div className="catalog-grid">
              {available
                .filter((def) => gameModules[def.type].group === group)
                .map((def) => (
                  <button
                    className="catalog-card"
                    aria-label={t(gameModules[def.type].titleKey)}
                    key={def.id}
                    onClick={() => {
                      const clientKey = crypto.randomUUID();
                      dispatch({
                        type: "add",
                        item: {
                          key: clientKey,
                          miniGameId: def.id,
                          orderIndex: draft.items.length,
                          definition: def,
                          configuration: {
                            ...structuredClone(def.defaultConfiguration ?? {}),
                            ...(def.type === "color-game"
                              ? {
                                  animals:
                                    def.defaultConfiguration?.animals?.map(
                                      (animal) => ({
                                        ...animal,
                                        img:
                                          builtinVisuals.find(
                                            (visual) => visual.id === animal.id,
                                          )?.src ?? animal.img,
                                      }),
                                    ),
                                }
                              : {}),
                          },
                        },
                      });
                      setAdding(false);
                      setOutlineOpen(false);
                    }}
                  >
                    <span>{gameModules[def.type].symbol}</span>
                    <strong>{t(gameModules[def.type].titleKey)}</strong>
                    <small>{t(gameModules[def.type].helpKey)}</small>
                  </button>
                ))}
            </div>
          </section>
        ))}
        {!available.length && (
          <Empty description={t("No activities are currently available.")} />
        )}
      </Modal>
      <ShareDialog
        worksheetId={sharing ? initial.id : null}
        onClose={() => setSharing(false)}
      />
      <AssignDialog
        worksheetId={assigning ? initial.id : null}
        onClose={() => setAssigning(false)}
      />
      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t("editor.saveFirst")}
        description={t("editor.saveFirstCopy")}
      >
        <Button
          variant="primary"
          busy={saving}
          onClick={() =>
            void save().then((ok) => {
              if (ok) {
                if (pending === "share") setSharing(true);
                else setAssigning(true);
                setPending(null);
              }
            })
          }
        >
          {t("editor.saveContinue")}
        </Button>
      </Modal>
      <Modal
        open={recovery !== null}
        dismissible={false}
        onClose={() => {}}
        title={t(
          recovery?.base === fingerprint(initial)
            ? "editor.restore"
            : "editor.conflict",
        )}
        description={t(
          recovery?.base === fingerprint(initial)
            ? "editor.restoreCopy"
            : "editor.conflictCopy",
        )}
      >
        <ErrorNotice error={error} />
        <div className="actions">
          <Button
            disabled={saving}
            onClick={() => {
              setRecovery(null);
              try {
                localStorage.removeItem(key);
              } catch {
                /* Optional storage. */
              }
            }}
          >
            {t("editor.discard")}
          </Button>
          {recovery?.base === fingerprint(initial) ? (
            <Button
              variant="primary"
              onClick={() => {
                if (recovery)
                  dispatch({ type: "restore", draft: recovery.draft });
                setRecovery(null);
              }}
            >
              {t("editor.restoreAction")}
            </Button>
          ) : (
            <Button
              variant="primary"
              busy={saving}
              onClick={() => void recoverCopy()}
            >
              {t("editor.recoverCopy")}
            </Button>
          )}
        </div>
      </Modal>
      <Modal
        open={blocker.state === "blocked"}
        onClose={() => blocker.state === "blocked" && blocker.reset()}
        title={t("You have unsaved worksheet changes. Leave without saving?")}
      >
        <div className="actions">
          <Button
            onClick={() => blocker.state === "blocked" && blocker.reset()}
          >
            {t("Cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={disabled}
            onClick={() => blocker.state === "blocked" && blocker.proceed()}
          >
            {t("Leave without saving")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}
