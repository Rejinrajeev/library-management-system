import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('auth');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (auth) localStorage.setItem('auth', JSON.stringify(auth));
    else localStorage.removeItem('auth');
  }, [auth]);

  const login = (user, token) => setAuth({ user, token });
  const logout = () => setAuth(null);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
