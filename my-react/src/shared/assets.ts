export const photoUrl = (asset?: number | null, fallback?: string) =>
  asset ? "/api/minigame-assets/" + asset + "/content" : fallback;
