import { useLanguage } from "./runtime";
import { Dropdown, MenuAction } from "./ui";
export function LanguageMenu() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <Dropdown ariaLabel={t("Language")} label={language === "ro" ? "RO" : "EN"}>
      <MenuAction onClick={() => setLanguage("en")}>English</MenuAction>
      <MenuAction onClick={() => setLanguage("ro")}>Română</MenuAction>
    </Dropdown>
  );
}
