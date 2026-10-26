import { useState, type ReactNode } from "react";
import api from "../services/api";
import { AuthContext, type AuthUser } from "./AuthContext";

// Keep the provider component separate from shared context and hooks.
const TOKEN_KEY = "smarttask_token";
const USER_KEY = "smarttask_user";

// ==========================================
// READ STORED SESSION
// ==========================================

function readStoredUser(): AuthUser | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const storedUser = sessionStorage.getItem(USER_KEY);

    if (!token || !storedUser) {
      return null;
    }

    const parsed: unknown = JSON.parse(storedUser);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const account = parsed as Partial<AuthUser>;

    if (
      !Number.isSafeInteger(account.userId) ||
      ![1, 2].includes(account.roleId ?? -1) ||
      typeof account.mustChangePassword !== "boolean" ||
      // Require email so older sessions prompt a fresh login.
      typeof account.email !== "string" ||
      !account.email.trim()
    ) {
      return null;
    }

    return account as AuthUser;
  } catch {
    return null;
  }
}

// ==========================================
// AUTH PROVIDER
// ==========================================

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(
    readStoredUser
  );

  const [token, setToken] = useState<string | null>(
    () => {
      const storedUser = readStoredUser();

      return storedUser
        ? sessionStorage.getItem(TOKEN_KEY)
        : null;
    }
  );

  // ==========================================
  // LOGIN
  // ==========================================

  const login = async (
    email: string,
    password: string
  ): Promise<void> => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    const data = response.data?.data;

    const accessToken =
      data?.accessToken ?? data?.token;

    const account = data?.user ?? data;

    if (
      typeof accessToken !== "string" ||
      !Number.isSafeInteger(account?.userId) ||
      ![1, 2].includes(account?.roleId)
    ) {
      throw new Error(
        "Unexpected login response. Check backend response format."
      );
    }

    // Read the password-change flag from either supported response shape.
    const passwordChangeRequired =
      data?.mustChangePassword === true ||
      account?.mustChangePassword === true;

    const authenticatedUser: AuthUser = {
      userId: account.userId,
      roleId: account.roleId,
      role:
        account.roleId === 1
          ? "ADMIN"
          : "TEAM_MEMBER",

      // Store the successful login email for display in the header.
      email: email.trim().toLowerCase(),

      mustChangePassword: passwordChangeRequired,
    };

    sessionStorage.setItem(
      TOKEN_KEY,
      accessToken
    );

    sessionStorage.setItem(
      USER_KEY,
      JSON.stringify(authenticatedUser)
    );

    setToken(accessToken);
    setUser(authenticatedUser);
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = (): void => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);
  };

  // ==========================================
  // CONTEXT PROVIDER
  // ==========================================

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
