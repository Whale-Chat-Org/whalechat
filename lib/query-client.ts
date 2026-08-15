import { isServer, QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that a value prefetched on the server isn't refetched the
        // instant it hydrates on the client.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * The shared React Query client.
 *
 * @remarks A fresh client per request on the server, so one user's cache can
 * never be handed to another. A singleton in the browser, so `HydrationBoundary`
 * has a stable target and the cache survives navigation.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
