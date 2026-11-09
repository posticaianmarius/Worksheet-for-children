import type { Animal, Configuration } from "../shared/types.ts";
import type { Answer, Question } from "./engine.ts";
import { createQuestion, exerciseCount } from "./engine.ts";
interface LegacyQuestion extends Partial<Question> {
  animal?: Animal;
  letter?: string;
  answer: Answer | number[];
}
export function generateQuestions(
  type: string,
  config: Configuration,
  random = Math.random,
): LegacyQuestion[] {
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

export function isCorrect(question: LegacyQuestion, answer: unknown) {
  if (question.animal) {
    return (
      Array.isArray(answer) &&
      answer.length === (question.answer as number[]).length &&
      (question.answer as number[]).every((index) => answer.includes(index))
    );
  }
  return String(answer) === String(question.answer);
}
