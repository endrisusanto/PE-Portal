import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { ThemePalettePicker } from '../common/ThemePalettePicker';
import { Avatar } from '../common/Avatar';
import styles from './TopBar.module.css';

export const TopBar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button
          type="button"
          onClick={onToggleSidebar}
          className={styles.iconButton}
          aria-label="Toggle navigation sidebar"
        >
          <Menu size={18} />
        </button>
        <span className={styles.orgTag}>SEIN PE GROUP</span>
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

        {user && (
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
        )}
      </div>
    </header>
  );
};
