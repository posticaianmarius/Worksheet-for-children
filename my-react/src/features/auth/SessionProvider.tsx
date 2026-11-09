import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { setActiveSpace } from "../../shared/http";
import { SessionContext } from "../../shared/runtime";
import { authApi } from "./api";

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        if (error instanceof Error && "status" in error && error.status === 401)
          return null;
        throw error;
      }
    },
    staleTime: Infinity,
  });
  const refresh = useCallback(async () => {
    setActiveSpace(null);
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    return (await query.refetch()).data ?? null;
  }, [client, query]);
  const logout = useCallback(async () => {
    await authApi.logout();
    setActiveSpace(null);
    client.clear();
    client.setQueryData(["session"], null);
  }, [client]);
  useEffect(() => {
    const expired = () => {
      setActiveSpace(null);
      client.clear();
      client.setQueryData(["session"], null);
    };
    window.addEventListener("session-expired", expired);
    return () => {
      window.removeEventListener("session-expired", expired);
    };
  }, [client]);
  return (
    <SessionContext.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        error: query.error,
        refresh,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
