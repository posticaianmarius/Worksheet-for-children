import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SpaceProvider } from "../features/spaces/SpaceContext";
import { api, setActiveSpace } from "../shared/api";
import { translator } from "../shared/i18n";
import type { Language, Translate } from "../shared/i18n";
import type { User } from "../shared/types";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
    mutations: { retry: false },
  },
});
export function readStorage(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
interface SessionState {
  user: User | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
}
const SessionContext = createContext<SessionState | null>(null);
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
  t: Translate;
} | null>(null);
export interface Preferences {
  sound: boolean;
  motion: boolean;
}
const PreferencesContext = createContext<{
  preferences: Preferences;
  setPreference: (key: keyof Preferences, value: boolean) => void;
} | null>(null);
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Missing SessionProvider");
  return value;
}
export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("Missing LanguageProvider");
  return value;
}
export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("Missing PreferencesProvider");
  return value;
}
function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      try {
        return await api.me();
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
    await api.logout();
    setActiveSpace(null);
    client.clear();
    client.setQueryData(["session"], null);
  }, [client]);
  useEffect(() => {
    const expired = () => {
      client.clear();
      client.setQueryData(["session"], null);
    };
    const mutated = () => {
      void client.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] !== "session" && q.queryKey[1] !== "share",
        refetchType: "none",
      });
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("platform-mutated", mutated);
    return () => {
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("platform-mutated", mutated);
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
export function AppProviders({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    readStorage(
      "worksheet-language",
      navigator.language.startsWith("ro") ? "ro" : "en",
    ) === "ro"
      ? "ro"
      : "en",
  );
  const [preferences, setPreferences] = useState<Preferences>(() => ({
    sound: readStorage("practica.sound", "true") === "true",
    motion: readStorage("practica.motion", "true") === "true",
  }));
  const t = useMemo(() => translator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      !preferences.motion,
    );
  }, [preferences.motion]);
  const setLanguage = (value: Language) => {
    setLanguageState(value);
    writeStorage("worksheet-language", value);
  };
  const setPreference = (key: keyof Preferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    writeStorage("practica." + key, String(value));
  };
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
        <PreferencesContext.Provider value={{ preferences, setPreference }}>
          <SessionProvider>
            <SpaceProvider>{children}</SpaceProvider>
          </SessionProvider>
        </PreferencesContext.Provider>
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}
