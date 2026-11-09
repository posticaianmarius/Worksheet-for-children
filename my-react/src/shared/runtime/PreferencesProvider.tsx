import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Language } from "../i18n";
import { translator } from "../i18n";
import type { Preferences } from "./contexts";
import { LanguageContext, PreferencesContext } from "./contexts";
import { readStorage, writeStorage } from "./storage";
export function PreferencesProvider({ children }: { children: ReactNode }) {
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
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <PreferencesContext.Provider value={{ preferences, setPreference }}>
        {children}
      </PreferencesContext.Provider>
    </LanguageContext.Provider>
  );
}
