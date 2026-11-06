import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { canTeach } from "../shared/api";
import { Loading, ErrorNotice } from "../shared/ui";
import { useSession } from "./state";
export function RequireSession({
  children,
  teacher = false,
  entry = "/login",
}: {
  children: ReactNode;
  teacher?: boolean;
  entry?: string;
}) {
  const { user, loading, error, refresh } = useSession(),
    location = useLocation();
  if (loading) return <Loading />;
  if (error) return <ErrorNotice error={error} retry={() => void refresh()} />;
  if (!user)
    return <Navigate to={entry} state={{ from: location.pathname }} replace />;
  if (teacher && !canTeach(user)) return <Navigate to="/" replace />;
  return children;
}
