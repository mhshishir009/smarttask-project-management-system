import { createContext, useContext } from "react";

export type UserRole = "ADMIN" | "TEAM_MEMBER";

export interface AuthUser {
  userId: number;
  roleId: number;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
}

// Shared context and hook live outside the provider component module.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
