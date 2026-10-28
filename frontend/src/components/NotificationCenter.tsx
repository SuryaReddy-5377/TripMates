import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  Bell,
  Check,
  CheckCheck,
  Compass,
  Receipt,
  RotateCcw,
  Settings,
  X,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface NotificationItem {
  id: number;
  type: 'trip_invitation' | 'trip_added' | 'trip_update' | 'new_expense' | 'expense_update' | 'repayment' | 'system';
  title: string;
  message: string;
  trip_id: number | null;
  expense_id: number | null;
  repayment_id: number | null;
  data: any;
  is_read: number;
  read_at: string | null;
  created_at: string;
}

interface NotificationPreference {
  trip_notifications: number;
  expense_notifications: number;
  repayment_notifications: number;
  browser_push_enabled: number;
}

interface Props {
  onSelectTrip: (tripId: number) => void;
}

export const NotificationCenter: React.FC<Props> = ({ onSelectTrip }) => {
  const { t, formatINR } = useI18n();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'expenses' | 'trips'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Preferences modal
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreference>({
    trip_notifications: 1,
    expense_notifications: 1,
    repayment_notifications: 1,
    browser_push_enabled: 0,
  });
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=40');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      setPrefs({
        trip_notifications: res.trip_notifications ?? 1,
        expense_notifications: res.expense_notifications ?? 1,
        repayment_notifications: res.repayment_notifications ?? 1,
        browser_push_enabled: res.browser_push_enabled ?? 0,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    }

    // Polling every 30 seconds for live notifications
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: 1, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (item.is_read === 0) {
      handleMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.trip_id) {
      onSelectTrip(item.trip_id);
    }
  };

  const handleUpdatePreference = async (key: keyof NotificationPreference, val: number) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    try {
      await api.put('/notifications/preferences', {
        [key]: Boolean(val),
      });
    } catch (err) {
      console.error('Failed to update preference:', err);
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        handleUpdatePreference('browser_push_enabled', 1);
        new Notification('TripMates Notifications Active', {
          body: 'You will receive trip and expense alerts right on this device.',
          icon: '/favicon.ico',
        });
      } else {
        handleUpdatePreference('browser_push_enabled', 0);
      }
    } catch (err) {
      console.error('Browser notification error:', err);
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return n.is_read === 0;
    if (activeTab === 'expenses') return n.type === 'new_expense' || n.type === 'expense_update' || n.type === 'repayment';
    if (activeTab === 'trips') return n.type.startsWith('trip_');
    return true;
  });

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={t.notifications}
        style={{
          position: 'relative',
          background: isOpen ? '#0f172a' : '#ffffff',
          color: isOpen ? '#ffffff' : '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '0.45rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '0.65rem',
              fontWeight: 800,
              minWidth: '18px',
              height: '18px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.4)',
              border: '2px solid #ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer / Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '420px',
            maxWidth: '92vw',
            background: '#ffffff',
            borderRadius: '18px',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.16)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '580px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fbfaf7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {t.notifications}
              </h3>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                  }}
                >
                  {unreadCount} {t.unread}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#059669',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '6px',
                  }}
                  title={t.markAllAsRead}
                >
                  <CheckCheck size={14} />
                  <span>{t.markAllAsRead}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPrefs(true)}
                title={t.notificationPreferences}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  borderRadius: '6px',
                  padding: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <Settings size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '0.35rem',
              padding: '0.6rem 1rem',
              borderBottom: '1px solid #f1f5f9',
              background: '#ffffff',
            }}
          >
            {(['all', 'unread', 'expenses', 'trips'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#0f172a' : '#f1f5f9',
                  color: activeTab === tab ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'all'
                  ? t.allNotifications
                  : tab === 'unread'
                  ? t.unread
                  : tab === 'expenses'
                  ? t.expenses
                  : t.trips}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
            {filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  color: '#94a3b8',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: '#f8fafc',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    marginBottom: '0.75rem',
                  }}
                >
                  <Bell size={24} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#64748b' }}>
                  {t.noNotifications}
                </div>
              </div>
            ) : (
              filteredNotifications.map(item => {
                const isUnread = item.is_read === 0;
                const isExpense = item.type === 'new_expense' || item.type === 'expense_update';
                const isRepayment = item.type === 'repayment';
                const isTrip = item.type.startsWith('trip_');

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '0.85rem 1.15rem',
                      display: 'flex',
                      gap: '0.85rem',
                      alignItems: 'flex-start',
                      cursor: item.trip_id ? 'pointer' : 'default',
                      background: isUnread ? '#f8fafc' : '#ffffff',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={e =>
                      (e.currentTarget.style.background = isUnread ? '#f8fafc' : '#ffffff')
                    }
                  >
                    {/* Unread indicator dot */}
                    {isUnread && (
                      <span
                        style={{
                          position: 'absolute',
                          left: '6px',
                          top: '18px',
                          width: '6px',
                          height: '6px',
                          borderRadius: '9999px',
                          background: '#d97706',
                        }}
                      />
                    )}

                    {/* Category Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: isExpense
                          ? '#fffbeb'
                          : isRepayment
                          ? '#ecfdf5'
                          : '#eff6ff',
                        color: isExpense
                          ? '#d97706'
                          : isRepayment
                          ? '#059669'
                          : '#2563eb',
                      }}
                    >
                      {isExpense ? (
                        <Receipt size={18} />
                      ) : isRepayment ? (
                        <RotateCcw size={18} />
                      ) : (
                        <Compass size={18} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginBottom: '0.2rem',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isUnread ? 700 : 600,
                            fontSize: '0.88rem',
                            color: '#0f172a',
                            lineHeight: 1.25,
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            flexShrink: 0,
                          }}
                        >
                          <Clock size={11} />
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: '#475569',
                          margin: '0.25rem 0',
                          lineHeight: 1.35,
                        }}
                      >
                        {item.message}
                      </p>

                      {/* Highlighted share pill if applicable */}
                      {item.data && item.data.is_assigned && item.data.share_paise > 0 && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: '#fffbeb',
                              color: '#b45309',
                              fontSize: '0.73rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '6px',
                              border: '1px solid #fde68a',
                            }}
                          >
                            Your share: {formatINR(item.data.share_paise)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Mark as read button */}
                    {isUnread && (
                      <button
                        type="button"
                        onClick={e => handleMarkAsRead(item.id, e)}
                        title={t.markAsRead}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          alignSelf: 'center',
                        }}
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPrefs && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 48px rgba(15, 23, 42, 0.2)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fbfaf7',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {t.notificationPreferences}
              </h3>
              <button
                type="button"
                onClick={() => setShowPrefs(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Trip notifications toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
                    {t.tripNotifications}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    When you are added to a trip or when trip dates change
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.trip_notifications === 1}
                  onChange={e => handleUpdatePreference('trip_notifications', e.target.checked ? 1 : 0)}
                  style={{ width: '18px', height: '18px', accentColor: '#0f172a', cursor: 'pointer' }}
                />
              </div>

              {/* Expense notifications toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
                    {t.expenseNotifications}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    When a new expense or meal is recorded with your share
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.expense_notifications === 1}
                  onChange={e => handleUpdatePreference('expense_notifications', e.target.checked ? 1 : 0)}
                  style={{ width: '18px', height: '18px', accentColor: '#0f172a', cursor: 'pointer' }}
                />
              </div>

              {/* Repayment notifications toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
                    {t.repaymentNotifications}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    When someone records a settlement or repayment to you
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.repayment_notifications === 1}
                  onChange={e => handleUpdatePreference('repayment_notifications', e.target.checked ? 1 : 0)}
                  style={{ width: '18px', height: '18px', accentColor: '#0f172a', cursor: 'pointer' }}
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9' }} />

              {/* Browser Push Permission (Feature 4 Optional Enhancement) */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <ShieldCheck size={18} color="#059669" />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    {t.browserNotifications}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, margin: '0.25rem 0 0.85rem 0' }}>
                  {t.browserPushEnabledDesc}
                </p>

                {browserPermission === 'granted' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669', fontSize: '0.82rem', fontWeight: 600 }}>
                    <Check size={16} /> Browser notifications active
                  </div>
                ) : browserPermission === 'denied' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', fontSize: '0.82rem', fontWeight: 600 }}>
                    <AlertCircle size={16} /> Notifications blocked in browser settings
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBrowserPermission}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t.enableBrowserPush}
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowPrefs(false)}
                className="btn btn-navy"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
