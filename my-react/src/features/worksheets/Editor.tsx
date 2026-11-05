import "./worksheets.css";
import { useEffect, useReducer, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  Save,
  Share2,
  Undo2,
  Plus,
  List,
  ClipboardList,
} from "lucide-react";
import { useLanguage, useSession } from "../../app/state";
import { api } from "../../shared/api";
import {
  Button,
  Dropdown,
  Empty,
  ErrorNotice,
  MenuAction,
  Modal,
} from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import type { Definition, DraftItem, Worksheet } from "../../shared/types";
import { gameModules, supports } from "../../games/registry";
import GamePlayer from "../../games/Player";
import SettingsInspector from "./SettingsInspector";
import { saveDraft } from "../../platform/game-model.js";
import {
  draftReducer,
  fingerprint,
  fromWorksheet,
  readRecovery,
  recoveryKey,
} from "./draft";
import type { Recovery } from "./draft";
import { validateConfiguration } from "./validation";
import ActivityOutline from "./ActivityOutline";
import { AssignDialog, ShareDialog } from "./Sharing";
export default function Editor() {
  const { worksheetId = "" } = useParams();
  const query = useResource(["editor", worksheetId], async () => {
    const [worksheet, definitions] = await Promise.all([
      api.worksheet(worksheetId),
      api.definitions(),
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
  const { t } = useLanguage(),
    { user } = useSession();
  const [draft, dispatch] = useReducer(draftReducer, initial, fromWorksheet);
  const state = useRef(draft),
    base = useRef(fingerprint(initial)),
    saveLock = useRef(false);
  const recoveryCopy = useRef<{
    worksheet: Worksheet;
    items: DraftItem[];
  } | null>(null);
  const key = recoveryKey(user!.id, initial.id);
  const [recovery, setRecovery] = useState<Recovery | null>(() => {
    try {
      return readRecovery(localStorage, key);
    } catch {
      return null;
    }
  });
  const [storageError, setStorageError] = useState(false),
    [saving, setSaving] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false),
    [outlineOpen, setOutlineOpen] = useState(false),
    [tab, setTab] = useState<"settings" | "preview">("settings"),
    [fullPreview, setFullPreview] = useState(false),
    [previewIndex, setPreviewIndex] = useState(0);
  const [sharing, setSharing] = useState(false),
    [assigning, setAssigning] = useState(false),
    [pending, setPending] = useState<"share" | "assign" | null>(null);
  const blocker = useBlocker(draft.dirty || saving || photoBusy);
  useEffect(() => {
    state.current = draft;
  });
  useEffect(() => {
    if (recovery) return;
    try {
      if (draft.dirty)
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            updated: Date.now(),
            base: base.current,
            draft,
          }),
        );
      else localStorage.removeItem(key);
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [draft, key, recovery]);
  useEffect(() => {
    if (!draft.dirty && !saving && !photoBusy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.dirty, saving, photoBusy]);
  const available = Object.keys(gameModules).flatMap((type) => {
    const definition = definitions
      .filter(
        (def) =>
          def.type === type &&
          def.active !== false &&
          supports(type, def.version),
      )
      .sort((a, b) => b.version - a.version)[0];
    return definition ? [definition] : [];
  });
  const active = draft.items.find((item) => item.key === draft.selected),
    definition = active?.definition;
  const photoDefinition = definition?.configurationSchema?.["x-image-slots"]?.[
    "activity-photo"
  ]
    ? definition
    : definitions.find(
        (def) =>
          def.type === definition?.type &&
          def.version === 3 &&
          def.active !== false &&
          !!def.configurationSchema?.["x-image-slots"]?.["activity-photo"],
      );
  const disabled = saving || photoBusy;
  async function save() {
    if (saveLock.current || photoBusy) return false;
    const current = state.current;
    if (!current.name.trim()) {
      setError(new Error(t("Enter a worksheet name.")));
      return false;
    }
    for (const item of current.items) {
      if (item.definition) {
        const issue = validateConfiguration(
          item.definition,
          item.configuration,
        );
        if (issue) {
          setError(new Error(issue));
          dispatch({ type: "select", key: item.key });
          return false;
        }
      }
    }
    saveLock.current = true;
    setSaving(true);
    setError(null);
    setNotice("");
    try {
      await saveDraft(
        {
          renameWorksheet: api.renameWorksheet,
          deleteItem: api.deleteItem,
          saveItem: api.saveItem,
        },
        initial.id,
        { name: current.name, items: current.items },
        current.removed,
        (clientKey: string, item: DraftItem) =>
          dispatch({
            type: "savedItem",
            key: clientKey,
            id: item.id!,
            orderIndex: item.orderIndex,
          }),
        (id: number) => dispatch({ type: "deleted", id }),
      );
      const saved = await api.worksheet(initial.id);
      base.current = fingerprint(saved);
      dispatch({ type: "saved" });
      setNotice(t("editor.savedNotice"));
      return true;
    } catch (e) {
      setError(e);
      try {
        base.current = fingerprint(await api.worksheet(initial.id));
      } catch {
        /* Keep the previous comparison snapshot while offline. */
      }
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!event.repeat) void saveRef.current();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function requestShare(action: "share" | "assign") {
    if (draft.dirty) {
      setPending(action);
      return;
    }
    if (action === "share") setSharing(true);
    else setAssigning(true);
  }
  function update(configuration: DraftItem["configuration"], photo = false) {
    if (!active) return;
    dispatch({
      type: "update",
      key: active.key,
      patch: {
        configuration,
        ...(photo && photoDefinition
          ? { miniGameId: photoDefinition.id, definition: photoDefinition }
          : {}),
      },
    });
  }
  function move(clientKey: string, index: number) {
    dispatch({ type: "move", key: clientKey, index });
    setNotice(
      t("Activity moved to position {position}", { position: index + 1 }),
    );
  }
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
  async function recoverCopy() {
    if (!recovery || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!recoveryCopy.current) {
        const worksheet = await api.createWorksheet(
          recovery.draft.name + " (recovered)",
        );
        recoveryCopy.current = {
          worksheet,
          items: recovery.draft.items.map((item) => ({
            ...structuredClone(item),
            id: undefined,
          })),
        };
      }
      const copy = recoveryCopy.current;
      await saveDraft(
        {
          renameWorksheet: api.renameWorksheet,
          deleteItem: api.deleteItem,
          saveItem: api.saveItem,
        },
        copy.worksheet.id,
        { name: copy.worksheet.name, items: copy.items },
        [],
        (key: string, saved: DraftItem) => {
          copy.items = copy.items.map((item) =>
            item.key === key
              ? { ...item, id: saved.id, orderIndex: saved.orderIndex }
              : item,
          );
        },
        () => {},
      );
      try {
        localStorage.removeItem(key);
      } catch {
        /* Server recovery succeeded even without browser storage. */
      }
      window.location.assign("/teacher/" + copy.worksheet.id);
    } catch (error) {
      setError(error);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const previewItem = fullPreview ? draft.items[previewIndex] : active;
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
                onComplete={async () => {
                  setPreviewIndex((value) => value + 1);
                  return true;
                }}
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
                          configuration: structuredClone(
                            def.defaultConfiguration ?? {},
                          ),
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
