import { useLanguage } from "../../app/state";
import type { EditorProps } from "../registry";
export default function NumberEditor({
  type,
  configuration,
  schema,
  onChange,
}: EditorProps) {
  const { t } = useLanguage();
  const properties = schema.properties ?? {};
  function number(key: "maxNumber" | "exerciseCount", label: string) {
    return (
      <div className="field">
        <label htmlFor={"config-" + key}>{t(label)}</label>
        <input
          id={"config-" + key}
          type="number"
          min={properties[key]?.minimum ?? 1}
          max={properties[key]?.maximum ?? 100}
          step={1}
          value={configuration[key] ?? 10}
          onChange={(e) =>
            onChange({
              ...configuration,
              [key]: Number.isNaN(e.target.valueAsNumber)
                ? undefined
                : e.target.valueAsNumber,
            })
          }
        />
      </div>
    );
  }
  return (
    <>
      {number(
        "maxNumber",
        type === "math-game"
          ? "Maximum number for operands:"
          : "Maximum number:",
      )}
      {number("exerciseCount", "Number of exercises:")}
      {type === "math-game" && (
        <fieldset>
          <legend>{t("Select operations:")}</legend>
          {[
            ["+", "Addition (+)"],
            ["-", "Subtraction (-)"],
            ["*", "Multiplication (×)"],
            ["/", "Division (÷)"],
          ].map(([operator, label]) => (
            <label className="check-field" key={operator}>
              <input
                type="checkbox"
                checked={(configuration.operations ?? ["+"]).includes(operator)}
                onChange={() => {
                  const current = configuration.operations ?? ["+"];
                  const next = current.includes(operator)
                    ? current.filter((value) => value !== operator)
                    : [...current, operator];
                  if (next.length)
                    onChange({ ...configuration, operations: next });
                }}
              />
              {t(label)}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
