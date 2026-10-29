import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { NatureLogo } from './NatureBanners';
import { LogOut, Globe, Shield, Home, Users, Compass, MapPinned, ShieldAlert, User } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';
import { ProfileModal } from './ProfileModal';

interface Props {
  user: any;
  person: any;
  family: any;
  onLogout: () => void;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  onSelectTrip?: (tripId: number) => void;
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<Props> = ({
  user,
  person,
  family,
  onLogout,
  activeNav,
  setActiveNav,
  onSelectTrip,
  onOpenProfile,
}) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <nav style={{
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '66px' }}>
        {/* Brand */}
        <div
          onClick={() => setActiveNav('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: '#0f172a',
            color: '#ffffff',
          }}>
            <MapPinned size={18} />
          </span>
          <div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#0f172a',
              display: 'block',
              lineHeight: 1.15,
            }}>
              {t.appName}
            </span>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
              {family ? family.name : 'Private family trips'}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            style={{
              background: activeNav === 'dashboard' ? '#0f172a' : 'transparent',
              color: activeNav === 'dashboard' ? '#ffffff' : '#64748b',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '9px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Compass size={16} />
            <span>{t.trips}</span>
          </button>

          {user.role === 'super_admin' && (
            <button
              type="button"
              onClick={() => setActiveNav('admin_dashboard')}
              style={{
                background: activeNav === 'admin_dashboard' ? '#0f172a' : '#fef3c7',
                color: activeNav === 'admin_dashboard' ? '#ffffff' : '#b45309',
                border: activeNav === 'admin_dashboard' ? '1px solid #0f172a' : '1px solid #fde68a',
                padding: '0.45rem 0.85rem',
                borderRadius: '9px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={15} />
              <span>{t.adminDashboard || 'Super Admin'}</span>
            </button>
          )}

          {/* Notification Center */}
          <NotificationCenter onSelectTrip={onSelectTrip || (() => {})} />

          {/* Language Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
          }}>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              style={{
                background: language === 'en' ? '#ffffff' : 'transparent',
                color: language === 'en' ? '#0f172a' : '#64748b',
                border: 'none',
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: language === 'en' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('te')}
              style={{
                background: language === 'te' ? '#ffffff' : 'transparent',
                color: language === 'te' ? '#0f172a' : '#64748b',
                border: 'none',
                padding: '0.25rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: language === 'te' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              తెలుగు
            </button>
          </div>

          {/* User Profile Pill & Trigger */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            marginLeft: '0.4rem',
            background: '#ffffff',
            padding: '0.35rem 0.75rem',
            borderRadius: '9999px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}>
            <button
              type="button"
              onClick={() => onOpenProfile && onOpenProfile()}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'right',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
              title="View & Edit Family Profile"
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <User size={14} />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  {person?.display_name || user.email.split('@')[0]}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'capitalize' }}>
                  {family ? family.name : user.role.replace('_', ' ')}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={onLogout}
              title={t.logout}
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.3rem',
                transition: 'all 0.15s ease',
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
