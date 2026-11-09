import type { User } from "./types";
export const canTeach = (user?: User | null) =>
  user?.role === "TEACHER" || user?.role === "ADMIN";
