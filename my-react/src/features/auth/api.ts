import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type { User } from "../../shared/types";
const send = mutationSender([]);
export const authApi = {
  me: () => request<User>("/api/auth/me"),
  login: (email: string, password: string) =>
    send<User>("/api/auth/login", "POST", { email, password }),
  signup: (
    name: string,
    email: string,
    password: string,
    invitationToken?: string,
  ) =>
    send<User>("/api/auth/signup", "POST", {
      name,
      email,
      password,
      role: "TEACHER",
      invitationToken,
    }),
  logout: () => send<void>("/api/auth/logout"),
  studentLogin: (studentCode: string) =>
    send<User>("/api/play/login", "POST", {
      studentCode: studentCode.trim().toUpperCase(),
    }),
};
