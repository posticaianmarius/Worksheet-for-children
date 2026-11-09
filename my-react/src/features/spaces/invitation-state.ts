export function pendingInvitation() {
  try {
    return sessionStorage.getItem("playsheets.invitation") ?? undefined;
  } catch {
    return undefined;
  }
}
export function clearInvitation() {
  try {
    sessionStorage.removeItem("playsheets.invitation");
  } catch {
    /* optional storage */
  }
}
