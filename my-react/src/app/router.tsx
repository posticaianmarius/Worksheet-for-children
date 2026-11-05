import { Loading } from "../shared/ui";
import { createBrowserRouter } from "react-router-dom";
import {
  AttemptLayout,
  NotFound,
  PublicLayout,
  RootLayout,
  RouteError,
  SessionLayout,
  TeacherLayout,
} from "./Layout";
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    HydrateFallback: Loading,
    ErrorBoundary: RouteError,
    children: [
      {
        Component: PublicLayout,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("../features/auth/PublicEntry")).default,
            }),
          },
          {
            path: "login",
            lazy: async () => ({
              Component: (await import("../features/auth/AuthPage")).default,
            }),
          },
          {
            path: "signup",
            lazy: async () => ({
              Component: (await import("../features/auth/AuthPage")).default,
            }),
          },
        ],
      },
      {
        Component: SessionLayout,
        children: [
          {
            path: "home",
            lazy: async () => ({
              Component: (await import("../features/home/Dashboard")).default,
            }),
          },
          {
            path: "account",
            lazy: async () => ({
              Component: (await import("../features/home/Dashboard")).Account,
            }),
          },
          {
            path: "classes",
            lazy: async () => ({
              Component: (await import("../features/classrooms/Classes"))
                .default,
            }),
          },
          {
            path: "classes/:id",
            lazy: async () => ({
              Component: (await import("../features/classrooms/Classroom"))
                .default,
            }),
          },
          {
            path: "assignments",
            lazy: async () => ({
              Component: (await import("../features/assignments/Assignments"))
                .default,
            }),
          },
          {
            path: "assignments/:id",
            lazy: async () => ({
              Component: (await import("../features/assignments/Assignments"))
                .AssignmentDetail,
            }),
          },
          {
            path: "kids/:worksheetId",
            lazy: async () => ({
              Component: (await import("../features/assignments/Assignments"))
                .LegacyWorksheet,
            }),
          },
        ],
      },
      {
        Component: TeacherLayout,
        children: [
          {
            path: "sheets",
            lazy: async () => ({
              Component: (await import("../features/worksheets/Library"))
                .default,
            }),
          },
          {
            path: "teacher/:worksheetId",
            lazy: async () => ({
              Component: (await import("../features/worksheets/Editor"))
                .default,
            }),
          },
          {
            path: "classes/:id/children/:userId",
            lazy: async () => ({
              Component: (await import("../features/classrooms/Student"))
                .default,
            }),
          },
          {
            path: "classes/:id/children/:userId/tests/:attemptId",
            lazy: async () => ({
              Component: (await import("../features/classrooms/Student"))
                .StudentResult,
            }),
          },
          {
            path: "assignments/classes/:classId",
            lazy: async () => ({
              Component: (await import("../features/assignments/Reports"))
                .default,
            }),
          },
          {
            path: "assignments/classes/:classId/worksheets/:revisionId",
            lazy: async () => ({
              Component: (await import("../features/assignments/Reports"))
                .default,
            }),
          },
          {
            path: "home/:className/:kidName?",
            lazy: async () => ({
              Component: (await import("../features/classrooms/Classes"))
                .LegacyClass,
            }),
          },
        ],
      },
      {
        Component: AttemptLayout,
        children: [
          {
            path: "attempts/:id",
            lazy: async () => ({
              Component: (await import("../features/attempts/Attempt")).default,
            }),
          },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
