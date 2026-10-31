import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, LogOut, Eye, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { ThemePalettePicker } from '../common/ThemePalettePicker';
import { NotificationDropdown } from './NotificationDropdown';
import { Avatar } from '../common/Avatar';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { t } = useTranslation();
  const { user, isGuest, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {isGuest && (
          <div className={styles.guestNotice}>
            <span className={styles.guestNoticeDot} />
            <span>{t('auth.guest_topbar_notice', 'Mode Tamu: Navigasi Navbar & Sidebar aktif (View Only). Wajib login ADCorp untuk interaksi data.')}</span>
          </div>
        )}
      </div>

      <div className={styles.right}>
        {/* Global Notification Center with Prioritized Tools Progress */}
        <NotificationDropdown />

        <LanguageSwitcher />

        {/* Decorative Theme & Color Scheme Picker */}
        <ThemePalettePicker />

        <button
          type="button"
          onClick={toggleTheme}
          className={styles.iconButton}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className={styles.divider} />

        {isGuest ? (
          <div className={styles.guestSection}>
            <div className={styles.guestBadge}>
              <Eye size={13} />
              <span>{t('auth.view_only', 'View Only')}</span>
            </div>
            <Link
              to="/login"
              className={styles.guestLoginBtn}
              title={t('auth.login_with_adcorp', 'Login menggunakan Akun ADCorp')}
            >
              <LogIn size={14} />
              <span>{t('auth.login_with_adcorp', 'Login ADCorp')}</span>
            </Link>
          </div>
        ) : (
          user && (
            <div className={styles.userProfile}>
              <Link to="/profile" className={styles.profileLink} title="Edit Profile">
                <Avatar name={user.full_name} src={user.avatar_path} size="sm" />
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.full_name}</span>
                  <span className={styles.userRole}>
                    {user.group_part_name || user.role}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={logout}
                className={styles.logoutButton}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )
        )}
      </div>
    </header>
  );
};
