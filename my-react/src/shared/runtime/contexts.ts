import { createContext, useContext } from "react";
import type { Language, Translate } from "../i18n";
import type { SpaceContext as Scope, User } from "../types";
export interface SessionState {
  user: User | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<User | null>;
  logout: () => Promise<void>;
}
export const SessionContext = createContext<SessionState | null>(null);
export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
  t: Translate;
} | null>(null);
export interface Preferences {
  sound: boolean;
  motion: boolean;
}
export const PreferencesContext = createContext<{
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

export const SpaceContext = createContext<{
  context: Scope | null;
  switchSpace: (id: number) => Promise<void>;
  refresh: () => Promise<unknown>;
}>({ context: null, switchSpace: async () => {}, refresh: async () => {} });
export const useSpace = () => useContext(SpaceContext);
