import { QueryClient } from "@tanstack/react-query";
import { getActiveSpace } from "./http.ts";
import type { User } from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: false },
  },
});
export const resourceKey = (
  userId: number | undefined,
  spaceId: number | null | undefined,
  key: readonly unknown[],
) => [userId, spaceId, ...key];

export function matchesResource(
  key: readonly unknown[],
  userId: number | undefined,
  spaceId: number | null,
  resources: readonly string[],
) {
  return (
    key[0] === userId &&
    key[1] === spaceId &&
    resources.includes(String(key[2]))
  );
}
export function invalidateResources(
  resources: readonly string[],
  context = false,
) {
  const userId = queryClient.getQueryData<User | null>(["session"])?.id;
  const spaceId = getActiveSpace();
  return queryClient.invalidateQueries({
    predicate: (q) =>
      matchesResource(q.queryKey, userId, spaceId, resources) ||
      (context &&
        q.queryKey[0] === "space-context" &&
        q.queryKey[1] === userId),
    refetchType: "none",
  });
}
