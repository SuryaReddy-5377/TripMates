import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  ShieldAlert,
  Lock,
  Mail,
  KeyRound,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface Props {
  onAdminLoginSuccess: (data: any) => void;
  onSwitchToFamilyLogin: () => void;
}

export const AdminLogin: React.FC<Props> = ({
  onAdminLoginSuccess,
  onSwitchToFamilyLogin,
}) => {
  const { t, language, setLanguage } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await api.post('/admin/login', {
        email: email.trim(),
        password,
      });

      if (res.token) {
        localStorage.setItem('tripmates_token', res.token);
      }
      onAdminLoginSuccess(res);
    } catch (err: any) {
      if (err.status === 429) {
        const retryAfter = err.data?.retryAfterSeconds || 900;
        setLockoutSeconds(retryAfter);
        setErrorMsg(err.message || `Too many failed attempts. Account locked temporarily.`);
      } else if (err.status === 403) {
        setErrorMsg(err.message || 'Access denied. Only designated Super Administrators can access this portal.');
      } else {
        setErrorMsg(err.message || 'Invalid administrative credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        position: 'relative',
        color: '#f8fafc',
      }}
    >
      {/* Top Bar with Language and Back to Family */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.5rem',
          right: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onSwitchToFamilyLogin}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#f8fafc',
            borderRadius: '10px',
            padding: '0.5rem 0.85rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <ArrowLeft size={16} />
          <span>{t.appName} Family Login</span>
        </button>

        {/* Language switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            style={{
              background: language === 'en' ? '#ffffff' : 'transparent',
              color: language === 'en' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('te')}
            style={{
              background: language === 'te' ? '#ffffff' : 'transparent',
              color: language === 'te' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            తెలుగు
          </button>
        </div>
      </div>

      {/* Main Admin Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
          color: '#0f172a',
          position: 'relative',
        }}
      >
        {/* Shield Icon Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
              color: '#f59e0b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
              marginBottom: '1rem',
            }}
          >
            <ShieldAlert size={32} />
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.65rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '0.35rem',
              letterSpacing: '-0.025em',
            }}
          >
            {t.adminPortal}
          </h2>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#fef3c7',
              color: '#b45309',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.65rem',
            }}
          >
            <Lock size={12} /> Restricted Super Admin Area
          </div>

          <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.45, margin: 0 }}>
            {t.adminLoginDesc}
          </p>
        </div>

        {/* Error / Lockout Alert */}
        {errorMsg && (
          <div
            style={{
              background: lockoutSeconds ? '#fffbeb' : '#fef2f2',
              border: lockoutSeconds ? '1px solid #fde68a' : '1px solid #fecaca',
              color: lockoutSeconds ? '#b45309' : '#dc2626',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}
          >
            {lockoutSeconds ? <Clock size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />}
            <div>
              <strong>{lockoutSeconds ? 'Login Rate Limited' : 'Authentication Rejected'}</strong>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '0.35rem',
              }}
            >
              Super Admin Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@tripmates.local"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.4rem',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#0f172a')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: '0.35rem',
              }}
            >
              Master Password
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.4rem',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#0f172a')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!lockoutSeconds}
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: isSubmitting || !!lockoutSeconds ? 'not-allowed' : 'pointer',
              opacity: isSubmitting || !!lockoutSeconds ? 0.6 : 1,
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <Lock size={16} />
            <span>{isSubmitting ? 'Authenticating...' : 'Sign in as Super Admin'}</span>
          </button>
        </form>

        {/* Security Notice Footer */}
        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center',
            fontSize: '0.76rem',
            color: '#94a3b8',
            lineHeight: 1.4,
          }}
        >
          All administrative sessions and actions are logged and cryptographically audited. Unauthorized access is forbidden.
        </div>
      </div>
    </div>
  );
};
