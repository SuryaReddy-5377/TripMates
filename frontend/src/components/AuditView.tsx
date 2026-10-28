import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const AuditView: React.FC<Props> = ({ onBack }) => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit?limit=50');
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="container" style={{ paddingBottom: '4rem', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> {t.back} to {t.dashboard}
        </button>

        <button type="button" onClick={fetchLogs} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      <div className="card-white p-6" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#0f172a',
            color: '#ffffff',
          }}>
            <Shield size={20} />
          </span>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)', margin: 0 }}>System Audit Trail</h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '2px' }}>
              Immutable record of security, expense creation, repayments, and trip configuration ({total} total actions)
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>{t.loading}</p>
        ) : logs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No audit actions recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.map(log => (
              <div
                key={log.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.9rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>{log.action}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{log.entity} #{log.entity_id}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Actor: <strong style={{ color: '#0f172a' }}>{log.actor_email || 'System / Anonymous'}</strong>
                </div>

                {log.after && (
                  <pre style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#0f172a',
                    overflowX: 'auto',
                    margin: '0.25rem 0 0',
                  }}>
                    {typeof log.after === 'string' ? log.after : JSON.stringify(log.after, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
