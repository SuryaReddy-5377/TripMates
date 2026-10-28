import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { PineForestBanner } from './NatureBanners';
import { AttendanceCard } from './AttendanceCard';
import { ItemizedBillEditor } from './ItemizedBillEditor';
import { ExpenseSplitWizard } from './ExpenseSplitWizard';
import { RepaymentModal } from './RepaymentModal';
import { TripMap } from './TripMap';
import { ReportsView } from './ReportsView';
import {
  Receipt,
  Users,
  Scale,
  BarChart3,
  MapPin,
  Plus,
  Lock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface Props {
  tripId: number;
  currentUser: any;
  currentPerson: any;
  currentFamily: any;
  onBack: () => void;
}

export const TripDetail: React.FC<Props> = ({
  tripId,
  currentUser,
  currentPerson,
  currentFamily,
  onBack,
}) => {
  const { t, formatINR } = useI18n();

  const [trip, setTrip] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any>(null);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active sub-tab: 'expenses' | 'attendance' | 'ledger' | 'reports' | 'map'
  const [activeTab, setActiveTab] = useState<'expenses' | 'attendance' | 'ledger' | 'reports' | 'map'>('expenses');

  // Modal controls
  const [showItemizedEditor, setShowItemizedEditor] = useState(false);
  const [showSplitWizard, setShowSplitWizard] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentPrefill, setRepaymentPrefill] = useState<any>(null);

  const loadAllTripData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [tripData, expData, ledgerData, repData] = await Promise.all([
        api.get(`/trips/${tripId}`),
        api.get(`/trips/${tripId}/expenses`),
        api.get(`/trips/${tripId}/ledger`),
        api.get(`/trips/${tripId}/repayments`),
      ]);

      setTrip(tripData);
      setExpenses(expData);
      setLedger(ledgerData);
      setRepayments(repData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTripData();
  }, [tripId]);

  const handleMarkCompleted = async () => {
    if (!confirm('Are you sure you want to mark this trip as completed? Private trip access restrictions will apply.')) return;
    try {
      await api.post(`/trips/${tripId}/complete`);
      loadAllTripData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete trip');
    }
  };

  const handleVoidExpense = async (expId: number) => {
    if (!confirm('Are you sure you want to void this expense? It will be removed from all balances and ledger calculations.')) return;
    try {
      await api.delete(`/trips/${tripId}/expenses/${expId}`);
      loadAllTripData();
    } catch (err: any) {
      alert(err.message || 'Failed to void expense');
    }
  };

  const openRepaymentForSuggestion = (suggestion: any) => {
    setRepaymentPrefill({
      from: { type: suggestion.from_type, id: suggestion.from_id, name: suggestion.from_name },
      to: { type: suggestion.to_type, id: suggestion.to_id, name: suggestion.to_name },
      amountPaise: suggestion.amount,
    });
    setShowRepaymentModal(true);
  };

  if (loading) {
    return <div className="container p-8 text-center text-lg">{t.loading}</div>;
  }

  if (errorMsg || !trip) {
    return (
      <div className="container p-8">
        <div className="glass-panel p-6 text-center">
          <AlertCircle size={32} style={{ color: '#f87171', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Access Error</h2>
          <p style={{ color: '#95b8a6', marginBottom: '1.5rem' }}>{errorMsg || 'Trip not found or restricted'}</p>
          <button type="button" onClick={onBack} className="btn btn-secondary">{t.back}</button>
        </div>
      </div>
    );
  }

  const isCreatorOrAdmin = currentUser.role === 'super_admin' || trip.created_by === currentUser.id;

  // Accounts list for repayment modal dropdown
  const allAccounts: Array<{ key: string; type: 'person' | 'family'; id: number; name: string }> = [];
  trip.participants.forEach((p: any) => {
    allAccounts.push({ key: `p:${p.id}`, type: 'person', id: p.id, name: p.display_name });
  });
  trip.families.forEach((f: any) => {
    allAccounts.push({ key: `f:${f.id}`, type: 'family', id: f.id, name: `${f.name} (Family)` });
  });

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Top Banner */}
      <div style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
        >
          ← {t.back} to {t.dashboard}
        </button>

        <PineForestBanner
          title={trip.name}
          subtitle={`${trip.destination || 'Unspecified location'} · ${trip.start_date || ''} ${trip.end_date ? 'to ' + trip.end_date : ''}`}
          height={210}
          bgImage="/images/trip-kerala.jpg"
        />
      </div>

      {/* Meta Bar */}
      <div className="card-white p-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderRadius: '16px', background: '#ffffff', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span className={`badge ${trip.status === 'completed' ? 'badge-green' : 'badge-amber'}`}>
            {trip.status.toUpperCase()}
          </span>
          {trip.is_private === 1 && (
            <span className="badge badge-amber" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Lock size={12} /> {t.privateTrip}
            </span>
          )}
          {trip.budget_paise && (
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {t.budget}: <strong style={{ color: '#0f172a' }}>{formatINR(trip.budget_paise)}</strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isCreatorOrAdmin && trip.status !== 'completed' && (
            <button type="button" onClick={handleMarkCompleted} className="btn btn-secondary btn-sm">
              <CheckCircle2 size={16} /> {t.markCompleted}
            </button>
          )}
          <button type="button" onClick={() => setShowSplitWizard(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> {t.addExpense}
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'expenses', label: t.expenses, icon: Receipt, count: expenses.length },
          { id: 'ledger', label: t.settlements, icon: Scale, count: ledger?.suggestedSettlements?.length },
          { id: 'attendance', label: t.attendance, icon: Users, count: trip.participants.length },
          { id: 'reports', label: t.reports, icon: BarChart3 },
          { id: 'map', label: 'Map', icon: MapPin },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #0f172a' : '2px solid transparent',
                color: isActive ? '#0f172a' : '#64748b',
                padding: '0.75rem 1.1rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  background: isActive ? '#0f172a' : '#f1f5f9',
                  color: isActive ? '#ffffff' : '#64748b',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: Expenses */}
      {activeTab === 'expenses' && (
        <div>
          {expenses.length === 0 ? (
            <div className="card-white p-8 text-center" style={{ borderRadius: '16px', padding: '3rem 2rem' }}>
              <Receipt size={40} style={{ color: '#0f172a', margin: '0 auto 1rem', opacity: 0.6 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a', fontFamily: 'var(--font-display)' }}>No expenses recorded yet</h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '420px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
                Record shared group expenses, travel tickets, dining, or stays with customized individual shares and equal remainder splitting.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowSplitWizard(true)} className="btn btn-primary">
                  <Plus size={16} /> {t.addExpense}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {expenses.map((exp: any) => (
                <div
                  key={exp.id}
                  className="card-white p-4"
                  style={{
                    borderRadius: '14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    opacity: exp.voided_at ? 0.45 : 1,
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{exp.title}</h4>
                      <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>{exp.category}</span>
                      <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>{exp.split_method}</span>
                      {exp.voided_at && <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>VOIDED</span>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                      {exp.expense_date} · Paid by <strong style={{ color: '#0f172a' }}>{exp.payer_name}</strong> · {exp.participant_count} participants
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: exp.voided_at ? '#94a3b8' : '#0f172a' }}>
                        {formatINR(exp.total_paise)}
                      </div>
                    </div>

                    {!exp.voided_at && (isCreatorOrAdmin || exp.created_by === currentUser.id) && (
                      <button
                        type="button"
                        onClick={() => handleVoidExpense(exp.id)}
                        className="btn btn-danger btn-sm"
                        title="Void Expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Ledger & Settlements */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Status & Settle Up action */}
          <div className="card-white p-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px', background: '#ffffff', padding: '1.25rem 1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Settlement Status</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: ledger?.status === 'settled' ? '#059669' : '#d97706', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                {ledger?.status === 'settled' ? (
                  <>
                    <CheckCircle2 size={22} /> {t.allSettled}
                  </>
                ) : (
                  <>
                    <Scale size={22} /> {t.unsettled}
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRepaymentPrefill(null);
                setShowRepaymentModal(true);
              }}
              className="btn btn-primary btn-sm"
            >
              <Scale size={16} /> {t.recordRepayment}
            </button>
          </div>

          {/* Suggested Transfers */}
          {ledger?.suggestedSettlements && ledger.suggestedSettlements.length > 0 && (
            <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                {t.suggestedSettlements} (Minimal-path transfers)
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Click "Pay" to prefill and record a repayment with automated debt validation.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {ledger.suggestedSettlements.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '0.85rem 1.15rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ color: '#dc2626' }}>{s.from_name}</strong>
                      <ArrowRight size={16} style={{ color: '#64748b' }} />
                      <strong style={{ color: '#059669' }}>{s.to_name}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                        {formatINR(s.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openRepaymentForSuggestion(s)}
                        className="btn btn-primary btn-sm"
                      >
                        Settle Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Balances Table */}
          <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
              Outstanding Account Balances
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
              {ledger?.balances?.map((b: any) => (
                <div
                  key={b.key}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{b.name}</span>
                    <span className={`badge ${b.net > 0 ? 'badge-green' : b.net < 0 ? 'badge-red' : 'badge-amber'}`}>
                      {b.net > 0 ? t.receives : b.net < 0 ? t.owes : 'Settled'}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: b.net > 0 ? '#059669' : b.net < 0 ? '#dc2626' : '#64748b', marginBottom: '0.5rem' }}>
                    {formatINR(Math.abs(b.net))}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                    <div>Paid: <strong style={{ color: '#0f172a' }}>{formatINR(b.paid)}</strong></div>
                    <div>Share: <strong style={{ color: '#0f172a' }}>{formatINR(b.share)}</strong></div>
                    <div>Repaid: <strong style={{ color: '#0f172a' }}>{formatINR(b.sent)}</strong></div>
                    <div>Received: <strong style={{ color: '#0f172a' }}>{formatINR(b.received)}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Repayments History */}
          {repayments.length > 0 && (
            <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem', fontFamily: 'var(--font-display)' }}>
                Recorded Repayments History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {repayments.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ color: '#0f172a' }}><strong>{r.from_name}</strong> repaid <strong>{r.to_name}</strong></span>
                      {r.reference && <span style={{ color: '#64748b', fontSize: '0.75rem' }}> ({r.reference})</span>}
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{r.paid_on}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                      {formatINR(r.amount_paise)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Attendance */}
      {activeTab === 'attendance' && (
        <AttendanceCard
          tripId={tripId}
          participants={trip.participants}
          currentUserPersonId={currentPerson?.id}
          isSuperAdmin={currentUser.role === 'super_admin'}
          userFamilyId={currentFamily?.id}
          onAttendanceChanged={loadAllTripData}
        />
      )}

      {/* TAB CONTENT: Reports & Analytics */}
      {activeTab === 'reports' && (
        <ReportsView tripId={tripId} />
      )}

      {/* TAB CONTENT: Map */}
      {activeTab === 'map' && (
        <TripMap
          tripId={trip.id}
          destination={trip.destination}
          tripName={trip.name}
          canEditRoute={currentUser?.role === 'super_admin' || trip.created_by === currentUser?.id}
        />
      )}

      {/* MODALS */}
      {showItemizedEditor && (
        <div className="modal-overlay">
          <div style={{ width: '100%', maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto' }}>
            <ItemizedBillEditor
              tripId={tripId}
              participants={trip.participants}
              families={trip.families}
              onExpenseSaved={() => {
                setShowItemizedEditor(false);
                loadAllTripData();
              }}
              onCancel={() => setShowItemizedEditor(false)}
            />
          </div>
        </div>
      )}

      {showSplitWizard && (
        <div className="modal-overlay">
          <div style={{ width: '100%', maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto' }}>
            <ExpenseSplitWizard
              tripId={tripId}
              participants={trip.participants}
              families={trip.families}
              onExpenseSaved={() => {
                setShowSplitWizard(false);
                loadAllTripData();
              }}
              onCancel={() => setShowSplitWizard(false)}
            />
          </div>
        </div>
      )}

      {showRepaymentModal && (
        <RepaymentModal
          tripId={tripId}
          initialFrom={repaymentPrefill?.from}
          initialTo={repaymentPrefill?.to}
          initialAmountPaise={repaymentPrefill?.amountPaise}
          accounts={allAccounts}
          onRepaymentSaved={() => {
            setShowRepaymentModal(false);
            loadAllTripData();
          }}
          onClose={() => setShowRepaymentModal(false)}
        />
      )}
    </div>
  );
};
