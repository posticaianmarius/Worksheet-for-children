import { Suspense } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Palette, SlidersHorizontal } from "lucide-react";
import { gameModules } from "../../games/registry";
import { setAtPath } from "../../shared/configuration";
import { useLanguage } from "../../shared/runtime";
import type { Configuration, Definition } from "../../shared/types";
import { Loading } from "../../shared/ui";
import { PhotoField } from "../catalog/Photos";
export default function SettingsInspector({
  definition,
  configuration,
  onChange,
  photoDefinition,
  onPhotoChange,
  onBusy,
}: {
  definition: Definition;
  configuration: Configuration;
  onChange: (value: Configuration) => void;
  photoDefinition?: Definition;
  onPhotoChange: (value: Configuration) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useLanguage(),
    Editor = gameModules[definition.type]?.Editor;
  if (!Editor) return null;
  function editor(section: "activity" | "visuals") {
    return (
      <Suspense fallback={<Loading />}>
        <Editor
          section={section}
          type={definition.type}
          schema={definition.configurationSchema ?? {}}
          configuration={configuration}
          onChange={onChange}
          renderPhoto={
            photoDefinition
              ? (field) => (
                  <PhotoField
                    definition={photoDefinition}
                    slot="object-photo"
                    label={field.label}
                    value={field.value}
                    fallback={field.fallback}
                    onBusy={onBusy}
                    onChange={(id) =>
                      onPhotoChange(
                        setAtPath(
                          configuration,
                          field.path,
                          id,
                        ) as Configuration,
                      )
                    }
                  />
                )
              : undefined
          }
        />
      </Suspense>
    );
  }
  return (
    <Tabs.Root defaultValue="activity" className="settings-form">
      <Tabs.List
        activateOnFocus
        className="studio-tabs"
        aria-label={t("Activity settings")}
      >
        <Tabs.Tab value="activity">
          <SlidersHorizontal size={15} />
          {t("studio.activity")}
        </Tabs.Tab>
        <Tabs.Tab value="visuals">
          <Palette size={15} />
          {t("studio.visuals")}
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="activity">{editor("activity")}</Tabs.Panel>
      <Tabs.Panel value="visuals">
        <p className="visual-intro">{t("visual.intro")}</p>
        {editor("visuals")}
        {photoDefinition && (
          <details className="visual-upload">
            <summary>
              {t("visual.activityImage")}
              {configuration.imageAssetId ? " · " + t("visual.inUse") : ""}
            </summary>
            <PhotoField
              definition={photoDefinition}
              label={t("Activity photo")}
              value={configuration.imageAssetId}
              onBusy={onBusy}
              onChange={(id) =>
                onPhotoChange({ ...configuration, imageAssetId: id })
              }
            />
          </details>
        )}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
