import type { UserRole } from "@/lib/auth";

export type ShellNavIcon = "layout" | "users" | "scroll" | "building";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: ShellNavIcon;
  /** Lower sorts first */
  order: number;
  group: "Work" | "Organization";
  roles: readonly UserRole[];
}

const SHELL_NAV: readonly ShellNavItem[] = [
  {
    href: "/workspace",
    label: "Property workspace",
    icon: "building",
    order: 40,
    group: "Work",
    roles: ["admin", "verwalter", "auditor", "contractor"],
  },
  {
    href: "/admin/dashboard",
    label: "Control center",
    icon: "layout",
    order: 10,
    group: "Organization",
    roles: ["admin"],
  },
  {
    href: "/admin/users",
    label: "Team directory",
    icon: "users",
    order: 20,
    group: "Organization",
    roles: ["admin"],
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: "scroll",
    order: 30,
    group: "Organization",
    roles: ["admin"],
  },
  {
    href: "/auditor/dashboard",
    label: "Auditor home",
    icon: "layout",
    order: 10,
    group: "Organization",
    roles: ["auditor"],
  },
  {
    href: "/auditor/audit",
    label: "Audit log",
    icon: "scroll",
    order: 20,
    group: "Organization",
    roles: ["auditor"],
  },
  {
    href: "/contractor/dashboard",
    label: "Dashboard",
    icon: "layout",
    order: 10,
    group: "Work",
    roles: ["contractor"],
  },
] as const;

export function navItemsForRole(role: UserRole | undefined): ShellNavItem[] {
  if (!role) return [];
  return SHELL_NAV.filter((item) => item.roles.includes(role)).sort((a, b) => a.order - b.order);
}

export function groupedNav(role: UserRole | undefined): { group: ShellNavItem["group"]; items: ShellNavItem[] }[] {
  const items = navItemsForRole(role);
  const groups: ShellNavItem["group"][] = ["Organization", "Work"];
  return groups
    .map((group) => ({
      group,
      items: items.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);
}
