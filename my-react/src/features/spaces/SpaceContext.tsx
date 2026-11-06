import { createContext, useContext, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage, useSession } from "../../app/state";
import { setActiveSpace } from "../../shared/api";
import type { SpaceContext as Context } from "../../shared/types";
import { ErrorNotice, Loading } from "../../shared/ui";
import { spacesApi } from "./api";
const SpaceContext = createContext<{
  context: Context | null;
  switchSpace: (id: number) => Promise<void>;
  refresh: () => Promise<unknown>;
}>({ context: null, switchSpace: async () => {}, refresh: async () => {} });
export const useSpace = () => useContext(SpaceContext);
export function SpaceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession(),
    client = useQueryClient(),
    { t } = useLanguage();
  const [error, setError] = useState<unknown>(null);
  const [switching, setSwitching] = useState(false);
  const query = useQuery({
    queryKey: ["space-context", user?.id],
    queryFn: spacesApi.context,
    enabled: !!user,
  });
  useLayoutEffect(() => {
    setActiveSpace(query.data?.spaceId ?? null);
  }, [query.data?.spaceId, user?.id]);
  async function switchSpace(id: number) {
    setSwitching(true);
    setError(null);
    try {
      await spacesApi.select(id);
      setActiveSpace(id);
      client.removeQueries({
        predicate: (q) =>
          q.queryKey[0] !== "session" && q.queryKey[0] !== "space-context",
      });
      await query.refetch();
    } catch (e) {
      setActiveSpace(query.data?.spaceId ?? null);
      setError(e);
    } finally {
      setSwitching(false);
    }
  }
  if (user && (query.isPending || switching)) return <Loading />;
  if (user && query.error)
    return (
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
    );
  const value = {
    context: user ? (query.data ?? null) : null,
    switchSpace,
    refresh: query.refetch,
  };
  if (
    user &&
    query.data &&
    query.data.spaceId === null &&
    query.data.spaces.length > 1
  )
    return (
      <SpaceContext.Provider value={value}>
        <main className="auth-layout">
          <section className="auth-card">
            <h1>{t("Choose a teaching space")}</h1>
            <SpaceSwitcher />
            <ErrorNotice error={error} />
          </section>
        </main>
      </SpaceContext.Provider>
    );
  return (
    <SpaceContext.Provider value={value}>
      <ErrorNotice error={error} />
      {children}
    </SpaceContext.Provider>
  );
}
export function SpaceSwitcher() {
  const { context, switchSpace } = useSpace(),
    { t } = useLanguage();
  if (!context || context.spaces.length < 2)
    return context?.spaces[0] ? (
      <span className="space-name">{context.spaces[0].name}</span>
    ) : null;
  return (
    <label className="space-switcher">
      <span>{t("Teaching space")}</span>
      <select
        aria-label={t("Teaching space")}
        value={context.spaceId ?? ""}
        onChange={(e) => void switchSpace(Number(e.target.value))}
      >
        {!context.spaceId && (
          <option value="">{t("Choose a teaching space")}</option>
        )}
        {context.spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
