import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  MapPinned,
  Camera,
  Receipt,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Footer } from './Footer';

interface RememberedAccount {
  email: string;
  displayName: string;
  lastUsed: string;
}

interface Props {
  hasSuperAdmin: boolean;
  isSetupMode?: boolean;
  onAuthSuccess: (data: any) => void;
  onNavigateToAdmin?: () => void;
  onExitSetup?: () => void;
}

export const AuthScreen: React.FC<Props> = ({
  hasSuperAdmin,
  isSetupMode = false,
  onAuthSuccess,
  onExitSetup,
}) => {
  const { t, language, setLanguage } = useI18n();

  // Landing page hero view vs split auth form view
  const [view, setView] = useState<'landing' | 'auth'>(isSetupMode && !hasSuperAdmin ? 'auth' : 'landing');

  // Active form mode:
  // 'signin' -> Standard family & administrative login
  // 'register' -> Family registration with optional/required invitation code
  // 'setup' -> Genuine initial Super Admin setup (ONLY when system is unconfigured and requested)
  const [tab, setTab] = useState<'signin' | 'register' | 'setup'>(
    isSetupMode && !hasSuperAdmin ? 'setup' : 'signin'
  );

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Remembered accounts on this device (identifier and display name only, NO secrets or passwords)
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<RememberedAccount | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tripmates_remembered_accounts');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRememberedAccounts(parsed);
          if (parsed.length > 0) {
            setSelectedAccount(parsed[0]);
            setEmail(parsed[0].email);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRememberedAccount = (accEmail: string, accName?: string) => {
    try {
      const raw = localStorage.getItem('tripmates_remembered_accounts');
      const list: RememberedAccount[] = raw ? JSON.parse(raw) : [];
      const cleanEmail = accEmail.trim().toLowerCase();
      const filtered = list.filter(a => a.email.toLowerCase() !== cleanEmail);
      const updated: RememberedAccount = {
        email: cleanEmail,
        displayName: (accName || cleanEmail.split('@')[0]).trim(),
        lastUsed: new Date().toISOString(),
      };
      filtered.unshift(updated);
      const clamped = filtered.slice(0, 5);
      localStorage.setItem('tripmates_remembered_accounts', JSON.stringify(clamped));
      setRememberedAccounts(clamped);
      setSelectedAccount(updated);
    } catch {
      // ignore
    }
  };

  const removeRememberedAccount = (accEmail: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cleanEmail = accEmail.trim().toLowerCase();
      const filtered = rememberedAccounts.filter(a => a.email.toLowerCase() !== cleanEmail);
      localStorage.setItem('tripmates_remembered_accounts', JSON.stringify(filtered));
      setRememberedAccounts(filtered);
      if (selectedAccount && selectedAccount.email.toLowerCase() === cleanEmail) {
        if (filtered.length > 0) {
          setSelectedAccount(filtered[0]);
          setEmail(filtered[0].email);
        } else {
          setSelectedAccount(null);
          setEmail('');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSelectAccount = (account: RememberedAccount) => {
    setSelectedAccount(account);
    setEmail(account.email);
    setPassword('');
    setErrorMsg(null);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  const handleClearSelectedAccount = () => {
    setSelectedAccount(null);
    setEmail('');
    setPassword('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (tab === 'setup') {
        // Genuine initial Super Admin setup
        const res = await api.post('/auth/setup-admin', {
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        if (res.token) {
          localStorage.setItem('tripmates_token', res.token);
        }
        saveRememberedAccount(email, displayName);
        onAuthSuccess(res);
        return;
      }

      if (tab === 'register') {
        // Registration with optional or required invite code
        const payload: any = {
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        };
        if (inviteCode.trim()) {
          payload.invite_code = inviteCode.trim().toUpperCase();
        }
        const res = await api.post('/auth/register', payload);
        if (res.token) {
          localStorage.setItem('tripmates_token', res.token);
        }
        saveRememberedAccount(email, displayName);
        onAuthSuccess(res);
        return;
      }

      // Standard Family & Administrator Sign In
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });
      if (res.token) {
        localStorage.setItem('tripmates_token', res.token);
      }
      saveRememberedAccount(email, res.person?.display_name || email.split('@')[0]);
      onAuthSuccess(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // 1. LANDING HERO SCREEN
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
        {/* Full-bleed Nature Travel Hero Image */}
        <img
          src="/images/nature_hero.jpg"
          alt="TripMates Scenic Nature"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes('nature_hero.jpg')) {
              target.src = '/images/trip-kerala.jpg';
            } else if (target.src.includes('trip-kerala.jpg')) {
              target.src = '/images/mountain_resort.jpg';
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 35%',
            filter: 'brightness(0.88) contrast(1.04)',
          }}
        />

        {/* Cinematic Ambient Nature Scrim */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.28) 0%, rgba(15, 23, 42, 0.45) 45%, rgba(15, 23, 42, 0.92) 100%)',
        }} />

        {/* Top Floating Glass Navigation */}
        <header style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2rem',
          maxWidth: '1240px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#ffffff',
              color: '#0f172a',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <MapPinned size={22} />
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.45rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}>
              TripMates
            </span>
          </div>

          {/* Right Header Navigation Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            {/* Unconfigured System Alert Link */}
            {!hasSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTab('setup');
                  setView('auth');
                  setErrorMsg(null);
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.25)',
                  border: '1px solid rgba(147, 197, 253, 0.5)',
                  color: '#93c5fd',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Sparkles size={14} /> Initial Setup
              </button>
            )}

            {/* Language Switcher */}
            <div style={{
              display: 'flex',
              gap: '0.2rem',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '0.2rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                style={{
                  background: language === 'en' ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                  color: language === 'en' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('te')}
                style={{
                  background: language === 'te' ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                  color: language === 'te' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                తెలుగు
              </button>
            </div>
          </div>
        </header>

        {/* Hero Content Section */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '2rem 2rem 4rem 2rem',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{ maxWidth: '680px' }}>
            {/* Private Family Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.95rem',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#ffffff',
              marginBottom: '1.5rem',
            }}>
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              {t.heroBadge}
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 5.5vw, 4.2rem)',
              lineHeight: 1.12,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              marginBottom: '1.25rem',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}>
              {t.heroHeadline}
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.25rem)',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.92)',
              marginBottom: '2rem',
              maxWidth: '560px',
            }}>
              {t.heroSubtitle}
            </p>

            {/* Main Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '0.9rem',
              marginBottom: '2.5rem',
            }}>
              {/* Normal Sign In Button */}
              <button
                type="button"
                id="hero-signin-btn"
                onClick={() => {
                  setTab('signin');
                  setView('auth');
                  setErrorMsg(null);
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
                {t.signIn}
              </button>

              {/* Registration with Invitation Code Button */}
              <button
                type="button"
                id="hero-invite-btn"
                onClick={() => {
                  setTab('register');
                  setView('auth');
                  setErrorMsg(null);
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
                {t.haveInviteCode}
              </button>
            </div>

            {/* Feature Bullets */}
            <ul style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.85rem 1.5rem',
              listStyle: 'none',
              padding: 0,
              margin: 0,
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.92)',
              fontWeight: 500,
            }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={16} /> {t.featureOriginalPhotos}
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={16} /> {t.featureFairSplits}
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPinned size={16} /> {t.featureAllTrips}
              </li>
            </ul>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  // =========================================================================
  // 2. SPLIT AUTH SCREEN (Sign In / Registration / Initial Setup)
  // =========================================================================
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      backgroundColor: '#ffffff',
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
            {t.ammammaQuote}
          </p>
          <p style={{
            marginTop: '0.65rem',
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: 500,
          }}>
            {t.ammammaLocation}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setView('landing');
              setErrorMsg(null);
              if (onExitSetup) onExitSetup();
            }}
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
              id="auth-lang-en"
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
              id="auth-lang-te"
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
          padding: '0.5rem 0 2rem 0',
        }}>
          {/* Headline */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.9rem',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.025em',
            marginBottom: '0.35rem',
          }}>
            {tab === 'setup'
              ? t.appName
              : tab === 'signin'
              ? t.welcomeBack
              : t.joinFamily}
          </h1>

          <p style={{
            fontSize: '0.92rem',
            color: '#64748b',
            marginBottom: '1.5rem',
          }}>
            {tab === 'setup'
              ? t.initialSetupDesc
              : tab === 'signin'
              ? t.welcomeSubtitle
              : t.joinFamilySubtitle}
          </p>

          {/* Genuine Initial Setup Banner (ONLY visible when tab === 'setup') */}
          {tab === 'setup' && (
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
              <div style={{ flex: 1 }}>
                <strong>{t.initialSetupMode}</strong>
                <p style={{ marginTop: '0.2rem', margin: 0 }}>{t.initialSetupDesc}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setErrorMsg(null);
                  }}
                  style={{
                    marginTop: '0.5rem',
                    background: '#ffffff',
                    border: '1px solid #93c5fd',
                    color: '#1d4ed8',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Already configured? Sign in here →
                </button>
              </div>
            </div>
          )}

          {/* Tab Switcher (Visible on ordinary sign-in and registration) */}
          {tab !== 'setup' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '1.5rem',
            }}>
              <button
                type="button"
                id="tab-signin-btn"
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
                {t.signIn}
              </button>

              <button
                type="button"
                id="tab-register-btn"
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
                {t.register}
              </button>
            </div>
          )}

          {/* Remembered Accounts Section (Quick Login) */}
          {tab === 'signin' && rememberedAccounts.length > 0 && (
            <div style={{
              marginBottom: '1.35rem',
              padding: '0.85rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t.rememberedOnDevice}
                </span>
                {selectedAccount && (
                  <button
                    type="button"
                    onClick={handleClearSelectedAccount}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {t.useDifferentAccount}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {rememberedAccounts.map((acc) => {
                  const isSelected = selectedAccount?.email.toLowerCase() === acc.email.toLowerCase();
                  return (
                    <div
                      key={acc.email}
                      onClick={() => handleSelectAccount(acc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '8px',
                        background: isSelected ? '#ffffff' : 'transparent',
                        border: isSelected ? '1.5px solid #0f172a' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? '#0f172a' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {acc.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {acc.displayName}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {acc.email}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        title={t.removeAccount}
                        onClick={(e) => removeRememberedAccount(acc.email, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
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
            {tab === 'register' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.invitationCodeOptional}</label>
                <input
                  type="text"
                  id="auth-invite-code"
                  className="form-input"
                  placeholder="e.g. FAM-1234 or TRIP-789A (optional)"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                />
              </div>
            )}

            {/* Display Name (if setup or registering) */}
            {(tab === 'setup' || tab === 'register') && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.fullName}</label>
                <input
                  type="text"
                  id="auth-fullname"
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
              <label className="form-label">{t.email}</label>
              <input
                type="email"
                id="auth-email"
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
                <label className="form-label">{t.password}</label>
                {tab === 'signin' && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {t.standardFamilyLogin}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-password"
                  ref={passwordInputRef}
                  className="form-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={6}
                  required
                  style={{ paddingRight: '2.5rem', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="auth-submit-btn"
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
                : tab === 'setup'
                ? t.completeSetupLaunch
                : tab === 'register'
                ? t.registerAndJoinTrip
                : t.signIn}
            </button>
            {isSubmitting && (
              <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                {t.connectingBackend}
              </p>
            )}
          </form>

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
            {t.privateSecurityFooter}
          </p>
        </div>
      </div>
    </div>
  );
};
