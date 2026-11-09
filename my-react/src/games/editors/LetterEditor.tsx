import { useLanguage } from "../../shared/runtime";
import type { EditorProps } from "../registry";
export default function LetterEditor({
  configuration,
  schema,
  onChange,
  renderPhoto,
}: EditorProps) {
  const { t } = useLanguage();
  return (
    <>
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
      {(configuration.animals ?? []).map((animal, index) => (
        <section className="object-editor" key={animal.id}>
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
          {renderPhoto?.({
            path: ["animals", index, "imageAssetId"],
            label: animal.name,
            value: animal.imageAssetId,
            fallback: animal.img,
          })}
        </section>
      ))}
    </>
  );
}
