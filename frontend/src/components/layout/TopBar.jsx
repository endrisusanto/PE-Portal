import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, LogOut, Eye, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { ThemePalettePicker } from '../common/ThemePalettePicker';
import { Avatar } from '../common/Avatar';
import styles from './TopBar.module.css';

export const TopBar = () => {
  const { user, isGuest, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {isGuest && (
          <div className={styles.guestNotice}>
            <span className={styles.guestNoticeDot} />
            <span>Mode Tamu: Akses View Only aktif. Wajib login ADCorp untuk write/update data.</span>
          </div>
        )}
      </div>

      <div className={styles.right}>
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
              <span>View Only</span>
            </div>
            <Link
              to="/login"
              className={styles.guestLoginBtn}
              title="Login menggunakan Akun ADCorp"
            >
              <LogIn size={14} />
              <span>Login ADCorp</span>
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
