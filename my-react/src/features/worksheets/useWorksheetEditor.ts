import { useEffect, useReducer, useRef, useState } from "react";
import { gameModules, supports } from "../../games/registry";
import { useLanguage, useSession } from "../../shared/runtime";
import type { Definition, DraftItem, Worksheet } from "../../shared/types";
import { worksheetsApi } from "./api";
import { draftReducer, fingerprint, fromWorksheet, recoveryKey } from "./draft";
import { saveDraft } from "./save";
import { useDraftNavigation } from "./useDraftNavigation";
import { useDraftRecovery } from "./useDraftRecovery";
import { validateConfiguration } from "./validation";
export function useWorksheetEditor(
  initial: Worksheet,
  definitions: Definition[],
) {
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
  const { recovery, setRecovery, storageError } = useDraftRecovery(
    draft,
    key,
    base,
  );
  const [saving, setSaving] = useState(false),
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
  useEffect(() => {
    state.current = draft;
  });
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
          renameWorksheet: worksheetsApi.renameWorksheet,
          deleteItem: worksheetsApi.deleteItem,
          saveItem: worksheetsApi.saveItem,
        },
        initial.id,
        { name: current.name, items: current.items },
        current.removed,
        (clientKey, item) =>
          dispatch({
            type: "savedItem",
            key: clientKey,
            id: item.id!,
            orderIndex: item.orderIndex,
          }),
        (id: number) => dispatch({ type: "deleted", id }),
      );
      const saved = await worksheetsApi.worksheet(initial.id);
      base.current = fingerprint(saved);
      dispatch({ type: "saved" });
      setNotice(t("editor.savedNotice"));
      return true;
    } catch (e) {
      setError(e);
      try {
        base.current = fingerprint(await worksheetsApi.worksheet(initial.id));
      } catch {
        /* Keep the previous comparison snapshot while offline. */
      }
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  const blocker = useDraftNavigation(draft.dirty, saving || photoBusy, save);
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
  async function recoverCopy() {
    if (!recovery || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (!recoveryCopy.current) {
        const worksheet = await worksheetsApi.createWorksheet(
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
          renameWorksheet: worksheetsApi.renameWorksheet,
          deleteItem: worksheetsApi.deleteItem,
          saveItem: worksheetsApi.saveItem,
        },
        copy.worksheet.id,
        { name: copy.worksheet.name, items: copy.items },
        [],
        (key, saved) => {
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
  return {
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
  };
}
