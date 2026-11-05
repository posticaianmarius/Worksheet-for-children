import { lazy } from "react";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import type { Configuration, Schema } from "../shared/types";
export interface PlayerProps {
  type: string;
  configuration: Configuration;
  onComplete: (result: { score: number; maxScore: number }) => void;
  disabled?: boolean;
}
export interface EditorProps {
  type: string;
  schema: Schema;
  configuration: Configuration;
  onChange: (configuration: Configuration) => void;
  renderPhoto?: (field: {
    path: (string | number)[];
    label: string;
    value?: number | null;
    fallback?: string;
  }) => ReactNode;
}
export interface GameModule {
  Editor: LazyExoticComponent<ComponentType<EditorProps>>;
  titleKey: string;
  helpKey: string;
  symbol: string;
  group: "numbers" | "letters";
  versions: readonly number[];
  Player: LazyExoticComponent<ComponentType<PlayerProps>>;
}
export const loadedPlayers: Record<
  string,
  ComponentType<PlayerProps> | undefined
> = {};
const loaders: Record<
  string,
  () => Promise<{ default: ComponentType<PlayerProps> }>
> = {
  "color-game": () => import("./players/LetterPlayer"),
  "matching-game": () => import("./players/MatchingPlayer"),
};
const numberLoader = () => import("./players/NumberPlayer");
export async function preloadGame(type: string) {
  const module = await (loaders[type] ?? numberLoader)();
  loadedPlayers[type] = module.default;
  return module;
}

const NumberPlayer = lazy(numberLoader);
const LetterPlayer = lazy(() => preloadGame("color-game"));
const MatchingPlayer = lazy(() => preloadGame("matching-game"));
const NumberEditor = lazy(() => import("./editors/NumberEditor"));
const LetterEditor = lazy(() => import("./editors/LetterEditor"));
const MatchingEditor = lazy(() => import("./editors/MatchingEditor"));
export const gameModules: Record<string, GameModule> = {
  "math-game": {
    titleKey: "game.math",
    helpKey: "game.mathHelp",
    symbol: "+",
    group: "numbers",
    versions: [1, 2, 3],
    Player: NumberPlayer,
    Editor: NumberEditor,
  },
  "sequence-game": {
    titleKey: "game.sequence",
    helpKey: "game.sequenceHelp",
    symbol: "123",
    group: "numbers",
    versions: [1, 2, 3],
    Player: NumberPlayer,
    Editor: NumberEditor,
  },
  "higher-lower-game": {
    titleKey: "game.comparison",
    helpKey: "game.comparisonHelp",
    symbol: "≷",
    group: "numbers",
    versions: [1, 2, 3],
    Player: NumberPlayer,
    Editor: NumberEditor,
  },
  "odd-even-game": {
    titleKey: "game.parity",
    helpKey: "game.parityHelp",
    symbol: "2·4",
    group: "numbers",
    versions: [1, 2, 3],
    Player: NumberPlayer,
    Editor: NumberEditor,
  },
  "color-game": {
    titleKey: "game.letters",
    helpKey: "game.lettersHelp",
    symbol: "Aa",
    group: "letters",
    versions: [1, 2, 3],
    Player: LetterPlayer,
    Editor: LetterEditor,
  },
  "matching-game": {
    titleKey: "game.matching",
    helpKey: "game.matchingHelp",
    symbol: "↔",
    group: "numbers",
    versions: [1, 2, 3],
    Player: MatchingPlayer,
    Editor: MatchingEditor,
  },
};
export function supports(type: string, version = 1) {
  return !!gameModules[type]?.versions.includes(version);
}
