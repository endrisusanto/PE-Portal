import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, KeyRound, User, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const from = location.state?.from?.pathname || searchParams.get('redirect') || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('auth.invalid_credentials');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.langBar}>
        <LanguageSwitcher />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="PE mobile" className={styles.loginLogo} />
          </div>
          <h1 className={styles.title}>{t('auth.login_title')}</h1>
          <p className={styles.subtitle}>{t('auth.login_subtitle')}</p>
        </div>

        {error && (
          <div className={styles.alertError} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" className={styles.form}>
          <Input
            label={t('auth.username_placeholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="off"
            placeholder="e.g. admin or employee_id"
          />

          <Input
            label={t('auth.password_placeholder')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className={styles.submitBtn}
          >
            {loading ? t('auth.signing_in') : t('auth.sign_in')}
          </Button>

          <button
            type="button"
            onClick={() => navigate(from, { replace: true })}
            className={styles.guestEntryBtn}
          >
            <Eye size={15} />
            <span>Masuk sebagai Guest (View Only)</span>
          </button>
        </form>

        <div className={styles.footerNote}>
          <span className={styles.hintTag}>SEIN PE Portal v2</span>
          <span>Supports local login and AD Corp LDAP</span>
        </div>
      </div>
    </div>
  );
};
