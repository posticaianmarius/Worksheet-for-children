import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSpace } from "../features/spaces/SpaceContext";
import { useSession } from "../app/state";
import { ErrorNotice, Loading } from "./ui";
export function useResource<T>(key: unknown[], loader: () => Promise<T>) {
  const { user } = useSession();
  const { context } = useSpace();
  return useQuery({
    queryKey: [user?.id, context?.spaceId, ...key],
    queryFn: loader,
  });
}
export function Resource<T>({
  query,
  children,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (query.data === undefined) return null;
  return children(query.data);
}
