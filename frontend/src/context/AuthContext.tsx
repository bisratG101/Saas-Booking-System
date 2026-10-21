import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { SafeUser } from "../types/api";
import {
  getStoredToken,
  setStoredToken,
  getStoredUser,
  setStoredUser,
  clearAuthStorage,
} from "../services/token";
import { api } from "../services/apiClient";

export interface AuthContextValue {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  login: (token: string, user: SafeUser) => void;
  logout: () => void;
  refreshUser: () => Promise<SafeUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<SafeUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Refreshes the user profile from the backend /api/v1/auth/me endpoint.
   * This ensures role transitions (e.g. customer -> business_owner after business creation)
   * are immediately reflected without stale frontend data.
   */
  const refreshUser = useCallback(async (): Promise<SafeUser | null> => {
    const activeToken = getStoredToken();
    if (!activeToken) {
      logout();
      return null;
    }

    try {
      const res = await api.get<{ user: SafeUser }>("/auth/me");
      if (res?.user) {
        setUser(res.user);
        setStoredUser(res.user);
        return res.user;
      }
      return null;
    } catch {
      // If /auth/me returns 401 or fails, clear expired session
      logout();
      return null;
    }
  }, [logout]);

  // Session restoration on initial application mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await api.get<{ user: SafeUser }>("/auth/me");
        if (isMounted) {
          if (res?.user) {
            setUser(res.user);
            setStoredUser(res.user);
          } else {
            logout();
          }
        }
      } catch {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    restoreSession();

    return () => {
      isMounted = false;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [logout]);

  const login = useCallback((newToken: string, newUser: SafeUser) => {
    setStoredToken(newToken);
    setStoredUser(newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const isOwner = user?.role === "business_owner";
  const isAdmin = user?.role === "platform_admin";
  const isCustomer = user?.role === "customer";

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    isOwner,
    isAdmin,
    isCustomer,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
