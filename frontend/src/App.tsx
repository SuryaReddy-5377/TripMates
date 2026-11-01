import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useI18n } from './i18n/context';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TripDetail } from './components/TripDetail';
import { AuthScreen } from './components/AuthScreen';
import { ProfileModal } from './components/ProfileModal';
import { Footer } from './components/Footer';
import { SuggestionModal } from './components/SuggestionModal';

// Code-split large, role-specific components to optimize bundle size and page load speed
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminLogin = lazy(() => import('./components/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AuditView = lazy(() => import('./components/AuditView').then(m => ({ default: m.AuditView })));

export const App: React.FC = () => {
  const { t } = useI18n();

  // If a session token exists in localStorage, display the initial auth spinner while verifying;
  // If NO token exists, render the public landing page instantly without waiting for network requests!
  const initialHasToken = typeof window !== 'undefined' && !!localStorage.getItem('tripmates_token');
  const [loading, setLoading] = useState(initialHasToken);
  const [hasSuperAdmin, setHasSuperAdmin] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [person, setPerson] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Path & Navigation state
  const [isAdminLoginMode, setIsAdminLoginMode] = useState<boolean>(
    typeof window !== 'undefined' && window.location.pathname === '/admin/login'
  );
  const [isSetupMode, setIsSetupMode] = useState<boolean>(
    typeof window !== 'undefined' && window.location.pathname === '/setup'
  );
  const [activeNav, setActiveNav] = useState<'dashboard' | 'audit' | 'admin_dashboard'>(
    typeof window !== 'undefined' && window.location.pathname === '/admin/dashboard' ? 'admin_dashboard' : 'dashboard'
  );
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  const checkAuthStatus = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tripmates_token') : null;

    if (!token) {
      // Unauthenticated visitor: run status check quietly in background
      try {
        const res = await api.get('/auth/status');
        setHasSuperAdmin(res.hasSuperAdmin);
        if (res.hasSuperAdmin && window.location.pathname === '/setup') {
          window.history.replaceState({}, '', '/admin/login');
          setIsAdminLoginMode(true);
          setIsSetupMode(false);
        }
      } catch {
        setHasSuperAdmin(true);
      }
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/auth/status');
      setHasSuperAdmin(res.hasSuperAdmin);
      setUser(res.user);
      setPerson(res.person);
      setFamily(res.family);

      // If user is super_admin and URL is /admin/dashboard, show admin dashboard
      if (res.user?.role === 'super_admin' && window.location.pathname === '/admin/dashboard') {
        setActiveNav('admin_dashboard');
      } else if (res.user && res.user.role !== 'super_admin' && activeNav === 'admin_dashboard') {
        // Enforce RBAC: Non-admin users cannot be in admin dashboard
        setActiveNav('dashboard');
        window.history.pushState({}, '', '/');
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
      // Guarantee hasSuperAdmin remains true on connection glitch so user gets standard login
      setHasSuperAdmin(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();

    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/admin/login') {
        setIsAdminLoginMode(true);
        setIsSetupMode(false);
      } else if (path === '/setup') {
        setIsAdminLoginMode(false);
        setIsSetupMode(true);
      } else if (path === '/admin/dashboard') {
        setActiveNav('admin_dashboard');
      } else {
        setIsAdminLoginMode(false);
        setIsSetupMode(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('tripmates_token');
    setUser(null);
    setPerson(null);
    setFamily(null);
    setSelectedTripId(null);
    setActiveNav('dashboard');
    window.history.pushState({}, '', '/');
    checkAuthStatus();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fbfaf7' }}>
        <div style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{t.loading}</div>
      </div>
    );
  }

  // If not logged in:
  if (!user) {
    // 1. Dedicated Super Admin Login at /admin/login
    if (isAdminLoginMode) {
      return (
        <Suspense fallback={
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
            {t.loading}
          </div>
        }>
          <AdminLogin
            onAdminLoginSuccess={(data) => {
              setUser(data.user);
              setPerson(data.person);
              setFamily(null);
              setIsAdminLoginMode(false);
              setActiveNav('admin_dashboard');
              window.history.pushState({}, '', '/admin/dashboard');
            }}
            onSwitchToFamilyLogin={() => {
              setIsAdminLoginMode(false);
              window.history.pushState({}, '', '/');
            }}
          />
        </Suspense>
      );
    }

    // 2. Family Member Login / Registration / Initial Setup
    return (
      <AuthScreen
        hasSuperAdmin={hasSuperAdmin}
        isSetupMode={isSetupMode && !hasSuperAdmin}
        onExitSetup={() => {
          setIsSetupMode(false);
          window.history.pushState({}, '', '/');
        }}
        onAuthSuccess={(data) => {
          setUser(data.user);
          setPerson(data.person);
          setFamily(data.family);
          setHasSuperAdmin(true);
          setIsSetupMode(false);
          if (data.user?.role === 'super_admin') {
            setActiveNav('admin_dashboard');
            window.history.pushState({}, '', '/admin/dashboard');
          } else {
            setActiveNav('dashboard');
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  // If logged in as Super Admin and active view is Admin Dashboard:
  if (user.role === 'super_admin' && activeNav === 'admin_dashboard') {
    return (
      <Suspense fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
          {t.loading}
        </div>
      }>
        <AdminDashboard
          onExitAdmin={() => {
            setActiveNav('dashboard');
            window.history.pushState({}, '', '/');
          }}
          onSelectTrip={(id) => {
            setSelectedTripId(id);
            setActiveNav('dashboard');
            window.history.pushState({}, '', '/');
          }}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  // Regular Application View (with Navbar, NotificationCenter, Trips, Detail)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        user={user}
        person={person}
        family={family}
        activeNav={activeNav}
        setActiveNav={(nav) => {
          setActiveNav(nav as any);
          setSelectedTripId(null);
          if (nav === 'admin_dashboard') {
            window.history.pushState({}, '', '/admin/dashboard');
          } else {
            window.history.pushState({}, '', '/');
          }
        }}
        onSelectTrip={(id) => setSelectedTripId(id)}
        onLogout={handleLogout}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSuggestion={() => setShowSuggestionModal(true)}
      />

      <main style={{ flex: 1 }}>
        {activeNav === 'dashboard' && (
          selectedTripId ? (
            <TripDetail
              tripId={selectedTripId}
              user={user}
              person={person}
              family={family}
              onBack={() => setSelectedTripId(null)}
            />
          ) : (
            <Dashboard
              user={user}
              person={person}
              family={family}
              onSelectTrip={(id) => setSelectedTripId(id)}
            />
          )
        )}

        {activeNav === 'audit' && (
          <Suspense fallback={
            <div style={{ padding: '2rem', textAlign: 'center' }}>{t.loading}</div>
          }>
            <AuditView />
          </Suspense>
        )}
      </main>

      <Footer onOpenSuggestion={() => setShowSuggestionModal(true)} />

      {showProfileModal && (
        <ProfileModal
          user={user}
          person={person}
          family={family}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={checkAuthStatus}
        />
      )}

      {showSuggestionModal && (
        <SuggestionModal
          onClose={() => setShowSuggestionModal(false)}
        />
      )}
    </div>
  );
};
