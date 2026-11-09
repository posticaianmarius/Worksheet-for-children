import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../shared/runtime";
import { Button } from "../../shared/ui";
import type { EditorProps } from "../registry";
import VisualPicker from "../../shared/visuals/VisualPicker";
export default function MatchingEditor({
  configuration,
  schema,
  onChange,
  renderPhoto,
  section = "activity",
}: EditorProps) {
  const { t } = useLanguage(),
    pairs = configuration.pairs ?? [],
    properties = schema.properties?.pairs;
  return (
    <>
      <div className="pair-editors">
        {pairs.map((pair, index) => (
          <section className="object-editor" key={pair.id}>
            <div className="section-heading">
              <strong>{t("Pair {number}", { number: index + 1 })}</strong>
              {section === "activity" && (
                <Button
                  variant="ghost"
                  aria-label={t("Remove pair")}
                  disabled={pairs.length <= (properties?.minItems ?? 1)}
                  onClick={() =>
                    onChange({
                      ...configuration,
                      pairs: pairs.filter((entry) => entry.id !== pair.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            {section === "activity" ? (
              <>
                <label htmlFor={"pair-number-" + index}>{t("Number")}</label>
                <input
                  id={"pair-number-" + index}
                  type="number"
                  min={properties?.items?.properties?.number?.minimum ?? 1}
                  max={properties?.items?.properties?.number?.maximum ?? 50}
                  value={pair.number}
                  onChange={(e) =>
                    onChange({
                      ...configuration,
                      pairs: pairs.map((entry) =>
                        entry.id === pair.id
                          ? { ...entry, number: e.target.valueAsNumber }
                          : entry,
                      ),
                    })
                  }
                />
              </>
            ) : (
              <>
                <VisualPicker
                  value={pair.imageAssetId ? undefined : pair.emoji}
                  onSelect={(visual) => {
                    const next = { ...pair, emoji: visual.emoji };
                    delete next.imageAssetId;
                    onChange({
                      ...configuration,
                      pairs: pairs.map((entry) =>
                        entry.id === pair.id ? next : entry,
                      ),
                    });
                  }}
                />
                <details className="visual-upload">
                  <summary>{t("visual.customEmoji")}</summary>
                  <label htmlFor={"pair-emoji-" + index}>{t("Emoji")}</label>
                  <input
                    id={"pair-emoji-" + index}
                    value={pair.emoji}
                    maxLength={properties?.items?.properties?.emoji?.maxLength}
                    onChange={(e) =>
                      onChange({
                        ...configuration,
                        pairs: pairs.map((entry) =>
                          entry.id === pair.id
                            ? {
                                ...entry,
                                emoji: e.target.value,
                                ...(entry.imageAssetId
                                  ? { imageAssetId: null }
                                  : {}),
                              }
                            : entry,
                        ),
                      })
                    }
                  />
                </details>
                {renderPhoto && (
                  <details className="visual-upload">
                    <summary>
                      {t("visual.ownImage")}
                      {pair.imageAssetId ? " · " + t("visual.inUse") : ""}
                    </summary>
                    {renderPhoto({
                      path: ["pairs", index, "imageAssetId"],
                      label: t("Pair {number}", { number: index + 1 }),
                      value: pair.imageAssetId,
                    })}
                  </details>
                )}
              </>
            )}
          </section>
        ))}
      </div>
      {section === "activity" && (
        <Button
          disabled={pairs.length >= (properties?.maxItems ?? 6)}
          onClick={() =>
            onChange({
              ...configuration,
              pairs: [
                ...pairs,
                {
                  id: crypto.randomUUID(),
                  number:
                    Array.from({ length: 50 }, (_, i) => i + 1).find(
                      (value) => !pairs.some((pair) => pair.number === value),
                    ) ?? 1,
                  emoji: "🍎",
                },
              ],
            })
          }
        >
          <Plus size={16} />
          {t("Add pair")}
        </Button>
      )}
    </>
  );
}
