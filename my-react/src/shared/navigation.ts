export function pendingWork() {
  try {
    const path = sessionStorage.getItem("playsheets.pending-work");
    sessionStorage.removeItem("playsheets.pending-work");
    return path?.match(/^\/work\/[a-f0-9-]{36}$/i) ? path : undefined;
  } catch {
    return undefined;
  }
}
