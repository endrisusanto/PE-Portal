import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pe_portal_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pe_portal_token');
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('pe_portal_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // Token invalid or expired, clear session
        setUser(null);
        localStorage.removeItem('pe_portal_token');
        localStorage.removeItem('pe_portal_refresh_token');
        localStorage.removeItem('pe_portal_user');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pe_portal_token', data.token);
    localStorage.setItem('pe_portal_refresh_token', data.refresh_token);
    localStorage.setItem('pe_portal_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('pe_portal_token');
      localStorage.removeItem('pe_portal_refresh_token');
      localStorage.removeItem('pe_portal_user');
      setUser(null);
    }
  };

  const updateUser = (updatedData) => {
    const merged = { ...user, ...updatedData };
    setUser(merged);
    localStorage.setItem('pe_portal_user', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
