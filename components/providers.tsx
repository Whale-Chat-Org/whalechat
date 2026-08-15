"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { authClient } from "@/lib/auth-client";
import { adminPlugin } from "@/lib/auth/admin-plugin";
import { getQueryClient } from "@/lib/query-client";

/**
 * Client-side context every page needs: React Query and the Better Auth UI config.
 *
 * @remarks `AuthProvider` mounts the `QueryClientProvider` itself, so the shared
 * client goes in as a prop rather than through a second wrapper. That keeps a
 * single cache instance, which is what page-level `HydrationBoundary` hydrates into.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <AuthProvider
      authClient={authClient}
      queryClient={getQueryClient()}
      navigate={({ to, replace }) =>
        replace ? router.replace(to) : router.push(to)
      }
      Link={Link}
      plugins={[adminPlugin()]}
    >
      {children}
    </AuthProvider>
  );
}
