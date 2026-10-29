import React, { useState, useEffect } from 'react';
import { useI18n } from './i18n/context';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TripDetail } from './components/TripDetail';
import { AuditView } from './components/AuditView';
import { AuthScreen } from './components/AuthScreen';
import { AdminLogin } from './components/AdminLogin';
import { AdminDashboard } from './components/AdminDashboard';
import { ProfileModal } from './components/ProfileModal';

export const App: React.FC = () => {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [hasSuperAdmin, setHasSuperAdmin] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [person, setPerson] = useState<any>(null);
  const [family, setFamily] = useState<any>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Path & Navigation state
  const [isAdminLoginMode, setIsAdminLoginMode] = useState<boolean>(
    typeof window !== 'undefined' && window.location.pathname === '/admin/login'
  );
  const [activeNav, setActiveNav] = useState<'dashboard' | 'audit' | 'admin_dashboard'>(
    typeof window !== 'undefined' && window.location.pathname === '/admin/dashboard' ? 'admin_dashboard' : 'dashboard'
  );
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  const checkAuthStatus = async () => {
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
      } else if (path === '/admin/dashboard') {
        setActiveNav('admin_dashboard');
      } else {
        setIsAdminLoginMode(false);
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
      );
    }

    // 2. Normal Family Member Login
    return (
      <AuthScreen
        hasSuperAdmin={hasSuperAdmin}
        onAuthSuccess={(data) => {
          setUser(data.user);
          setPerson(data.person);
          setFamily(data.family);
          setHasSuperAdmin(true);
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
      />

      <main style={{ flex: 1 }}>
        {selectedTripId ? (
          <TripDetail
            tripId={selectedTripId}
            currentUser={user}
            currentPerson={person}
            currentFamily={family}
            onBack={() => setSelectedTripId(null)}
          />
        ) : activeNav === 'audit' ? (
          <AuditView onBack={() => setActiveNav('dashboard')} />
        ) : (
          <Dashboard
            user={user}
            person={person}
            family={family}
            onSelectTrip={(id) => setSelectedTripId(id)}
          />
        )}
      </main>

      {showProfileModal && (
        <ProfileModal
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={checkAuthStatus}
        />
      )}
    </div>
  );
};
