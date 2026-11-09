import { useLanguage } from "../../shared/runtime";
import type { EditorProps } from "../registry";
import VisualPicker from "../../shared/visuals/VisualPicker";
export default function LetterEditor({
  configuration,
  schema,
  onChange,
  renderPhoto,
  section = "activity",
}: EditorProps) {
  const { t } = useLanguage();
  return (
    <>
      {section === "visuals" && (
        <p className="visual-intro">{t("visual.wordHelp")}</p>
      )}
      {section === "activity" && (
        <div className="field">
          <label htmlFor="target-letter">{t("Target letter")}</label>
          <input
            id="target-letter"
            maxLength={1}
            value={configuration.letter ?? "u"}
            onChange={(e) => {
              const letter = Array.from(e.target.value.trim()).at(-1);
              if (letter && /^\p{L}$/u.test(letter))
                onChange({
                  ...configuration,
                  letter: letter.toLocaleLowerCase("ro-RO"),
                });
            }}
          />
        </div>
      )}
      {(configuration.animals ?? []).map((animal, index) => (
        <section className="object-editor" key={animal.id}>
          {section === "activity" ? (
            <>
              <label htmlFor={"animal-" + index}>{t("Name")}</label>
              <input
                id={"animal-" + index}
                aria-label={t("Name") + " " + (index + 1)}
                value={animal.name}
                maxLength={
                  schema.properties?.animals?.items?.properties?.name?.maxLength
                }
                onChange={(e) =>
                  onChange({
                    ...configuration,
                    animals: configuration.animals?.map((entry, i) =>
                      i === index ? { ...entry, name: e.target.value } : entry,
                    ),
                  })
                }
              />
            </>
          ) : (
            <>
              <h3 className="visual-object-name">{animal.name}</h3>
              <VisualPicker
                value={animal.imageAssetId ? undefined : animal.img}
                onSelect={(visual) => {
                  const next = { ...animal, img: visual.src };
                  delete next.imageAssetId;
                  onChange({
                    ...configuration,
                    animals: configuration.animals?.map((entry, i) =>
                      i === index ? next : entry,
                    ),
                  });
                }}
              />
              {renderPhoto && (
                <details className="visual-upload">
                  <summary>
                    {t("visual.ownImage")}
                    {animal.imageAssetId ? " · " + t("visual.inUse") : ""}
                  </summary>
                  {renderPhoto({
                    path: ["animals", index, "imageAssetId"],
                    label: animal.name,
                    value: animal.imageAssetId,
                    fallback: animal.img,
                  })}
                </details>
              )}
            </>
          )}
        </section>
      ))}
    </>
  );
}
