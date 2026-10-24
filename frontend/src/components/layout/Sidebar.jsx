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
  FileStack,
  Truck,
  Activity,
  GraduationCap,
  Terminal,
  Video,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/client';
import styles from './Sidebar.module.css';

export const Sidebar = ({ isCollapsed, onToggleChat, onToggleCollapse }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  // Check active routes
  const isSoftwareTeamActive =
    location.pathname.startsWith('/software-mr') || location.pathname.startsWith('/gba-tasks');
  const isToolsActive = location.pathname.startsWith('/tools') || location.pathname.startsWith('/utility');
  const isSampleManagementActive = location.pathname.startsWith('/samples');

  // Tools sub-category active checks
  const isToolsDocsActive = location.pathname === '/tools/documents' || location.pathname === '/tools/pdf-merge-split';
  const isToolsMediaActive =
    location.pathname === '/tools/images' ||
    location.pathname === '/tools/remove-bg' ||
    location.pathname === '/tools/video-compress' ||
    location.pathname === '/utility/remove-bg';
  const isToolsSwActive = location.pathname === '/tools/cl-compare' || location.pathname === '/tools/build-command';

  // Single open group state (accordion pattern: max 1 multilevel menu open at any time)
  const [openGroupKey, setOpenGroupKey] = useState(() => {
    if (isSampleManagementActive) return 'sample-management';
    if (isSoftwareTeamActive) return 'software-team';
    if (isToolsActive) return 'tools';
    return localStorage.getItem('pe_sidebar_open_group') || null;
  });

  // Sub-level accordion inside Tools: max 1 sub-group open at a time
  const [openToolsSubKey, setOpenToolsSubKey] = useState(() => {
    if (isToolsDocsActive) return 'dokumen';
    if (isToolsMediaActive) return 'media';
    if (isToolsSwActive) return 'software-dev';
    return 'dokumen';
  });

  // Auto-switch open group when route changes to an active section
  useEffect(() => {
    if (isSampleManagementActive) {
      setOpenGroupKey('sample-management');
    } else if (isSoftwareTeamActive) {
      setOpenGroupKey('software-team');
    } else if (isToolsActive) {
      setOpenGroupKey('tools');
    }
  }, [isSampleManagementActive, isSoftwareTeamActive, isToolsActive]);

  useEffect(() => {
    if (isToolsDocsActive) setOpenToolsSubKey('dokumen');
    else if (isToolsMediaActive) setOpenToolsSubKey('media');
    else if (isToolsSwActive) setOpenToolsSubKey('software-dev');
  }, [isToolsDocsActive, isToolsMediaActive, isToolsSwActive]);

  // Dynamic Menu Permissions & Role/Part-based Visibility
  const [menuPermissions, setMenuPermissions] = useState(() => {
    try {
      const cached = localStorage.getItem('pe_menu_permissions');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const fetchPerms = () => {
      api.get('/navigation/menu-permissions')
        .then((res) => {
          if (Array.isArray(res.data)) {
            setMenuPermissions(res.data);
            localStorage.setItem('pe_menu_permissions', JSON.stringify(res.data));
          }
        })
        .catch(() => {});
    };

    fetchPerms();

    window.addEventListener('pe_menu_permissions_updated', fetchPerms);
    return () => window.removeEventListener('pe_menu_permissions_updated', fetchPerms);
  }, []);

  const isMenuAllowed = (key) => {
    // Admin always has full visibility
    if (isAdmin) return true;
    if (!menuPermissions || !Array.isArray(menuPermissions)) return true;

    const perm = menuPermissions.find((p) => p.menu_key === key);
    if (!perm) return true;

    // 1. Master enable/disable toggle
    if (perm.is_visible === false) return false;

    const uName = (user?.username || '').toLowerCase();
    const uEmp = (user?.employee_id || '').toLowerCase();
    const uEmail = (user?.email || '').toLowerCase();
    const uId = (user?.id || '').toLowerCase();

    // 2. Blacklist Specific User check (if blacklisted, immediately deny)
    if (perm.blocked_users && perm.blocked_users.length > 0) {
      const isBlacklisted = perm.blocked_users.some((u) => {
        const t = (u || '').toLowerCase().trim();
        return t && (t === uName || t === uEmp || t === uEmail || t === uId);
      });
      if (isBlacklisted) return false;
    }

    // 3. Whitelist Specific User check (if configured, only whitelisted users can access)
    if (perm.allowed_users && perm.allowed_users.length > 0) {
      const isWhitelisted = perm.allowed_users.some((u) => {
        const t = (u || '').toLowerCase().trim();
        return t && (t === uName || t === uEmp || t === uEmail || t === uId);
      });
      if (!isWhitelisted) return false;
    }

    // 4. Role-based check
    if (perm.allowed_roles && perm.allowed_roles.length > 0) {
      const userRole = user?.role || 'member';
      if (!perm.allowed_roles.includes(userRole)) {
        return false;
      }
    }

    // 5. Department / Part-based check
    if (perm.allowed_groups && perm.allowed_groups.length > 0) {
      const userParentGroup = user?.parent_group || '';
      const userGroupIds = Array.isArray(user?.group_part_ids) && user.group_part_ids.length > 0
        ? user.group_part_ids
        : (user?.group_part_id ? [user.group_part_id] : []);
      const match = perm.allowed_groups.some(
        (g) => g === userParentGroup || userGroupIds.includes(g)
      );
      if (!match) {
        return false;
      }
    }

    return true;
  };

  const handleToggleGroup = (groupKey) => {
    setOpenGroupKey((prev) => {
      const next = prev === groupKey ? null : groupKey;
      if (next) {
        localStorage.setItem('pe_sidebar_open_group', next);
      } else {
        localStorage.removeItem('pe_sidebar_open_group');
      }
      return next;
    });
  };

  const handleToggleToolsSub = (subKey) => {
    setOpenToolsSubKey((prev) => (prev === subKey ? null : subKey));
  };

  const softwareTeamSubItems = [
    { key: 'software-gba', to: '/gba-tasks', label: t('nav.gba_tasks', 'GBA Tasks'), icon: Kanban },
    { key: 'software-mr', to: '/software-mr', label: t('nav.software_mr', 'Software MR'), icon: GitCompare },
  ]
    .filter((sub) => isMenuAllowed(sub.key))
    .sort((a, b) => a.label.localeCompare(b.label));

  const toolsNestedGroups = [
    {
      key: 'dokumen',
      label: t('nav.tools_category_docs', 'Dokumen'),
      icon: FileArchive,
      isActive: isToolsDocsActive,
      isOpen: openToolsSubKey === 'dokumen',
      onToggle: () => handleToggleToolsSub('dokumen'),
      children: [
        { key: 'tools-documents', to: '/tools/documents', label: t('nav.tools_docs', 'Document PDF Compress'), icon: FileArchive },
        { key: 'tools-pdf-merge-split', to: '/tools/pdf-merge-split', label: t('nav.tools_pdf_merge_split', 'PDF Merge & Split'), icon: FileStack },
      ]
        .filter((sub) => isMenuAllowed(sub.key))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
    {
      key: 'media',
      label: t('nav.tools_category_media', 'Media'),
      icon: ImageIcon,
      isActive: isToolsMediaActive,
      isOpen: openToolsSubKey === 'media',
      onToggle: () => handleToggleToolsSub('media'),
      children: [
        { key: 'tools-images', to: '/tools/images', label: t('nav.tools_images', 'Image Converter & Compress'), icon: ImageIcon },
        { key: 'tools-remove-bg', to: '/tools/remove-bg', label: t('nav.tools_bg', 'Local Remove Background'), icon: Scissors },
        { key: 'tools-video-compress', to: '/tools/video-compress', label: t('nav.tools_video_compress', 'Video Compressor (VAAPI)'), icon: Video },
      ]
        .filter((sub) => isMenuAllowed(sub.key))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
    {
      key: 'software-dev',
      label: t('nav.tools_category_sw', 'Software Dev'),
      icon: Terminal,
      isActive: isToolsSwActive,
      isOpen: openToolsSubKey === 'software-dev',
      onToggle: () => handleToggleToolsSub('software-dev'),
      children: [
        { key: 'tools-cl-compare', to: '/tools/cl-compare', label: t('nav.tools_cl_compare', 'CL Compare'), icon: GitCompare },
        { key: 'tools-build-command', to: '/tools/build-command', label: t('nav.tools_build_command', 'Build Command'), icon: Terminal },
      ]
        .filter((sub) => isMenuAllowed(sub.key))
        .sort((a, b) => a.label.localeCompare(b.label)),
    },
  ].filter((group) => group.children.length > 0);

  const sampleManagementSubItems = [
    { key: 'sample-database', to: '/samples', label: t('nav.samples_database', 'Database Sample PE'), icon: PackageCheck, end: true },
    { key: 'sample-dhl', to: '/samples/dhl-tracker', label: t('nav.dhl_tracker', 'DHL Tracker'), icon: Truck },
  ]
    .filter((sub) => isMenuAllowed(sub.key))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Dashboard as prime top-level item
  const dashboardItem = { key: 'dashboard', to: '/', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard, end: true };

  // Operations items sorted alphabetically ASC
  const operationItems = [
    { key: 'articles', to: '/articles', label: t('nav.articles', t('nav.imei', 'Articles')), icon: Newspaper },
    { key: 'documents', to: '/documents', label: t('nav.documents'), icon: FolderArchive },
    { key: 'innovations', to: '/innovations', label: t('nav.innovations', 'Innovation'), icon: Lightbulb },
    { key: 'models', to: '/models', label: t('nav.models'), icon: Cpu },
    { key: 'gmes', to: '/gmes', label: t('nav.gmes', 'GMES Monitor'), icon: Activity },
    { key: 'training', to: '/training', label: t('nav.training', 'Online Training'), icon: GraduationCap },
    ...(sampleManagementSubItems.length > 0
      ? [
          {
            isGroup: true,
            key: 'sample-management',
            label: t('nav.sample_management', 'Sample Management'),
            icon: PackageCheck,
            isActive: isSampleManagementActive,
            isOpen: openGroupKey === 'sample-management',
            onToggle: () => handleToggleGroup('sample-management'),
            children: sampleManagementSubItems,
          },
        ]
      : []),
    ...(softwareTeamSubItems.length > 0
      ? [
          {
            isGroup: true,
            key: 'software-team',
            label: t('nav.software_team', 'Software Team'),
            icon: Code2,
            isActive: isSoftwareTeamActive,
            isOpen: openGroupKey === 'software-team',
            onToggle: () => handleToggleGroup('software-team'),
            children: softwareTeamSubItems,
          },
        ]
      : []),
    { key: 'project-calendar', to: '/project-calendar', label: t('nav.project_calendar', 'Project Calendar'), icon: CalendarDays },
    { key: 'projects', to: '/projects', label: t('nav.projects', 'ToDo List'), icon: FolderKanban },
    { key: 'team', to: '/team', label: t('nav.team'), icon: Users },
    ...(toolsNestedGroups.length > 0
      ? [
          {
            isGroup: true,
            isNested: true,
            key: 'tools',
            label: t('nav.tools', 'Tools'),
            icon: Wrench,
            isActive: isToolsActive,
            isOpen: openGroupKey === 'tools',
            onToggle: () => handleToggleGroup('tools'),
            nestedGroups: toolsNestedGroups,
          },
        ]
      : []),
    { key: 'reports', to: '/reports', label: t('nav.reports'), icon: FileText },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const visibleOperationItems = operationItems.filter((item) => isMenuAllowed(item.key));
  const isDashboardVisible = isMenuAllowed('dashboard');

  const adminItems = [
    ...(isAdmin ? [{ key: 'admin', to: '/admin', label: t('nav.admin'), icon: ShieldCheck }] : []),
    { key: 'profile', to: '/profile', label: t('nav.profile'), icon: UserCircle },
    { key: 'settings', to: '/settings', label: t('nav.settings'), icon: Settings },
  ]
    .filter((item) => isMenuAllowed(item.key))
    .sort((a, b) => a.label.localeCompare(b.label));

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
            <span className={styles.brandSubtitle}>{t('app.subtitle', 'SEIN PE Group')}</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        {/* Prime Dashboard Navigation Item at Top */}
        {isDashboardVisible && (
          <>
            <NavLink
              to={dashboardItem.to}
              end={dashboardItem.end}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
              title={dashboardItem.label}
            >
              <LayoutDashboard size={18} className={styles.navIcon} />
              {!isCollapsed && <span>{dashboardItem.label}</span>}
            </NavLink>
            <div className={styles.navDivider} />
          </>
        )}

        {visibleOperationItems.length > 0 && (
          <div className={styles.sectionLabel}>{!isCollapsed && t('nav.section_operations', 'OPERATIONS')}</div>
        )}
        {visibleOperationItems.map((item) => {
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
                    {item.isNested ? (
                      item.nestedGroups.map((nested) => {
                        const NestedIcon = nested.icon;
                        return (
                          <div key={nested.key} className={styles.nestedGroup}>
                            <button
                              type="button"
                              className={`${styles.nestedHeader} ${nested.isActive ? styles.nestedHeaderActive : ''}`}
                              onClick={nested.onToggle}
                              title={nested.label}
                              aria-expanded={nested.isOpen}
                            >
                              <div className={styles.nestedTitle}>
                                <NestedIcon size={14} className={styles.navIcon} />
                                <span>{nested.label}</span>
                              </div>
                              <ChevronDown
                                size={12}
                                className={`${styles.chevronIcon} ${nested.isOpen ? styles.chevronOpen : ''}`}
                              />
                            </button>

                            {nested.isOpen && (
                              <div className={styles.nestedSubnavContainer}>
                                {nested.children.map((sub) => {
                                  const SubIcon = sub.icon;
                                  return (
                                    <NavLink
                                      key={sub.to}
                                      to={sub.to}
                                      end={sub.end}
                                      className={({ isActive }) =>
                                        `${styles.nestedSubnavLink} ${isActive ? styles.nestedSubnavActive : ''}`
                                      }
                                      title={sub.label}
                                    >
                                      <SubIcon size={13} className={styles.navIcon} />
                                      <span>{sub.label}</span>
                                    </NavLink>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      item.children.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            end={sub.end}
                            className={({ isActive }) =>
                              `${styles.subnavLink} ${isActive ? styles.subnavActive : ''}`
                            }
                            title={sub.label}
                          >
                            <SubIcon size={15} className={styles.navIcon} />
                            {!isCollapsed && <span>{sub.label}</span>}
                          </NavLink>
                        );
                      })
                    )}
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
