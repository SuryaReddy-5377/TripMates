import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  LayoutDashboard,
  Users,
  Compass,
  Receipt,
  RotateCcw,
  Shield,
  Search,
  Filter,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Trash2,
  Edit2,
  UserCheck,
  UserX,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Wallet,
  Calendar,
  MapPin,
  X,
  Layers,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  onExitAdmin: () => void;
  onSelectTrip?: (tripId: number) => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ onExitAdmin, onSelectTrip, onLogout }) => {
  const { t, formatINR } = useI18n();

  const [activeTab, setActiveTab] = useState<'overview' | 'families' | 'members' | 'invite_codes' | 'trips' | 'expenses' | 'audit'>('overview');
  const [loading, setLoading] = useState(false);

  // Overview metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Families state
  const [families, setFamilies] = useState<any[]>([]);
  const [familySearch, setFamilySearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<any | null>(null);
  const [familyModal, setFamilyModal] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; data?: any }>({ isOpen: false, mode: 'create' });
  const [familyNameInput, setFamilyNameInput] = useState('');

  // Members state
  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ isOpen: boolean; user?: any; newStatus?: number }>({ isOpen: false });

  // Remove user state
  const [removeUserModal, setRemoveUserModal] = useState<{ isOpen: boolean; user?: any }>({ isOpen: false });
  const [removeUserResult, setRemoveUserResult] = useState<string | null>(null);
  const [removeUserError, setRemoveUserError] = useState<string | null>(null);

  // Invite codes state
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [inviteCodeModal, setInviteCodeModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteFamilyId, setInviteFamilyId] = useState<string>('');
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const [revokeConfirmCode, setRevokeConfirmCode] = useState<any | null>(null);
  const [codeCopiedToast, setCodeCopiedToast] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Trips state
  const [trips, setTrips] = useState<any[]>([]);
  const [tripSearch, setTripSearch] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [selectedTripDetails, setSelectedTripDetails] = useState<any | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [voidConfirmExpense, setVoidConfirmExpense] = useState<any | null>(null);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Fetch overview metrics
  const loadOverview = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/overview');
      setMetrics(res.metrics);
      setRecentActivity(res.recent_activity || []);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch families
  const loadFamilies = async () => {
    try {
      setLoading(true);
      const query = familySearch ? `?search=${encodeURIComponent(familySearch)}` : '';
      const res = await api.get(`/admin/families${query}`);
      setFamilies(res);
    } catch (err) {
      console.error('Failed to load families:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch family detail
  const loadFamilyDetail = async (id: number) => {
    try {
      const res = await api.get(`/admin/families/${id}`);
      setSelectedFamily(res);
    } catch (err) {
      console.error('Failed to load family detail:', err);
    }
  };

  // Fetch members
  const loadMembers = async () => {
    try {
      setLoading(true);
      const query = memberSearch ? `?search=${encodeURIComponent(memberSearch)}` : '';
      const res = await api.get(`/admin/members${query}`);
      setMembers(res);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trips
  const loadTrips = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tripSearch) params.set('search', tripSearch);
      if (tripStatusFilter) params.set('status', tripStatusFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/admin/trips${query}`);
      setTrips(res);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch trip inspector
  const loadTripInspector = async (id: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/trips/${id}`);
      setSelectedTripDetails(res);
    } catch (err) {
      console.error('Failed to load trip inspector:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch expenses
  const loadExpenses = async () => {
    try {
      setLoading(true);
      const query = expenseSearch ? `?search=${encodeURIComponent(expenseSearch)}` : '';
      const res = await api.get(`/admin/expenses${query}`);
      setExpenses(res);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const query = auditSearch ? `?action=${encodeURIComponent(auditSearch)}` : '';
      const res = await api.get(`/admin/audit${query}`);
      setAuditLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch invite codes
  const loadInviteCodes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/invite-codes');
      setInviteCodes(res || []);
    } catch (err) {
      console.error('Failed to load invite codes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'families') loadFamilies();
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'invite_codes') {
      loadInviteCodes();
      loadFamilies();
    }
    if (activeTab === 'trips') loadTrips();
    if (activeTab === 'expenses') loadExpenses();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  // Handle Create Invite Code
  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    try {
      setLoading(true);
      const payload: any = {
        max_uses: Number(inviteMaxUses) || 1,
      };
      if (inviteCodeInput.trim()) payload.code = inviteCodeInput.trim().toUpperCase();
      if (inviteFamilyId) payload.family_id = Number(inviteFamilyId);
      if (inviteExpiresAt) payload.expires_at = inviteExpiresAt;
      if (inviteNotes.trim()) payload.notes = inviteNotes.trim();

      await api.post('/admin/invite-codes', payload);
      setInviteCodeModal(false);
      setInviteCodeInput('');
      setInviteFamilyId('');
      setInviteMaxUses(1);
      setInviteExpiresAt('');
      setInviteNotes('');
      loadInviteCodes();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create invite code');
    } finally {
      setLoading(false);
    }
  };

  // Handle Revoke Invite Code
  const handleRevokeInviteCode = async () => {
    if (!revokeConfirmCode) return;
    try {
      setLoading(true);
      await api.post(`/admin/invite-codes/${revokeConfirmCode.id}/revoke`);
      setRevokeConfirmCode(null);
      loadInviteCodes();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke invite code');
    } finally {
      setLoading(false);
    }
  };

  // Handle Remove / Deactivate User
  const handleRemoveUser = async () => {
    if (!removeUserModal.user) return;
    setRemoveUserError(null);
    try {
      setLoading(true);
      const res = await api.delete(`/admin/members/${removeUserModal.user.user_id}`);
      setRemoveUserResult(res.message);
      loadMembers();
      setTimeout(() => {
        setRemoveUserModal({ isOpen: false });
        setRemoveUserResult(null);
      }, 2500);
    } catch (err: any) {
      setRemoveUserError(err.message || 'Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  // Family actions
  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyNameInput.trim()) return;

    try {
      if (familyModal.mode === 'create') {
        await api.post('/admin/families', { name: familyNameInput.trim() });
      } else {
        await api.patch(`/admin/families/${familyModal.data.id}`, { name: familyNameInput.trim() });
      }
      setFamilyModal({ isOpen: false, mode: 'create' });
      setFamilyNameInput('');
      loadFamilies();
    } catch (err) {
      console.error('Failed to save family:', err);
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async () => {
    if (!confirmStatusModal.user || confirmStatusModal.newStatus === undefined) return;
    try {
      await api.patch(`/admin/members/${confirmStatusModal.user.user_id}/status`, {
        is_active: confirmStatusModal.newStatus,
      });
      setConfirmStatusModal({ isOpen: false });
      loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  // Void expense
  const handleVoidExpense = async () => {
    if (!voidConfirmExpense) return;
    try {
      await api.post(`/admin/expenses/${voidConfirmExpense.id}/void`);
      setVoidConfirmExpense(null);
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to void expense');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Admin Header Bar */}
      <header
        style={{
          background: '#0f172a',
          color: '#ffffff',
          padding: '0.85rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: '#f59e0b',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              TripMates Super Admin
            </h1>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Authenticated Management Dashboard & Audit Inspector
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Shield size={13} /> Full Authorization
          </span>

          <button
            type="button"
            onClick={onExitAdmin}
            style={{
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              borderRadius: '9px',
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>Exit Admin</span>
            <ArrowRight size={14} />
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '9px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{t.logout || 'Logout'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Navigation Sub-header */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 1.5rem',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'overview', label: t.overview, icon: <LayoutDashboard size={16} /> },
          { key: 'families', label: t.familyManagement, icon: <Users size={16} /> },
          { key: 'members', label: t.memberManagement, icon: <UserCheck size={16} /> },
          { key: 'invite_codes', label: t.familyInviteCodes || 'Invite Codes', icon: <KeyRound size={16} /> },
          { key: 'trips', label: t.tripManagement, icon: <Compass size={16} /> },
          { key: 'expenses', label: t.expenseManagement, icon: <Receipt size={16} /> },
          { key: 'audit', label: t.auditLog, icon: <Shield size={16} /> },
        ].map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setActiveTab(item.key as any);
              setSelectedFamily(null);
              setSelectedTripDetails(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.85rem 1.1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === item.key ? '3px solid #0f172a' : '3px solid transparent',
              color: activeTab === item.key ? '#0f172a' : '#64748b',
              fontSize: '0.88rem',
              fontWeight: activeTab === item.key ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.75rem 1.5rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW METRICS */}
        {/* ==================================================================== */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                System Overview & Key Metrics
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                Live aggregated data calculated strictly from database records.
              </p>
            </div>

            {/* Metric Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.1rem',
                marginBottom: '2rem',
              }}
            >
              {[
                { title: t.families || 'Total Families', value: metrics?.total_families ?? 0, icon: <Users size={20} />, color: '#2563eb', bg: '#eff6ff' },
                { title: t.totalRegisteredUsers || 'Registered Users', value: metrics?.total_users ?? 0, sub: `${metrics?.active_users ?? 0} active`, icon: <UserCheck size={20} />, color: '#059669', bg: '#ecfdf5' },
                { title: t.activeMemberships || 'Family Memberships', value: metrics?.total_memberships ?? 0, icon: <Layers size={20} />, color: '#7c3aed', bg: '#f5f3ff' },
                { title: t.trips || 'Total Trips', value: metrics?.total_trips ?? 0, sub: `${metrics?.upcoming_trips ?? 0} upcoming · ${metrics?.completed_trips ?? 0} completed`, icon: <Compass size={20} />, color: '#d97706', bg: '#fffbeb' },
                { title: 'Recorded Expenses', value: formatINR(metrics?.total_expenses_paise ?? 0), sub: `${metrics?.total_expenses_count ?? 0} expenses recorded`, icon: <Receipt size={20} />, color: '#0284c7', bg: '#f0f9ff' },
                { title: 'Total Repayments', value: formatINR(metrics?.total_repayments_paise ?? 0), sub: `${metrics?.total_repayments_count ?? 0} settled transfers`, icon: <RotateCcw size={20} />, color: '#059669', bg: '#ecfdf5' },
                { title: t.outstandingBalances || 'Outstanding Balances', value: formatINR(metrics?.total_outstanding_paise ?? 0), sub: 'Active unsettled ledger', icon: <Wallet size={20} />, color: '#dc2626', bg: '#fef2f2' },
              ].map((m, idx) => (
                <div
                  key={idx}
                  className="card-white"
                  style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>{m.title}</span>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: m.bg,
                        color: m.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {m.icon}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem', fontWeight: 700, color: '#0f172a' }}>
                    {m.value}
                  </div>
                  {m.sub && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{m.sub}</div>}
                </div>
              ))}
            </div>

            {/* Recent System Activity */}
            <div className="card-white" style={{ padding: '1.5rem', borderRadius: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Clock size={18} color="#0f172a" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  {t.recentActivity || 'Recent System Activity'}
                </h3>
              </div>

              {recentActivity.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No recent activity recorded yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentActivity.map(act => (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {act.action.replace('ADMIN_', '')}
                        </span>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                            {act.entity} #{act.entity_id || ''}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                            by {act.actor_name || act.actor_email || 'System'}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(act.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: FAMILY MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'families' && (
          <div>
            {selectedFamily ? (
              /* Family Detail View */
              <div className="card-white" style={{ padding: '1.75rem', borderRadius: '18px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFamily(null)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '1rem',
                  }}
                >
                  ← Back to Families List
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                      {selectedFamily.family.name}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Admin: <strong>{selectedFamily.family.admin_name || selectedFamily.family.admin_email || 'None'}</strong> · Created: {new Date(selectedFamily.family.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFamilyModal({ isOpen: true, mode: 'edit', data: selectedFamily.family });
                      setFamilyNameInput(selectedFamily.family.name);
                    }}
                    className="btn btn-navy"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
                  >
                    <Edit2 size={14} /> Edit Family
                  </button>
                </div>

                {/* Family Members Table */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '1.5rem 0 0.75rem 0', color: '#0f172a' }}>
                  Family Members ({selectedFamily.members.length})
                </h3>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Display Name</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Email / Account</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Joined On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFamily.members.map((m: any) => (
                        <tr key={m.membership_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{m.display_name}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{m.email || 'No login'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{m.role || 'member'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                background: m.left_at ? '#f1f5f9' : '#ecfdf5',
                                color: m.left_at ? '#64748b' : '#059669',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {m.left_at ? 'Former' : 'Active Member'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                            {new Date(m.joined_at).toLocaleDateString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Family Trips Table */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2rem 0 0.75rem 0', color: '#0f172a' }}>
                  Trips Associated with Family ({selectedFamily.trips.length})
                </h3>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Trip Name</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Destination</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Dates</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFamily.trips.map((tRow: any) => (
                        <tr key={tRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{tRow.name}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>{tRow.destination || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>
                            {tRow.start_date || 'TBD'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                background: tRow.status === 'completed' ? '#ecfdf5' : '#fffbeb',
                                color: tRow.status === 'completed' ? '#059669' : '#d97706',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {tRow.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatINR(tRow.total_spent_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Family List View */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      Family Management
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                      Inspect family administrators, active memberships, and trips across all family units.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFamilyModal({ isOpen: true, mode: 'create' });
                      setFamilyNameInput('');
                    }}
                    className="btn btn-navy"
                    style={{ fontSize: '0.88rem' }}
                  >
                    <Plus size={16} /> Create Family
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '380px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search families or admin email..."
                    value={familySearch}
                    onChange={e => setFamilySearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadFamilies()}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem 0.65rem 2.4rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Families Table */}
                <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Family Name</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Administrator</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Active Members</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Trips</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Status</th>
                        <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {families.map(fam => (
                        <tr key={fam.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 700, color: '#0f172a' }}>
                            {fam.name}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#475569' }}>
                            {fam.admin_name ? `${fam.admin_name} (${fam.admin_email})` : fam.admin_email || '—'}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span style={{ background: '#f1f5f9', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 600 }}>
                              {fam.member_count} members
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 600 }}>
                            {fam.trip_count}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span
                              style={{
                                background: fam.is_active ? '#ecfdf5' : '#fef2f2',
                                color: fam.is_active ? '#059669' : '#dc2626',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {fam.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => loadFamilyDetail(fam.id)}
                              style={{
                                background: '#f1f5f9',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                color: '#0f172a',
                              }}
                            >
                              Open Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: MEMBER & USER MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'members' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Registered Members & Account Control
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                Activate or deactivate user accounts through a controlled process. Deactivating revokes all active sessions immediately.
              </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '380px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name, email, or family..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadMembers()}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Members Table */}
            <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Display Name</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Email / Login</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Role</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Family Unit</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Trips</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Account Status</th>
                    <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(u => (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1.15rem', fontWeight: 700, color: '#0f172a' }}>
                        {u.display_name || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#475569' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem' }}>
                        <span
                          style={{
                            background: u.role === 'super_admin' ? '#fef3c7' : u.role === 'family_admin' ? '#eff6ff' : '#f1f5f9',
                            color: u.role === 'super_admin' ? '#b45309' : u.role === 'family_admin' ? '#2563eb' : '#475569',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#64748b' }}>
                        {u.family_name || 'No Family'}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', fontWeight: 600 }}>
                        {u.trip_count}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem' }}>
                        <span
                          style={{
                            background: u.user_active ? '#ecfdf5' : '#fef2f2',
                            color: u.user_active ? '#059669' : '#dc2626',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {u.user_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                        {u.role !== 'super_admin' ? (
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmStatusModal({
                                  isOpen: true,
                                  user: u,
                                  newStatus: u.user_active ? 0 : 1,
                                })
                              }
                              style={{
                                background: u.user_active ? '#fef2f2' : '#ecfdf5',
                                border: u.user_active ? '1px solid #fecaca' : '1px solid #a7f3d0',
                                color: u.user_active ? '#dc2626' : '#059669',
                                borderRadius: '6px',
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {u.user_active ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRemoveUserModal({ isOpen: true, user: u });
                                setRemoveUserError(null);
                                setRemoveUserResult(null);
                              }}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                borderRadius: '6px',
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {t.removeUser || 'Remove User'}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Protected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: FAMILY INVITE CODES */}
        {/* ==================================================================== */}
        {activeTab === 'invite_codes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {t.familyInviteCodes || 'Family Invite Codes'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                  Generate and manage registration invite codes. Configure usage limits, target family, or expiration dates.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInviteCodeModal(true);
                  setInviteError(null);
                  setInviteCodeInput('');
                  setInviteFamilyId('');
                  setInviteMaxUses(1);
                  setInviteExpiresAt('');
                  setInviteNotes('');
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
              >
                <Plus size={16} />
                <span>{t.createInviteCode || 'Create Invite Code'}</span>
              </button>
            </div>

            {/* Copy Notification Toast */}
            {codeCopiedToast && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '0.65rem 1rem',
                color: '#065f46',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Check size={16} color="#059669" />
                <span>Code <strong>{codeCopiedToast}</strong> copied to clipboard!</span>
              </div>
            )}

            {/* Invite Codes Table */}
            <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              {inviteCodes.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <KeyRound size={36} style={{ margin: '0 auto 0.75rem auto', color: '#94a3b8' }} />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: '#475569' }}>
                    {t.noInviteCodes || 'No family invite codes created yet.'}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem' }}>
                    Click "Create Invite Code" to generate your first family registration code.
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.inviteCode || 'Invite Code'}</th>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.targetFamily || 'Target Family'}</th>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.maxUses || 'Usage / Limit'}</th>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.expiresAt || 'Expires'}</th>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.codeStatus || 'Status'}</th>
                      <th style={{ padding: '0.85rem 1.15rem' }}>{t.notes || 'Notes'}</th>
                      <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteCodes.map(c => {
                      const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                      const statusColor = c.status === 'active' && !isExpired
                        ? '#059669'
                        : c.status === 'revoked'
                        ? '#dc2626'
                        : '#d97706';

                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: '#0f172a',
                                background: '#f1f5f9',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                letterSpacing: '0.05em',
                              }}>
                                {c.code}
                              </span>
                              <button
                                type="button"
                                title="Copy code to clipboard"
                                onClick={() => {
                                  navigator.clipboard.writeText(c.code);
                                  setCodeCopiedToast(c.code);
                                  setTimeout(() => setCodeCopiedToast(null), 3000);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#475569' }}>
                            {c.family_name ? (
                              <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.family_name}</span>
                            ) : (
                              <span style={{ color: '#0284c7', fontSize: '0.82rem', fontWeight: 600 }}>
                                {t.allowCreateFamily || 'Allows New Family'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{c.uses_count}</span>
                            <span style={{ color: '#64748b' }}> / {c.max_uses}</span>
                            <span style={{ fontSize: '0.74rem', color: '#64748b', marginLeft: '0.35rem' }}>
                              ({c.remaining_uses} left)
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#64748b', fontSize: '0.82rem' }}>
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span
                              style={{
                                background: c.status === 'active' && !isExpired ? '#ecfdf5' : c.status === 'revoked' ? '#fef2f2' : '#fffbeb',
                                color: statusColor,
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                              }}
                            >
                              {isExpired ? 'Expired' : c.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#64748b', fontSize: '0.82rem', maxWidth: '200px' }}>
                            {c.notes || '—'}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                            {c.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => setRevokeConfirmCode(c)}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  borderRadius: '6px',
                                  padding: '0.3rem 0.65rem',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {t.revokeCode || 'Revoke'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: COMPLETE TRIP MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'trips' && (
          <div>
            {selectedTripDetails ? (
              /* Complete Trip Inspector */
              <div className="card-white" style={{ padding: '1.75rem', borderRadius: '18px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTripDetails(null)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '1rem',
                  }}
                >
                  ← Back to All Trips
                </button>

                {/* Trip Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {selectedTripDetails.trip.name}
                      </h2>
                      <span
                        style={{
                          background: selectedTripDetails.trip.status === 'completed' ? '#ecfdf5' : '#fffbeb',
                          color: selectedTripDetails.trip.status === 'completed' ? '#059669' : '#d97706',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.65rem',
                          borderRadius: '9999px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {selectedTripDetails.trip.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Destination: <strong>{selectedTripDetails.trip.destination || '—'}</strong> · Dates:{' '}
                      {selectedTripDetails.trip.start_date || 'TBD'} to {selectedTripDetails.trip.end_date || 'TBD'} · Organizer:{' '}
                      {selectedTripDetails.trip.creator_email}
                    </div>
                  </div>
                </div>

                {/* Participants & Attendance */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '1.5rem 0 0.75rem 0', color: '#0f172a' }}>
                  Trip Participants & Attendance ({selectedTripDetails.participants.length})
                </h3>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Person</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Family</th>
                        <th style={{ padding: '0.75rem 1rem' }}>RSVP Attendance</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Responded At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTripDetails.participants.map((p: any) => (
                        <tr key={p.person_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{p.display_name}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{p.family_name || 'Individual'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                background: p.attendance === 'coming' ? '#ecfdf5' : p.attendance === 'not_coming' ? '#fef2f2' : '#fffbeb',
                                color: p.attendance === 'coming' ? '#059669' : p.attendance === 'not_coming' ? '#dc2626' : '#d97706',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {p.attendance === 'coming' ? 'Confirmed (Coming)' : p.attendance === 'not_coming' ? 'Declined' : 'Pending RSVP'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#94a3b8' }}>
                            {p.responded_at ? new Date(p.responded_at).toLocaleString('en-IN') : 'Awaiting response'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Expenses with Itemized Bills */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2rem 0 0.75rem 0', color: '#0f172a' }}>
                  All Recorded Expenses ({selectedTripDetails.expenses.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                  {selectedTripDetails.expenses.map((exp: any) => (
                    <div
                      key={exp.id}
                      style={{
                        padding: '1.1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        background: exp.voided_at ? '#f8fafc' : '#ffffff',
                        opacity: exp.voided_at ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                              {exp.title}
                            </span>
                            {exp.voided_at && (
                              <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                VOIDED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Paid by <strong>{exp.payer_name}</strong> on {exp.expense_date} · Mode: {exp.accounting_mode} · Split: {exp.split_method}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatINR(exp.total_paise)}
                          </div>
                        </div>
                      </div>

                      {/* Items if itemized */}
                      {exp.items && exp.items.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                            Itemized Dishes:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {exp.items.map((it: any) => (
                              <span key={it.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                                {it.name} ({it.quantity} × {formatINR(it.unit_price_paise)} = {formatINR(it.subtotal_paise)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allocations Breakdown */}
                      {exp.allocations && exp.allocations.length > 0 && (
                        <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {exp.allocations.map((a: any) => (
                            <span
                              key={a.id}
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {a.account_name}: {formatINR(a.amount_paise)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Ledger & Balances */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2rem 0 0.75rem 0', color: '#0f172a' }}>
                  Settlement Ledger & Balances
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                  {selectedTripDetails.balances.map((b: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: b.net > 0 ? '#ecfdf5' : b.net < 0 ? '#fef2f2' : '#f8fafc',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{b.name || b.id}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Paid: {formatINR(b.paid || 0)} · Share: {formatINR(b.share || 0)}
                      </div>
                      <div
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          marginTop: '0.4rem',
                          color: b.net > 0 ? '#059669' : b.net < 0 ? '#dc2626' : '#64748b',
                        }}
                      >
                        {b.net > 0
                          ? `Receives ${formatINR(b.net)}`
                          : b.net < 0
                          ? `Owes ${formatINR(Math.abs(b.net))}`
                          : 'Settled (₹0)'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Trips List View */
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Cross-Family Trips Management
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                    Inspect complete itineraries, participants, itemized food bills, and settlement ledgers across all trips.
                  </p>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', minWidth: '300px', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search trip name, destination, creator..."
                      value={tripSearch}
                      onChange={e => setTripSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadTrips()}
                      style={{
                        width: '100%',
                        padding: '0.65rem 1rem 0.65rem 2.4rem',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.88rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <select
                    value={tripStatusFilter}
                    onChange={e => {
                      setTripStatusFilter(e.target.value);
                    }}
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.88rem',
                      background: '#ffffff',
                    }}
                  >
                    <option value="">All Statuses</option>
                    <option value="planning">Planning</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Trips Table */}
                <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Trip Name</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Destination</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Dates</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Status</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Participants</th>
                        <th style={{ padding: '0.85rem 1.15rem' }}>Total Spent</th>
                        <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map(tr => (
                        <tr key={tr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 700, color: '#0f172a' }}>
                            {tr.name}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>{tr.destination || '—'}</td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#64748b' }}>
                            {tr.start_date || 'TBD'}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span
                              style={{
                                background: tr.status === 'completed' ? '#ecfdf5' : '#fffbeb',
                                color: tr.status === 'completed' ? '#059669' : '#d97706',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {tr.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 600 }}>
                            {tr.participant_count}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatINR(tr.total_spent_paise)}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => loadTripInspector(tr.id)}
                              style={{
                                background: '#0f172a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Inspect Trip
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: EXPENSES & SETTLEMENT MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'expenses' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Expenses & Settlement Registry
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                All expense transactions across every family and trip. Super Admin can inspect itemized food dishes and perform authorized void actions with audit trail.
              </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '380px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search expense title, category, or trip..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadExpenses()}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Expenses Table */}
            <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Expense</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Trip</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Paid By</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Split Method</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Date</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Amount</th>
                    <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr
                      key={exp.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: exp.voided_at ? '#f8fafc' : '#ffffff',
                        opacity: exp.voided_at ? 0.7 : 1,
                      }}
                    >
                      <td style={{ padding: '0.85rem 1.15rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{exp.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{exp.category}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#475569', fontWeight: 600 }}>
                        {exp.trip_name}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#475569' }}>
                        {exp.payer_name}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem' }}>
                        <span style={{ background: '#f1f5f9', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {exp.split_method}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', color: '#94a3b8' }}>
                        {exp.expense_date}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatINR(exp.total_paise)}
                      </td>
                      <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                        {exp.voided_at ? (
                          <span style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 700 }}>
                            Voided
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVoidConfirmExpense(exp)}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: AUDIT LOG VIEWER */}
        {/* ==================================================================== */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                System Cryptographic Audit Log
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                Complete immutable record of membership, attendance, financial, and administrative events.
              </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '1.25rem', position: 'relative', maxWidth: '380px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Filter by action keyword (e.g. USER, EXPENSE, TRIP)..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadAuditLogs()}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Audit Logs List */}
            <div className="card-white" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Timestamp</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Actor</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Action</th>
                    <th style={{ padding: '0.85rem 1.15rem' }}>Entity</th>
                    <th style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', fontWeight: 600 }}>
                            {log.actor_name || log.actor_email || 'System'}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem' }}>
                            <span
                              style={{
                                background: '#0f172a',
                                color: '#ffffff',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', color: '#475569' }}>
                            {log.entity} #{log.entity_id || ''}
                          </td>
                          <td style={{ padding: '0.85rem 1.15rem', textAlign: 'right' }}>
                            {(log.before || log.after) && (
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                style={{
                                  background: '#f1f5f9',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.3rem 0.6rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {isExpanded ? 'Hide Diff' : 'View Diff'}
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <td colSpan={5} style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.25rem' }}>
                                    Before State:
                                  </div>
                                  <pre style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', overflowX: 'auto' }}>
                                    {log.before ? JSON.stringify(log.before, null, 2) : 'null'}
                                  </pre>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>
                                    After State:
                                  </div>
                                  <pre style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', overflowX: 'auto' }}>
                                    {log.after ? JSON.stringify(log.after, null, 2) : 'null'}
                                  </pre>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Modal for User Activation / Deactivation */}
      {confirmStatusModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color={confirmStatusModal.newStatus === 0 ? '#dc2626' : '#059669'} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {confirmStatusModal.newStatus === 0 ? 'Deactivate User Account?' : 'Reactivate User Account?'}
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              {confirmStatusModal.newStatus === 0
                ? `Are you sure you want to deactivate ${confirmStatusModal.user?.email}? All active user sessions will be immediately invalidated and they will be blocked from logging in.`
                : `Are you sure you want to reactivate ${confirmStatusModal.user?.email}? They will be able to log in again.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setConfirmStatusModal({ isOpen: false })}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleUserStatus}
                style={{
                  background: confirmStatusModal.newStatus === 0 ? '#dc2626' : '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {confirmStatusModal.newStatus === 0 ? 'Confirm Deactivation' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Void Expense */}
      {voidConfirmExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Void Expense Transaction?
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Are you sure you want to void <strong>"{voidConfirmExpense.title}"</strong> ({formatINR(voidConfirmExpense.total_paise)})? The expense will be removed from financial balances and an immutable audit log will be created.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setVoidConfirmExpense(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoidExpense}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Create / Edit Modal */}
      {familyModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
              {familyModal.mode === 'create' ? 'Create New Family' : 'Edit Family'}
            </h3>
            <form onSubmit={handleSaveFamily}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Family Name
                </label>
                <input
                  type="text"
                  required
                  value={familyNameInput}
                  onChange={e => setFamilyNameInput(e.target.value)}
                  placeholder="e.g. Hyderabad Family"
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setFamilyModal({ isOpen: false, mode: 'create' })}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.1rem',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  Save Family
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove / Deactivate User Modal */}
      {removeUserModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {t.removeUserDialogTitle || 'Remove or Deactivate User'}
              </h3>
            </div>

            {removeUserResult && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: '#065f46',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {removeUserResult}
              </div>
            )}

            {removeUserError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                color: '#dc2626',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {removeUserError}
              </div>
            )}

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.84rem',
              color: '#334155',
              lineHeight: 1.5,
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#0f172a' }}>
                User: {removeUserModal.user?.display_name} ({removeUserModal.user?.email})
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                {t.removeUserExplanation || 'To protect the integrity of financial ledgers and expense settlements, users with existing financial records (paid expenses, debt allocations, repayments) cannot be permanently purged from the database. Instead, their account will be deactivated and active sessions revoked. Users with zero financial history can be permanently deleted.'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setRemoveUserModal({ isOpen: false })}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleRemoveUser}
                disabled={Boolean(removeUserResult)}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {t.confirmRemoveUser || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Family Invite Code Modal */}
      {inviteCodeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <KeyRound size={22} color="#0f172a" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {t.createInviteCode || 'Create Family Invite Code'}
              </h3>
            </div>

            {inviteError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem',
                color: '#dc2626',
                fontSize: '0.84rem',
                marginBottom: '1rem',
              }}>
                {inviteError}
              </div>
            )}

            <form onSubmit={handleCreateInviteCode} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                    {t.inviteCode || 'Invite Code'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = 'FAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                      setInviteCodeInput(rand);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {t.generateRandomCode || 'Generate Random'}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. FAM-SUMMER26 (Leave blank to auto-generate)"
                  value={inviteCodeInput}
                  onChange={e => setInviteCodeInput(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    outline: 'none',
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  {t.targetFamily || 'Target Family'}
                </label>
                <select
                  value={inviteFamilyId}
                  onChange={e => setInviteFamilyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  <option value="">{t.allowCreateFamily || '— Allows New Family Creation (Unassigned) —'}</option>
                  {families.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    {t.maxUses || 'Max Uses'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={inviteMaxUses}
                    onChange={e => setInviteMaxUses(parseInt(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '0.92rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    {t.expiresAt || 'Expiry Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={inviteExpiresAt}
                    onChange={e => setInviteExpiresAt(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '0.92rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  {t.notes || 'Notes / Purpose'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. For Bangalore cousins"
                  value={inviteNotes}
                  onChange={e => setInviteNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setInviteCodeModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.1rem',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  {t.createInviteCode || 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Family Invite Code Confirmation Modal */}
      {revokeConfirmCode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {t.revokeCode || 'Revoke Family Invite Code?'}
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              Are you sure you want to revoke invite code <strong>"{revokeConfirmCode.code}"</strong>? New users will no longer be able to use this code to register.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setRevokeConfirmCode(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleRevokeInviteCode}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                {t.revokeCode || 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
