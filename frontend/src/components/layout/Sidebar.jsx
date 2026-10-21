import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Lightbulb,
  Kanban,
  FolderKanban,
  PackageCheck,
  GitCompare,
  Code2,
  ChevronDown,
  Cpu,
  Newspaper,
  FolderArchive,
  Users,
  Settings,
  ShieldCheck,
  BotMessageSquare,
  UserCircle,
  FileText,
  Wrench,
  Image as ImageIcon,
  FileArchive,
  Scissors,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

export const Sidebar = ({ isCollapsed, onToggleChat, onToggleCollapse }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  // Check if any Software Team route is active
  const isSoftwareTeamActive =
    location.pathname.startsWith('/software-mr') || location.pathname.startsWith('/gba-tasks');

  // Multi-level state for Software Team
  const [softwareTeamOpen, setSoftwareTeamOpen] = useState(() => {
    return isSoftwareTeamActive || localStorage.getItem('pe_sidebar_sw_team') === 'true';
  });

  // Auto-expand if user navigates to a software team route
  useEffect(() => {
    if (isSoftwareTeamActive) {
      setSoftwareTeamOpen(true);
    }
  }, [isSoftwareTeamActive]);

  const handleToggleSoftwareTeam = () => {
    setSoftwareTeamOpen((prev) => {
      const next = !prev;
      localStorage.setItem('pe_sidebar_sw_team', String(next));
      return next;
    });
  };

  const softwareTeamSubItems = [
    { to: '/gba-tasks', label: t('nav.gba_tasks', 'GBA Tasks'), icon: Kanban },
    { to: '/software-mr', label: t('nav.software_mr', 'Software MR'), icon: GitCompare },
  ];

  // Check if any Tools route is active
  const isToolsActive = location.pathname.startsWith('/tools') || location.pathname.startsWith('/utility');

  // Multi-level state for Tools
  const [toolsOpen, setToolsOpen] = useState(() => {
    return isToolsActive || localStorage.getItem('pe_sidebar_tools') === 'true';
  });

  useEffect(() => {
    if (isToolsActive) {
      setToolsOpen(true);
    }
  }, [isToolsActive]);

  const handleToggleTools = () => {
    setToolsOpen((prev) => {
      const next = !prev;
      localStorage.setItem('pe_sidebar_tools', String(next));
      return next;
    });
  };

  const toolsSubItems = [
    { to: '/tools/images', label: t('nav.tools_images', 'Image Converter & Compress'), icon: ImageIcon },
    { to: '/tools/documents', label: t('nav.tools_docs', 'Document PDF Compress'), icon: FileArchive },
    { to: '/tools/remove-bg', label: t('nav.tools_bg', 'Local Remove Background'), icon: Scissors },
  ];

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/innovations', label: t('nav.innovations'), icon: Lightbulb },
    { to: '/projects', label: t('nav.projects', 'Task Analyst'), icon: FolderKanban },
    { to: '/samples', label: t('nav.samples', 'Sample Management'), icon: PackageCheck },
    {
      isGroup: true,
      key: 'software-team',
      label: t('nav.software_team', 'Software Team'),
      icon: Code2,
      isActive: isSoftwareTeamActive,
      isOpen: softwareTeamOpen,
      onToggle: handleToggleSoftwareTeam,
      children: softwareTeamSubItems,
    },
    { to: '/models', label: t('nav.models'), icon: Cpu },
    { to: '/imei', label: t('nav.imei', 'Artikel'), icon: Newspaper },
    { to: '/documents', label: t('nav.documents'), icon: FolderArchive },
    {
      isGroup: true,
      key: 'tools',
      label: t('nav.tools', 'Tools'),
      icon: Wrench,
      isActive: isToolsActive,
      isOpen: toolsOpen,
      onToggle: handleToggleTools,
      children: toolsSubItems,
    },
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
      <div
        className={styles.brand}
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleCollapse?.();
          }
        }}
        title={isCollapsed ? t('nav.expand_sidebar', 'Expand sidebar') : t('nav.collapse_sidebar', 'Collapse sidebar')}
        aria-label={isCollapsed ? t('nav.expand_sidebar', 'Expand sidebar') : t('nav.collapse_sidebar', 'Collapse sidebar')}
      >
        <div className={styles.logoBadge} title={isCollapsed ? t('nav.expand_sidebar', 'Expand sidebar') : t('nav.collapse_sidebar', 'Collapse sidebar')}>
          <img src="/icon.png" alt="PE Logo" className={styles.brandLogoImg} />
        </div>
        {!isCollapsed && (
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>PE-Portal</span>
            <span className={styles.brandSubtitle}>{t('app.subtitle', 'SEIN Engineering')}</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        <div className={styles.sectionLabel}>{!isCollapsed && t('nav.section_operations', 'OPERATIONS')}</div>
        {navItems.map((item) => {
          if (item.isGroup) {
            const GroupIcon = item.icon;
            return (
              <div key={item.key} className={styles.navGroup}>
                <button
                  type="button"
                  className={`${styles.groupHeader} ${item.isActive ? styles.groupHeaderActive : ''}`}
                  onClick={() => {
                    if (isCollapsed) {
                      onToggleCollapse?.();
                      item.onToggle();
                    } else {
                      item.onToggle();
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                  aria-expanded={item.isOpen}
                >
                  <div className={styles.groupTitle}>
                    <GroupIcon size={18} className={styles.navIcon} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown
                      size={14}
                      className={`${styles.chevronIcon} ${item.isOpen ? styles.chevronOpen : ''}`}
                    />
                  )}
                </button>

                {item.isOpen && (
                  <div className={styles.subnavContainer}>
                    {item.children.map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          className={({ isActive }) =>
                            `${styles.subnavLink} ${isActive ? styles.subnavActive : ''}`
                          }
                          title={sub.label}
                        >
                          <SubIcon size={15} className={styles.navIcon} />
                          {!isCollapsed && <span>{sub.label}</span>}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              title={item.label}
            >
              <Icon size={18} className={styles.navIcon} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        <div className={styles.divider} />
        <div className={styles.sectionLabel}>{!isCollapsed && t('nav.section_management', 'MANAGEMENT')}</div>
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
