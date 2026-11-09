import { Check, Search } from "lucide-react";
import { useId, useState } from "react";
import { useLanguage } from "../runtime";
import {
  builtinVisuals,
  type BuiltinVisual,
  type VisualGroup,
} from "./catalog";
import "./visuals.css";

export default function VisualPicker({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (visual: BuiltinVisual) => void;
}) {
  const { language, t } = useLanguage();
  const [group, setGroup] = useState<VisualGroup | "all">("all");
  const [search, setSearch] = useState("");
  const id = useId();
  const choices = builtinVisuals.filter(
    (visual) =>
      (group === "all" || visual.group === group) &&
      (visual[language] + " " + visual.en)
        .toLocaleLowerCase(language)
        .includes(search.toLocaleLowerCase(language).trim()),
  );
  return (
    <div className="visual-picker">
      <label className="visual-search" htmlFor={id}>
        <Search size={15} aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={search}
          placeholder={t("visual.search")}
          aria-label={t("visual.search")}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div
        className="visual-filters"
        role="group"
        aria-label={t("visual.categories")}
      >
        {(["all", "food", "animals", "nature", "objects"] as const).map(
          (key) => (
            <button
              key={key}
              type="button"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
            >
              {t("visual." + key)}
            </button>
          ),
        )}
      </div>
      <div
        className="visual-grid"
        role="group"
        aria-label={t("visual.builtins")}
      >
        {choices.map((visual) => {
          const selected = value === visual.src || value === visual.emoji;
          return (
            <button
              key={visual.id}
              type="button"
              aria-pressed={selected}
              aria-label={visual[language]}
              title={visual[language]}
              onClick={() => onSelect(visual)}
            >
              <img
                src={visual.src}
                alt=""
                width="36"
                height="36"
                loading="lazy"
              />
              <span>{visual[language]}</span>
              {selected && (
                <Check
                  className="visual-selected"
                  size={12}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      {!choices.length && (
        <p className="muted" role="status">
          {t("visual.empty")}
        </p>
      )}
    </div>
  );
}
