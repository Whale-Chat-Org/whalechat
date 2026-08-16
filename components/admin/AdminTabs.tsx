"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Can } from "@/components/rbac/Can";
import { cn } from "@/lib/utils";
import type { Permission } from "@/lib/rbac/statements";

const TABS: { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Users", permission: "user:list" },
  { href: "/admin/roles", label: "Roles", permission: "role:list" },
];

/**
 * Navigation between the admin screens.
 *
 * @remarks Links rather than `ui/tabs`, because each screen is its own route
 * with its own gate — tab panels would put them in one document and one
 * authorization decision.
 *
 * Each tab is wrapped in `<Can>` so a role that cannot open a screen is not
 * offered it. Cosmetic: the page behind the link gates itself.
 */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 border-b">
      {TABS.map((tab) => (
        <Can key={tab.href} permission={tab.permission}>
          <Link
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              pathname === tab.href
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {tab.label}
          </Link>
        </Can>
      ))}
    </nav>
  );
}
