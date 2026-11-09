import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider } from "../features/auth/SessionProvider";
import { SpaceProvider } from "../features/spaces/SpaceContext";
import { queryClient } from "../shared/query";
import { PreferencesProvider } from "../shared/runtime/PreferencesProvider";
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <SessionProvider>
          <SpaceProvider>{children}</SpaceProvider>
        </SessionProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
