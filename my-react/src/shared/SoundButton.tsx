import { Volume2, VolumeX } from "lucide-react";
import { useLanguage, usePreferences } from "./runtime";
import { Button } from "./ui";
export function SoundButton() {
  const { preferences, setPreference } = usePreferences(),
    { t } = useLanguage();
  return (
    <Button
      variant="ghost"
      aria-label={t("preferences.sound")}
      aria-pressed={preferences.sound}
      onClick={() => setPreference("sound", !preferences.sound)}
    >
      {preferences.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
    </Button>
  );
}
