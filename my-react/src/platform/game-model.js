import { createQuestion, exerciseCount } from "../games/engine.ts";
export const gameRegistry = {
  "matching-game": { title: "Match the Amounts", symbol: "↔" },
  "color-game": { title: "Letters & pictures", symbol: "Aa" },
  "math-game": { title: "Easy math", symbol: "+" },
  "sequence-game": { title: "Number sequence", symbol: "123" },
  "higher-lower-game": { title: "Higher or lower", symbol: "≷" },
  "odd-even-game": { title: "Odd or even", symbol: "2·4" },
};

export function gameTitle(definition) {
  return (
    gameRegistry[definition?.type]?.title ||
    definition?.name ||
    "Unavailable activity"
  );
}

// Compatibility API for existing model consumers; gameplay uses this same engine.
export function generateQuestions(type, config, random = Math.random) {
  if (type === "color-game")
    return (config.animals || []).map((animal) => ({
      animal,
      letter: config.letter || "",
      answer: Array.from(animal.name || "").flatMap((letter, index) =>
        letter.toLocaleLowerCase("ro-RO") ===
        String(config.letter).toLocaleLowerCase("ro-RO")
          ? [index]
          : [],
      ),
    }));
  return Array.from({ length: exerciseCount(config) }, () => {
    const question = createQuestion(type, config, random);
    return { ...question, answer: question.correct };
  });
}

export function isCorrect(question, answer) {
  if (question.animal) {
    return (
      Array.isArray(answer) &&
      answer.length === question.answer.length &&
      question.answer.every((index) => answer.includes(index))
    );
  }
  return String(answer) === String(question.answer);
}

export function resultPayload(score, maxScore, seconds, outcome = "COMPLETED") {
  return {
    outcome,
    score: outcome === "SKIPPED" ? 0 : score,
    maxScore,
    timeSeconds: Math.max(0, Math.round(seconds)),
    details: {},
  };
}

export function activityMaxScore(item) {
  const configuration = item.configuration || {};
  if (item.definition?.type === "color-game") {
    const letter = String(configuration.letter || "u").toLocaleLowerCase(
      "ro-RO",
    );
    return (configuration.animals || []).reduce(
      (count, animal) =>
        count +
        Array.from(animal.name).filter(
          (character) => character.toLocaleLowerCase("ro-RO") === letter,
        ).length,
      0,
    );
  }
  if (item.definition?.type === "matching-game")
    return configuration.pairs?.length || 3;
  return configuration.exerciseCount || 10;
}

export function remainingItems(attempt) {
  const saved = new Set(attempt.results.map((result) => result.revisionItemId));
  return [...attempt.items]
    .sort((first, second) => first.orderIndex - second.orderIndex)
    .filter((item) => !saved.has(item.id));
}

export async function saveDraft(
  api,
  worksheetId,
  draft,
  removed,
  onItemSaved,
  onItemDeleted,
) {
  const current = await api.renameWorksheet(worksheetId, draft.name.trim());
  for (const id of removed) {
    await api.deleteItem(worksheetId, id);
    onItemDeleted(id);
  }
  const reordering = draft.items.some(
    (item, index) => item.id && item.orderIndex !== index,
  );
  if (reordering) {
    const temporaryStart =
      Math.max(
        draft.items.length,
        ...(current?.items || draft.items).map((item) => item.orderIndex || 0),
      ) + 1;
    for (let index = 0; index < draft.items.length; index += 1) {
      const item = draft.items[index];
      if (!item.id) continue;
      const saved = await api.saveItem(worksheetId, {
        ...item,
        orderIndex: temporaryStart + index,
      });
      onItemSaved(item.key, saved);
    }
  }
  for (let index = 0; index < draft.items.length; index += 1) {
    const item = draft.items[index];
    const saved = await api.saveItem(worksheetId, {
      ...item,
      orderIndex: index,
    });
    onItemSaved(item.key, saved);
  }
}

export function imagePaths(configuration, pointer) {
  const parts = pointer.split("/").slice(1);
  const matches = [];
  function visit(value, index, actualPath) {
    if (index === parts.length) {
      matches.push({ path: actualPath, value });
      return;
    }
    const part = parts[index];
    if (part === "*") {
      if (Array.isArray(value))
        value.forEach((entry, entryIndex) =>
          visit(entry, index + 1, [...actualPath, entryIndex]),
        );
    } else {
      visit(value?.[part], index + 1, [...actualPath, part]);
    }
  }
  visit(configuration, 0, []);
  return matches;
}

export function setAtPath(configuration, path, value) {
  const next = structuredClone(configuration);
  let cursor = next;
  path.slice(0, -1).forEach((key, index) => {
    cursor[key] ??= typeof path[index + 1] === "number" ? [] : {};
    cursor = cursor[key];
  });
  cursor[path.at(-1)] = value;
  return next;
}
