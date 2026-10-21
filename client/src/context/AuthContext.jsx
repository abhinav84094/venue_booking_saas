import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../services/api";

import { AuthContext } from "./authContext.js";
import { getVenueHost } from "../utils/venueDomain";

export function AuthProvider({ children }) {
  const platformHost = getVenueHost().type === "platform";
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(platformHost);

  const refreshUser = useCallback(async () => {
    if (!platformHost) return null;
    try {
      const { data } = await api.get("/auth/me");

      const authenticatedUser = data.success && data.user ? data.user : null;

      setUser(authenticatedUser);
      return authenticatedUser;
    } catch {
      setUser(null);

      return null;
    } finally {
      setLoading(false);
    }
  }, [platformHost]);

  useEffect(() => {
    // Public tenant origins never discover or carry owner sessions. Their edge
    // allowlist deliberately exposes public venue APIs only.
    if (!platformHost) return;
    let active = true;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (active) setUser(data.success ? data.user : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [platformHost]);

  const setAuthenticatedUser = useCallback((authenticatedUser) => {
    if (!authenticatedUser?.id) {
      throw new Error("Invalid authenticated user");
    }

    setUser(authenticatedUser);
    setLoading(false);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data } = await api.post("/auth/login", {
      email: email.trim().toLowerCase(),
      password,
    });

    if (!data.success || !data.user) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
      setAuthenticatedUser,
    }),
    [user, loading, login, logout, refreshUser, setAuthenticatedUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
