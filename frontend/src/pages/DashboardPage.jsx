import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Kanban,
  Lightbulb,
  Cpu,
  FolderArchive,
  Users,
  Plus,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import { Button } from '../components/common/Button';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import styles from './DashboardPage.module.css';

export const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingState message={t('dashboard.loading', 'Loading dashboard statistics...')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchStats} />;
  }

  const statCards = [
    {
      title: t('dashboard.stats.active_projects'),
      value: stats?.projects_count ?? 0,
      icon: Kanban,
      link: '/projects',
    },
    {
      title: t('dashboard.stats.innovations'),
      value: stats?.innovations_count ?? 0,
      icon: Lightbulb,
      link: '/innovations',
    },
    {
      title: t('dashboard.stats.new_models'),
      value: stats?.models_count ?? 0,
      icon: Cpu,
      link: '/models',
    },
    {
      title: t('dashboard.stats.documents'),
      value: stats?.documents_count ?? 0,
      icon: FolderArchive,
      link: '/documents',
    },
    {
      title: t('dashboard.stats.team_members'),
      value: stats?.users_count ?? 0,
      icon: Users,
      link: '/team',
    },
  ];

  return (
    <div className={styles.container}>
      {/* Welcome Banner */}
      <div className={styles.banner}>
        <div>
          <span className={styles.badge}>{t('dashboard.team_badge')}</span>
          <h1 className={styles.heading}>
            {t('dashboard.welcome')}, {user?.full_name || 'Engineer'}
          </h1>
          <p className={styles.subheading}>
            {t('dashboard.group_part', 'Group Part')}: <strong>{user?.group_part_name || 'Production Engineer'}</strong> | {t('dashboard.role', 'Role')}: <strong>{user?.role}</strong>
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className={styles.statsGrid}>
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={styles.statCard}
              onClick={() => navigate(card.link)}
            >
              <div className={styles.statHeader}>
                <span className={styles.statTitle}>{card.title}</span>
                <Icon size={18} className={styles.statIcon} />
              </div>
              <div className={styles.statValue}>{card.value}</div>
              <div className={styles.statFooter}>
                <span>{t('dashboard.view_records', 'View records')}</span>
                <ArrowRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions & Recent Activity Layout */}
      <div className={styles.contentGrid}>
        {/* Quick Actions */}
        <div className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>{t('dashboard.quick_actions')}</h2>
          <div className={styles.actionButtons}>
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => navigate('/innovations')}
            >
              {t('dashboard.new_idea')}
            </Button>
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => navigate('/projects')}
            >
              {t('dashboard.new_project')}
            </Button>
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => navigate('/models')}
            >
              {t('dashboard.new_model')}
            </Button>
            <Button
              variant="outline"
              icon={Plus}
              onClick={() => navigate('/documents')}
            >
              {t('dashboard.upload_doc')}
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.recent_activity')}</h2>
            <Activity size={16} className={styles.activityIcon} />
          </div>
          {stats?.recent_logs && stats.recent_logs.length > 0 ? (
            <ul className={styles.activityList}>
              {stats.recent_logs.map((log) => (
                <li key={log.id} className={styles.activityItem}>
                  <div className={styles.activityMain}>
                    <span className={styles.activityUser}>{log.user_name || 'System User'}</span>
                    <span className={styles.activityAction}>{log.action}</span>
                  </div>
                  <span className={styles.activityTime}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyActivity}>{t('dashboard.no_activity')}</p>
          )}
        </div>
      </div>
    </div>
  );
};
