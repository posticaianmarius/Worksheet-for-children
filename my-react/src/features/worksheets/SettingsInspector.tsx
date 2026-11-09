import { Suspense } from "react";
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
  return (
    <div className="settings-form">
      <Suspense fallback={<Loading />}>
        <Editor
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
      {photoDefinition && (
        <PhotoField
          definition={photoDefinition}
          label={t("Activity photo")}
          value={configuration.imageAssetId}
          onBusy={onBusy}
          onChange={(id) =>
            onPhotoChange({ ...configuration, imageAssetId: id })
          }
        />
      )}
    </div>
  );
}
