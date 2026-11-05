import type { Configuration } from "../shared/types.ts";
export type Answer = number | string;
export interface Question {
  values: number[];
  operator?: string;
  correct: Answer;
  choices: Answer[];
}
export const exerciseCount = (config: Configuration) =>
  Math.max(1, Math.min(100, Math.trunc(config.exerciseCount ?? 10)));
export function shuffle<T>(values: T[], random = Math.random) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
export function createQuestion(
  type: string,
  config: Configuration,
  random = Math.random,
): Question {
  const max = Math.max(1, Math.min(10000, Math.trunc(config.maxNumber ?? 10)));
  const integer = (limit = max) =>
    Math.floor(random() * Math.max(1, limit)) + 1;
  if (type === "odd-even-game") {
    const value = integer();
    return {
      values: [value],
      correct: value % 2 ? "odd" : "even",
      choices: ["odd", "even"],
    };
  }
  if (type === "higher-lower-game") {
    const limit = Math.max(2, max),
      first = integer(limit);
    let second = integer(limit - 1);
    if (second >= first) second++;
    return {
      values: [first, second],
      correct: first > second ? "bigger" : "smaller",
      choices: ["bigger", "smaller"],
    };
  }
  if (type === "sequence-game") {
    const steps = [1, 2, 3, 5, 10],
      step =
        steps[Math.floor(random() * steps.length)] * (random() < 0.5 ? 1 : -1);
    const start =
      step > 0
        ? integer(Math.max(1, max - step * 4))
        : Math.min(
            max,
            Math.abs(step) * 4 + integer(Math.max(1, max - Math.abs(step) * 4)),
          );
    const values = Array.from({ length: 4 }, (_, i) => start + step * i),
      correct = start + step * 4;
    return {
      values,
      correct,
      choices: numberChoices(correct, random, Math.abs(step)),
    };
  }
  const operations = (config.operations ?? ["+"]).filter((value) =>
    ["+", "-", "*", "/"].includes(value),
  );
  const operator = operations[Math.floor(random() * operations.length)] ?? "+";
  let first = integer(),
    second = integer(),
    correct = 0;
  if (operator === "+") correct = first + second;
  if (operator === "-") {
    [first, second] = [Math.max(first, second), Math.min(first, second)];
    correct = first - second;
  }
  if (operator === "*") {
    second = integer(Math.floor(max / first));
    correct = first * second;
  }
  if (operator === "/") {
    second = integer();
    correct = integer(Math.floor(max / second));
    first = second * correct;
  }
  return {
    values: [first, second],
    operator: operator === "*" ? "×" : operator === "/" ? "÷" : operator,
    correct,
    choices: numberChoices(correct, random),
  };
}
function numberChoices(correct: number, random: () => number, step = 1) {
  const choices = new Set<number>([correct]);
  for (let i = 0; choices.size < 4 && i < 100; i++) {
    const value =
      correct +
      (random() < 0.5 ? -1 : 1) * (Math.floor(random() * 5) + 1) * step;
    if (value >= 0) choices.add(value);
  }
  for (let value = 0; choices.size < 4; value++) choices.add(value);
  return shuffle([...choices], random);
}
export function maximumScore(type: string, config: Configuration) {
  if (type === "matching-game") return (config.pairs ?? []).length;
  if (type === "color-game")
    return (config.animals ?? []).reduce(
      (sum, animal) =>
        sum +
        Array.from(animal.name).filter(
          (char) =>
            char.toLocaleLowerCase("ro-RO") ===
            String(config.letter ?? "u").toLocaleLowerCase("ro-RO"),
        ).length,
      0,
    );
  return exerciseCount(config);
}
