import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  MapPinned,
  Lock,
  Camera,
  Receipt,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  KeyRound,
  UserCheck,
} from 'lucide-react';

interface Props {
  hasSuperAdmin: boolean;
  onAuthSuccess: (data: any) => void;
  onNavigateToAdmin?: () => void;
}

export const AuthScreen: React.FC<Props> = ({ hasSuperAdmin, onAuthSuccess, onNavigateToAdmin }) => {
  const { t, language, setLanguage } = useI18n();

  // 'landing' shows the full-bleed hero page matching lovable.app
  // 'auth' shows the split sign-in / register view matching lovable.app/auth
  const [view, setView] = useState<'landing' | 'auth'>('landing');
  const [tab, setTab] = useState<'signin' | 'register'>('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (!hasSuperAdmin) {
        // First-time setup
        const res = await api.post('/auth/setup-admin', {
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        if (res.token) {
          localStorage.setItem('tripmates_token', res.token);
        }
        onAuthSuccess(res);
      } else if (tab === 'register') {
        // Register with invite code
        const res = await api.post('/auth/register-invite', {
          invite_code: inviteCode.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        if (res.token) {
          localStorage.setItem('tripmates_token', res.token);
        }
        onAuthSuccess(res);
      } else {
        // Regular email/password login
        const res = await api.post('/auth/login', {
          email: email.trim(),
          password,
        });
        if (res.token) {
          localStorage.setItem('tripmates_token', res.token);
        }
        onAuthSuccess(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (targetEmail: string) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/quick-login', { email: targetEmail });
      if (res.token) {
        localStorage.setItem('tripmates_token', res.token);
      }
      onAuthSuccess(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 1. LANDING HERO SCREEN (Exact match with lovable.app)
  // =========================================================================
  if (view === 'landing') {
    return (
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Full-bleed Beach Vacation Hero Image */}
        <img
          src="/images/photo-family-beach.jpg"
          alt="Family at the beach"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.72,
          }}
        />

        {/* Gradient Scrim Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.55) 50%, rgba(15, 23, 42, 0.92) 100%)',
          }}
        />

        {/* Inner Content Container */}
        <div style={{
          position: 'relative',
          maxWidth: '1024px',
          width: '100%',
          margin: '0 auto',
          padding: '1.75rem 1.5rem 3rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}>
          {/* Top Bar: Brand + Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#ffffff',
                color: '#0f172a',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                <MapPinned size={20} />
              </span>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.35rem',
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}>
                TripMates
              </span>
            </div>

            {/* Language Toggle */}
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
              padding: '0.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                style={{
                  background: language === 'en' ? '#ffffff' : 'transparent',
                  color: language === 'en' ? '#0f172a' : '#f8fafc',
                  border: 'none',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
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
                  color: language === 'te' ? '#0f172a' : '#f8fafc',
                  border: 'none',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                తెలుగు
              </button>
            </div>
          </div>

          {/* Bottom Hero Content */}
          <div className="fade-up" style={{ marginTop: 'auto', maxWidth: '640px', paddingTop: '4rem' }}>
            {/* Private family badge */}
            <p style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px)',
              padding: '0.35rem 0.9rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#ffffff',
              marginBottom: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}>
              <Lock size={14} /> Private · family invitation only
            </p>

            {/* Editorial Serif Headline */}
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 5vw, 3.8rem)',
              fontWeight: 600,
              lineHeight: 1.08,
              color: '#ffffff',
              letterSpacing: '-0.025em',
              marginBottom: '1rem',
            }}>
              Every trip, every photo, every rupee — together.
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              color: 'rgba(255, 255, 255, 0.9)',
              lineHeight: 1.55,
              fontWeight: 400,
              marginBottom: '2rem',
              maxWidth: '560px',
            }}>
              Plan our next getaway, keep photos in full original quality, and settle up fairly without the spreadsheet.
            </p>

            {/* Main Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '0.9rem',
              marginBottom: '2.5rem',
            }}>
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setView('auth');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '0.85rem 2rem',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setView('auth');
                }}
                style={{
                  background: '#f59e0b',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '0.85rem 2rem',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(245, 158, 11, 0.3)',
                  transition: 'transform 0.15s ease, background 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                I have an invite code
              </button>
            </div>

            {/* Feature Bullets */}
            <ul style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, auto)',
              gap: '1.25rem',
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.88)',
              fontWeight: 500,
            }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={16} /> Original photos
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={16} /> Fair splits
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPinned size={16} /> All our trips
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. AUTH SCREEN (Exact 2-column split matching lovable.app/auth)
  // =========================================================================
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      backgroundColor: '#fbfaf7',
    }} className="auth-grid-container">
      <style>{`
        .auth-grid-container {
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .auth-grid-container {
            grid-template-columns: 1.1fr 1fr !important;
          }
          .auth-scenic-sidebar {
            display: block !important;
          }
        }
      `}</style>

      {/* Left Column: Scenic Image & Ammamma Quote (Desktop) */}
      <div
        className="auth-scenic-sidebar"
        style={{
          display: 'none',
          position: 'relative',
          height: '100%',
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          overflow: 'hidden',
        }}
      >
        <img
          src="/images/trip-kerala.jpg"
          alt="Kerala Backwaters"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        {/* Scrim */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.4) 50%, rgba(15, 23, 42, 0.9) 100%)',
        }} />

        {/* Quote at bottom */}
        <div style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 0,
          padding: '2.5rem',
          color: '#ffffff',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.85rem',
            fontWeight: 600,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}>
            &quot;The houseboat morning — Ammamma still talks about it.&quot;
          </p>
          <p style={{
            marginTop: '0.65rem',
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: 500,
          }}>
            Kerala Backwaters · April 2026
          </p>
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '2rem 1.5rem',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}>
        {/* Top Header: Back to Home + Language */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button
            type="button"
            onClick={() => setView('landing')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#0f172a',
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              padding: 0,
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#0f172a',
              color: '#ffffff',
            }}>
              <MapPinned size={18} />
            </span>
            TripMates
          </button>

          {/* Language Switcher */}
          <div style={{
            display: 'flex',
            gap: '0.2rem',
            background: '#ffffff',
            padding: '0.2rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              style={{
                background: language === 'en' ? '#0f172a' : 'transparent',
                color: language === 'en' ? '#ffffff' : '#64748b',
                border: 'none',
                padding: '0.25rem 0.6rem',
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
                background: language === 'te' ? '#0f172a' : 'transparent',
                color: language === 'te' ? '#ffffff' : '#64748b',
                border: 'none',
                padding: '0.25rem 0.6rem',
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

        {/* Center Container */}
        <div className="fade-up" style={{
          width: '100%',
          maxWidth: '420px',
          margin: 'auto',
          padding: '1rem 0',
        }}>
          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.025em',
            marginBottom: '0.35rem',
          }}>
            {!hasSuperAdmin
              ? 'Welcome to TripMates'
              : tab === 'signin'
              ? 'Welcome back'
              : 'Join our family'}
          </h1>

          <p style={{
            fontSize: '0.95rem',
            color: '#64748b',
            marginBottom: '1.75rem',
          }}>
            {!hasSuperAdmin
              ? 'Initialize the primary Super Administrator account to begin.'
              : tab === 'signin'
              ? 'Sign in to see our trips, photos and balances.'
              : 'Enter your invitation code to access your family trips.'}
          </p>

          {/* First-time setup alert */}
          {!hasSuperAdmin && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              color: '#1e40af',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
            }}>
              <Sparkles size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#3b82f6' }} />
              <div>
                <strong>Initial Setup Mode</strong>
                <p style={{ marginTop: '0.2rem', margin: 0 }}>Create your Super Administrator credentials to manage families, trips, and system access.</p>
              </div>
            </div>
          )}

          {/* Tab Switcher (if system is already initialized) */}
          {hasSuperAdmin && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '1.75rem',
            }}>
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMsg(null);
                }}
                style={{
                  padding: '0.6rem 0',
                  border: 'none',
                  borderRadius: '9px',
                  background: tab === 'signin' ? '#ffffff' : 'transparent',
                  color: tab === 'signin' ? '#0f172a' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  boxShadow: tab === 'signin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                }}
                style={{
                  padding: '0.6rem 0',
                  border: 'none',
                  borderRadius: '9px',
                  background: tab === 'register' ? '#ffffff' : 'transparent',
                  color: tab === 'register' ? '#0f172a' : '#64748b',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  boxShadow: tab === 'register' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Register
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              color: '#b91c1c',
              fontSize: '0.88rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.1rem' }}>
            {/* If Registering with Invite Code */}
            {tab === 'register' && hasSuperAdmin && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Invitation Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. TRIP-789A"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  required
                />
              </div>
            )}

            {/* Display Name (if setup or registering) */}
            {(!hasSuperAdmin || tab === 'register') && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Surya Narayana"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Email Address */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="form-label">Password</label>
                {tab === 'signin' && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Standard family login
                  </span>
                )}
              </div>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1rem',
                borderRadius: '12px',
                marginTop: '0.35rem',
              }}
            >
              {isSubmitting
                ? t.loading
                : !hasSuperAdmin
                ? 'Complete Setup & Launch'
                : tab === 'register'
                ? 'Register & Join Trip'
                : 'Sign in'}
            </button>
          </form>

          {/* Quick 1-Click Sign-in for Surya / existing Super Admin */}
          {hasSuperAdmin && tab === 'signin' && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#94a3b8',
                fontSize: '0.78rem',
                marginBottom: '1rem',
              }}>
                <span style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
                <span>Quick Sign-In Helper</span>
                <span style={{ height: '1px', flex: 1, background: '#e2e8f0' }} />
              </div>

              <button
                type="button"
                onClick={() => handleQuickLogin('suryareddy1596@gmail.com')}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  color: '#0f172a',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#0f172a';
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <UserCheck size={16} color="#0f172a" />
                Sign in as Surya (surya reddy)
              </button>
            </div>
          )}

          {/* Footer Security Note */}
          <p style={{
            marginTop: '2rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.55rem',
            fontSize: '0.78rem',
            color: '#64748b',
            lineHeight: 1.5,
          }}>
            <ShieldCheck size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            Only invited family members can join. Photos and expenses are visible only to people on each trip.
          </p>

          {onNavigateToAdmin && (
            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={onNavigateToAdmin}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  textDecoration: 'underline',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
              >
                <Lock size={12} />
                <span>Super Admin Portal</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
