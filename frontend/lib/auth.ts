export const TOKEN_KEY = "ch_access_token";

export type UserRole = "admin" | "verwalter" | "auditor" | "contractor";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
  organization_name: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function homePathForRole(role: string): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "verwalter":
      return "/workspace";
    case "auditor":
      return "/auditor/dashboard";
    case "contractor":
      return "/contractor/dashboard";
    default:
      return "/workspace";
  }
}
