import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Lightbulb,
  Kanban,
  Cpu,
  FileSpreadsheet,
  FolderArchive,
  Users,
  Settings,
  ShieldCheck,
  BotMessageSquare,
  UserCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

export const Sidebar = ({ isCollapsed, onToggleChat }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/innovations', label: t('nav.innovations'), icon: Lightbulb },
    { to: '/projects', label: t('nav.projects'), icon: Kanban },
    { to: '/models', label: t('nav.models'), icon: Cpu },
    { to: '/imei', label: t('nav.imei'), icon: FileSpreadsheet },
    { to: '/documents', label: t('nav.documents'), icon: FolderArchive },
    { to: '/team', label: t('nav.team'), icon: Users },
    { to: '/reports', label: t('nav.reports'), icon: FileText },
  ];

  const adminItems = [
    { to: '/profile', label: t('nav.profile'), icon: UserCircle },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin'), icon: ShieldCheck }] : []),
  ];

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.brand}>
        <div className={styles.logoBadge}>
          <img src="/icon.png" alt="PE Logo" className={styles.brandLogoImg} />
        </div>
        {!isCollapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>PE-Portal</span>
            <span className={styles.brandSubtitle}>SEIN Engineering</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        <div className={styles.sectionLabel}>{!isCollapsed && 'OPERATIONS'}</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} className={styles.navIcon} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        <div className={styles.divider} />
        <div className={styles.sectionLabel}>{!isCollapsed && 'MANAGEMENT'}</div>
        {adminItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon size={18} className={styles.navIcon} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        <div className={styles.divider} />
        <button
          type="button"
          onClick={onToggleChat}
          className={styles.chatTrigger}
          title={isCollapsed ? t('nav.ai_assistant') : undefined}
        >
          <BotMessageSquare size={18} className={styles.chatIcon} />
          {!isCollapsed && <span>{t('nav.ai_assistant')}</span>}
        </button>
      </nav>
    </aside>
  );
};
