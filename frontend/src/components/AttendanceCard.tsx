import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { Check, X, Clock, History, UserCheck, ShieldAlert } from 'lucide-react';

interface Participant {
  id: number;
  display_name: string;
  attendance: 'pending' | 'coming' | 'not_coming';
  responded_at: string | null;
  family_id: number | null;
  family_name: string | null;
  user_id: number | null;
}

interface Props {
  tripId: number;
  participants: Participant[];
  currentUserPersonId?: number;
  isSuperAdmin?: boolean;
  userFamilyId?: number;
  onAttendanceChanged: () => void;
}

export const AttendanceCard: React.FC<Props> = ({
  tripId,
  participants,
  currentUserPersonId,
  isSuperAdmin,
  userFamilyId,
  onAttendanceChanged,
}) => {
  const { t } = useI18n();
  const [showLogModal, setShowLogModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async (personId: number, status: 'coming' | 'not_coming' | 'pending') => {
    try {
      setErrorMsg(null);
      await api.put(`/trips/${tripId}/attendance/${personId}`, { attendance: status });
      onAttendanceChanged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update attendance');
    }
  };

  const openLog = async () => {
    try {
      setLoadingLog(true);
      setShowLogModal(true);
      const res = await api.get(`/trips/${tripId}/attendance/log`);
      setLogs(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load attendance logs');
    } finally {
      setLoadingLog(false);
    }
  };

  // Group stats
  const comingCount = participants.filter(p => p.attendance === 'coming').length;
  const notComingCount = participants.filter(p => p.attendance === 'not_coming').length;
  const pendingCount = participants.filter(p => p.attendance === 'pending').length;

  return (
    <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            {t.attendance}
          </h3>
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.35rem' }}>
            <span className="badge badge-green">✓ {comingCount} {t.rsvpComing}</span>
            <span className="badge badge-red">✗ {notComingCount} {t.rsvpNotComing}</span>
            <span className="badge badge-amber">? {pendingCount} {t.rsvpPending}</span>
          </div>
        </div>

        <button type="button" onClick={openLog} className="btn btn-secondary btn-sm" title="View Change Log">
          <History size={16} /> {t.attendanceHistory}
        </button>
      </div>

      {errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '0.65rem 0.85rem',
          color: '#dc2626',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {errorMsg}
        </div>
      )}

      {/* Participants list with RSVP buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {participants.map(p => {
          const isSelf = p.id === currentUserPersonId;
          const canEdit = isSuperAdmin || isSelf || (userFamilyId && p.family_id === userFamilyId);

          return (
            <div
              key={p.id}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
                  {p.display_name} {isSelf && <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>({t.myRsvp})</span>}
                </div>
                {p.family_name && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{p.family_name}</div>
                )}
              </div>

              {canEdit ? (
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => handleUpdate(p.id, 'coming')}
                    title={t.rsvpComing}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      border: p.attendance === 'coming' ? '1px solid #059669' : '1px solid #cbd5e1',
                      background: p.attendance === 'coming' ? '#059669' : '#ffffff',
                      color: p.attendance === 'coming' ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdate(p.id, 'not_coming')}
                    title={t.rsvpNotComing}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      border: p.attendance === 'not_coming' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                      background: p.attendance === 'not_coming' ? '#dc2626' : '#ffffff',
                      color: p.attendance === 'not_coming' ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  {p.attendance === 'coming' && <span className="badge badge-green">Coming</span>}
                  {p.attendance === 'not_coming' && <span className="badge badge-red">Not Coming</span>}
                  {p.attendance === 'pending' && <span className="badge badge-amber">Pending</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Attendance History Log Modal */}
      {showLogModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                {t.attendanceHistory}
              </h3>
              <button type="button" onClick={() => setShowLogModal(false)} className="btn btn-secondary btn-sm">{t.close}</button>
            </div>

            {loadingLog ? (
              <p style={{ color: '#64748b' }}>{t.loading}</p>
            ) : logs.length === 0 ? (
              <p style={{ color: '#64748b' }}>No attendance changes recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                {logs.map((log: any) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0f172a' }}>{log.person_name}</strong>: changed from{' '}
                      <span style={{ color: '#64748b' }}>{log.old_value || 'None'}</span> to{' '}
                      <strong style={{ color: log.new_value === 'coming' ? '#059669' : '#dc2626' }}>{log.new_value}</strong>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>by {log.changed_by_email}</div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {new Date(log.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
