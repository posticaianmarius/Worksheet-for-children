import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { Draft, Recovery } from "./draft";
import { readRecovery } from "./draft";

export function useDraftRecovery(
  draft: Draft,
  key: string,
  base: RefObject<string>,
) {
  const [recovery, setRecovery] = useState<Recovery | null>(() => {
    try {
      return readRecovery(localStorage, key);
    } catch {
      return null;
    }
  });
  const [storageError, setStorageError] = useState(false);
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
  }, [draft, key, recovery, base]);
  return { recovery, setRecovery, storageError };
}
