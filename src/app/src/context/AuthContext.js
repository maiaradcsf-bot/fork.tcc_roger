import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { ROLES, api, hasToken, clearAllTokens } from '../services/index.js';

const AuthContext = createContext(null);

async function loadProfile(role) {
  return role === ROLES.ADMIN ? api.admin.catalog.getMe() : api.client.getMe();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      for (const role of [ROLES.ADMIN, ROLES.CLIENT]) {
        if (!(await hasToken(role))) continue;
        try {
          const profile = await loadProfile(role);
          if (active) setSession({ role, profile });
          break;
        } catch {
          await clearAllTokens();
        }
      }
      if (active) setRestoring(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    await clearAllTokens();
    const { role } = await api.auth.login(email, password);
    const profile = await loadProfile(role);
    setSession({ role, profile });
    return role;
  }, []);

  const register = useCallback(async (data) => {
    await clearAllTokens();
    await api.auth.registerClient(data);
    const profile = await loadProfile(ROLES.CLIENT);
    setSession({ role: ROLES.CLIENT, profile });
  }, []);

  const signOut = useCallback(async () => {
    const role = session?.role;
    try {
      if (role === ROLES.ADMIN) await api.auth.adminLogout();
      if (role === ROLES.CLIENT) await api.auth.clientLogout();
    } catch {
      await clearAllTokens();
    }
    setSession(null);
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const profile = await loadProfile(session.role);
    setSession((current) => (current ? { ...current, profile } : current));
  }, [session]);

  const hasPermission = useCallback(
    (permissionName) => {
      const permissions = session?.profile?.permissions || [];
      if (!permissionName) return false;
      return permissionName
        .split('|')
        .map((name) => name.trim())
        .filter(Boolean)
        .some((name) => permissions.includes(name));
    },
    [session],
  );

  const handleError = useCallback(
    (error, title = 'Erro') => {
      if (error?.isUnauthorized) {
        Alert.alert('Sessão expirada', 'Faça login novamente.');
        clearAllTokens().finally(() => setSession(null));
        return;
      }
      Alert.alert(title, error?.message || 'Não foi possível concluir a operação.');
    },
    [],
  );

  const value = useMemo(
    () => ({ session, restoring, signIn, register, signOut, refreshProfile, hasPermission, handleError }),
    [session, restoring, signIn, register, signOut, refreshProfile, hasPermission, handleError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
