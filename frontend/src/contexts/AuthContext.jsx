import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { GuestAuthModal } from '../components/common/GuestAuthModal';

const AuthContext = createContext();

export const GUEST_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  username: 'guest',
  full_name: 'Guest Visitor',
  role: 'guest',
  department: 'Public / Guest',
  is_guest: true,
  preferred_lang: 'id',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('pe_portal_token');
    if (!token) return GUEST_USER;
    const saved = localStorage.getItem('pe_portal_user');
    return saved ? JSON.parse(saved) : GUEST_USER;
  });
  const [loading, setLoading] = useState(true);

  // Guest warning modal state
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestActionName, setGuestActionName] = useState('');

  const isGuest = !user || user.role === 'guest' || Boolean(user.is_guest);

  const showGuestModal = useCallback((actionName = '') => {
    setGuestActionName(actionName);
    setGuestModalOpen(true);
  }, []);

  const hideGuestModal = useCallback(() => {
    setGuestModalOpen(false);
    setGuestActionName('');
  }, []);

  const requireAuth = useCallback(
    (actionName = '') => {
      if (isGuest) {
        showGuestModal(actionName);
        return false;
      }
      return true;
    },
    [isGuest, showGuestModal]
  );

  // Listen for global blocked guest write events from axios client
  useEffect(() => {
    const handleGuestBlocked = (e) => {
      const action = e.detail?.action || e.detail?.message || '';
      showGuestModal(action);
    };

    window.addEventListener('pe_guest_action_blocked', handleGuestBlocked);
    return () => window.removeEventListener('pe_guest_action_blocked', handleGuestBlocked);
  }, [showGuestModal]);

  useEffect(() => {
    const token = localStorage.getItem('pe_portal_token');
    if (!token) {
      setUser(GUEST_USER);
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('pe_portal_user', JSON.stringify(res.data));
      })
      .catch(() => {
        // Token invalid or expired, switch to guest session
        localStorage.removeItem('pe_portal_token');
        localStorage.removeItem('pe_portal_refresh_token');
        localStorage.removeItem('pe_portal_user');
        setUser(GUEST_USER);
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
      setUser(GUEST_USER);
    }
  };

  const updateUser = (updatedData) => {
    const merged = { ...user, ...updatedData };
    setUser(merged);
    localStorage.setItem('pe_portal_user', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        login,
        logout,
        updateUser,
        requireAuth,
        showGuestModal,
        hideGuestModal,
      }}
    >
      {children}
      <GuestAuthModal
        isOpen={guestModalOpen}
        onClose={hideGuestModal}
        actionName={guestActionName}
      />
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
