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
  Camera,
  ImageIcon,
  Wallet,
  Check,
  X,
  CreditCard,
} from 'lucide-react';

interface Props {
  tripId: number;
  currentUser: any;
  currentPerson: any;
  currentFamily: any;
  onBack: () => void;
}

const COVER_PRESETS = [
  { label: 'Mountain Resort', url: '/images/mountain_resort.jpg' },
  { label: 'Kerala Backwaters', url: '/images/trip-kerala.jpg' },
  { label: 'Beach Vacation', url: '/images/photo-family-beach.jpg' },
  { label: 'Sea Shore', url: '/images/beach_vacation.jpg' },
  { label: 'Family Travel', url: '/images/hero_family_trip.jpg' },
];

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

  // Cover image modal state
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverInput, setCoverInput] = useState('');
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);

  const handleUpdateCover = async (url: string) => {
    if (!url.trim()) return;
    try {
      setIsUpdatingCover(true);
      await api.patch(`/trips/${tripId}`, { cover_image: url.trim() });
      setShowCoverModal(false);
      setCoverInput('');
      loadAllTripData();
    } catch (err: any) {
      alert(err.message || 'Failed to update cover photo');
    } finally {
      setIsUpdatingCover(false);
    }
  };

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

  // Personal financial summary for logged-in user from the start of this trip
  const userBalance = ledger?.balances?.find((b: any) => b.key === `p:${currentPerson?.id}`);
  const userPaid = userBalance ? userBalance.paid : 0;
  const userShare = userBalance ? userBalance.share : 0;
  const userNet = userBalance ? userBalance.net : 0;

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Top Banner with Custom Cover Image & Edit Option */}
      <div style={{ marginBottom: '1.5rem', marginTop: '1rem', position: 'relative' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
        >
          ← {t.back} to {t.dashboard}
        </button>

        <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden' }}>
          <PineForestBanner
            title={trip.name}
            subtitle={`${trip.destination || 'Unspecified location'} · ${trip.start_date || ''} ${trip.end_date ? 'to ' + trip.end_date : ''}`}
            height={220}
            bgImage={trip.cover_image || '/images/mountain_resort.jpg'}
          />

          {/* Change Cover Photo Button (Trip Creator or Super Admin Only) */}
          {isCreatorOrAdmin && (
            <button
              type="button"
              onClick={() => {
                setCoverInput(trip.cover_image || '');
                setShowCoverModal(true);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(8px)',
                borderRadius: '10px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <Camera size={15} />
              <span>Change Cover Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Meta Bar */}
      <div className="card-white p-4" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', borderRadius: '16px', background: '#ffffff', padding: '1rem 1.25rem' }}>
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

      {/* Logged-In User Complete Expense Overview Card from Starting */}
      {currentPerson && (
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.12)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Wallet size={15} /> Your Trip Expense Summary
            </div>
            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
              {currentPerson.display_name}
            </h3>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Your complete personal expenditure & balance since the start of this trip
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total You Paid</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>{formatINR(userPaid)}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Your Allocated Share</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>{formatINR(userShare)}</div>
            </div>

            <div style={{
              background: userNet > 0 ? 'rgba(5, 150, 105, 0.25)' : userNet < 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(148, 163, 184, 0.2)',
              border: userNet > 0 ? '1px solid #059669' : userNet < 0 ? '1px solid #dc2626' : '1px solid #64748b',
              padding: '0.55rem 0.95rem',
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '0.72rem', color: userNet > 0 ? '#34d399' : userNet < 0 ? '#f87171' : '#cbd5e1', textTransform: 'uppercase', fontWeight: 700 }}>
                {userNet > 0 ? 'You Get Back' : userNet < 0 ? 'You Owe' : 'Net Status'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: userNet > 0 ? '#34d399' : userNet < 0 ? '#f87171' : '#ffffff' }}>
                {userNet > 0 ? `+${formatINR(userNet)}` : userNet < 0 ? `-${formatINR(Math.abs(userNet))}` : 'All settled (₹0)'}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  className="card-white"
                  style={{
                    borderRadius: '14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    opacity: exp.voided_at ? 0.45 : 1,
                    padding: '1rem 1.25rem',
                    borderLeft: exp.voided_at ? '4px solid #cbd5e1' : exp.is_my_payment === 1 ? '4px solid #059669' : exp.my_share_paise > 0 ? '4px solid #3b82f6' : '4px solid #e2e8f0',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{exp.title}</h4>
                      <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>{exp.category}</span>
                      <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>{exp.split_method}</span>
                      {exp.voided_at && <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>VOIDED</span>}
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                      {exp.expense_date} · Paid by <strong style={{ color: '#0f172a' }}>{exp.payer_name}</strong> · {exp.participant_count} participants
                    </div>

                    {/* Member Share Highlight for Logged-In User */}
                    {!exp.voided_at && currentPerson && (
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {exp.is_my_payment === 1 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.55rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Check size={12} /> You paid this full bill
                          </span>
                        )}
                        {exp.my_share_paise > 0 ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.55rem', borderRadius: '6px' }}>
                            Your share: {formatINR(exp.my_share_paise)}
                          </span>
                        ) : exp.is_my_payment !== 1 && (
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.15rem 0.55rem', borderRadius: '6px' }}>
                            Not in your split
                          </span>
                        )}
                      </div>
                    )}
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

      {/* TAB CONTENT: Balances & Settlements (Lovable Style) */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Top 3 Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Total Trip Spend */}
            <div className="card-white" style={{ borderRadius: '16px', padding: '1.35rem 1.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Trip Spend
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                  <CreditCard size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                {formatINR(ledger?.totalGroupSpend || 0)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                Across {expenses.filter(e => !e.voided_at).length} active expenses
              </div>
            </div>

            {/* Your Share */}
            <div className="card-white" style={{ borderRadius: '16px', padding: '1.35rem 1.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Your Share
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7', fontFamily: 'var(--font-display)' }}>
                {formatINR(userShare)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.35rem' }}>
                You paid {formatINR(userPaid)} directly
              </div>
            </div>

            {/* Net Position */}
            <div className="card-white" style={{
              borderRadius: '16px',
              padding: '1.35rem 1.5rem',
              border: userNet > 0 ? '1px solid #86efac' : userNet < 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0',
              background: userNet > 0 ? '#f0fdf4' : userNet < 0 ? '#fef2f2' : '#ffffff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: userNet > 0 ? '#15803d' : userNet < 0 ? '#b91c1c' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {userNet > 0 ? 'You Get Back' : userNet < 0 ? 'You Owe' : 'Your Balance'}
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: userNet > 0 ? '#dcfce7' : userNet < 0 ? '#fee2e2' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: userNet > 0 ? '#15803d' : userNet < 0 ? '#b91c1c' : '#64748b',
                }}>
                  <Scale size={18} />
                </div>
              </div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: userNet > 0 ? '#15803d' : userNet < 0 ? '#b91c1c' : '#64748b',
                fontFamily: 'var(--font-display)',
              }}>
                {userNet > 0 ? `+${formatINR(userNet)}` : userNet < 0 ? `-${formatINR(Math.abs(userNet))}` : '₹0 Settled'}
              </div>
              <div style={{ fontSize: '0.78rem', color: userNet > 0 ? '#15803d' : userNet < 0 ? '#b91c1c' : '#64748b', marginTop: '0.35rem' }}>
                {userNet > 0 ? 'Others owe you money' : userNet < 0 ? 'Please settle with members' : 'All accounts even'}
              </div>
            </div>
          </div>

          {/* Settle Up Bar */}
          <div className="card-white" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderRadius: '16px', padding: '1rem 1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: ledger?.status === 'settled' ? '#dcfce7' : '#fef3c7',
                color: ledger?.status === 'settled' ? '#15803d' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {ledger?.status === 'settled' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  {ledger?.status === 'settled' ? 'Trip is fully settled' : 'Unsettled balances pending'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {ledger?.status === 'settled'
                    ? 'All participant debits and credits have been reconciled.'
                    : 'Check suggested transfers below to settle with minimum transactions.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRepaymentPrefill(null);
                setShowRepaymentModal(true);
              }}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              <Scale size={16} /> {t.recordRepayment}
            </button>
          </div>

          {/* Suggested Transfers (Minimal Path) */}
          {ledger?.suggestedSettlements && ledger.suggestedSettlements.length > 0 && (
            <div className="card-white" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Sparkles size={18} style={{ color: '#059669' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
                  Suggested Settlement Transfers
                </h3>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                Calculated with a minimal-path transaction solver to settle all balances in the fewest steps.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ledger.suggestedSettlements.map((s: any, idx: number) => {
                  const isCurrentDebtor = s.from_id === currentPerson?.id && s.from_type === 'person';
                  const isCurrentCreditor = s.to_id === currentPerson?.id && s.to_type === 'person';

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isCurrentDebtor ? '#fef2f2' : isCurrentCreditor ? '#f0fdf4' : '#f8fafc',
                        border: isCurrentDebtor ? '1px solid #fecaca' : isCurrentCreditor ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          background: '#fee2e2',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}>
                          {s.from_name.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{s.from_name}</span>
                          {isCurrentDebtor && <span className="badge badge-red" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>You</span>}
                          <span style={{ color: '#64748b', margin: '0 0.5rem', fontSize: '0.85rem' }}>owes</span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{s.to_name}</span>
                          {isCurrentCreditor && <span className="badge badge-green" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>You</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                          {formatINR(s.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openRepaymentForSuggestion(s)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.4rem 0.85rem' }}
                        >
                          Settle Now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Member Balances Grid (Lovable style cards) */}
          <div className="card-white" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', fontFamily: 'var(--font-display)' }}>
              Member Balances
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Full financial standing for every participant from the start of the trip.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {ledger?.balances?.map((b: any) => {
                const initials = b.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                const isMe = b.key === `p:${currentPerson?.id}`;

                return (
                  <div
                    key={b.key}
                    style={{
                      background: '#ffffff',
                      border: isMe ? '2px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div>
                      {/* Card Header: Avatar, Name, Net Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: isMe ? '#0f172a' : '#f1f5f9',
                            color: isMe ? '#ffffff' : '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {b.name}
                              {isMe && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>You</span>}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {b.type === 'family' ? 'Family Unit' : 'Individual'}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '8px',
                          background: b.net > 0 ? '#dcfce7' : b.net < 0 ? '#fee2e2' : '#f1f5f9',
                          color: b.net > 0 ? '#15803d' : b.net < 0 ? '#dc2626' : '#64748b',
                        }}>
                          {b.net > 0 ? `+${formatINR(b.net)} Gets back` : b.net < 0 ? `-${formatINR(Math.abs(b.net))} Owes` : 'Settled'}
                        </span>
                      </div>

                      {/* Stat Rows */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '10px',
                        padding: '0.75rem',
                        fontSize: '0.78rem',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        border: '1px solid #f1f5f9',
                      }}>
                        <div>
                          <div style={{ color: '#64748b' }}>Total Paid</div>
                          <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '1px' }}>{formatINR(b.paid)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Total Share</div>
                          <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '1px' }}>{formatINR(b.share)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Repaid</div>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>{formatINR(b.sent)}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b' }}>Received</div>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>{formatINR(b.received)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Settle Up Action Button if debt exists */}
                    {b.net !== 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (b.net < 0) {
                              setRepaymentPrefill({
                                from: { type: b.type, id: b.id, name: b.name },
                                to: null,
                                amountPaise: Math.abs(b.net),
                              });
                            } else {
                              setRepaymentPrefill({
                                from: null,
                                to: { type: b.type, id: b.id, name: b.name },
                                amountPaise: b.net,
                              });
                            }
                            setShowRepaymentModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem' }}
                        >
                          <Scale size={14} /> Settle with {b.name.split(' ')[0]}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Repayments History */}
          {repayments.length > 0 && (
            <div className="card-white" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.85rem', fontFamily: 'var(--font-display)' }}>
                Recorded Repayments History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {repayments.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '0.85rem 1.15rem',
                      borderRadius: '12px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>
                        <strong style={{ color: '#dc2626' }}>{r.from_name}</strong> repaid <strong style={{ color: '#059669' }}>{r.to_name}</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {r.paid_on} {r.reference && `· Ref: ${r.reference}`} {r.note && `· "${r.note}"`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#059669', fontSize: '1.15rem' }}>
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

      {/* Cover Image Modal (Creator or Super Admin Only) */}
      {showCoverModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="card-white" style={{ width: '100%', maxWidth: '520px', borderRadius: '18px', padding: '1.75rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Camera size={20} style={{ color: '#0f172a' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                  Change Trip Cover Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Select a curated cover photo or enter an image URL. This main image will be displayed on the trip banner and dashboard for all members.
            </p>

            {/* Presets */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Curated Presets
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                {COVER_PRESETS.map(preset => {
                  const isSelected = coverInput === preset.url;
                  return (
                    <div
                      key={preset.url}
                      onClick={() => setCoverInput(preset.url)}
                      style={{
                        position: 'relative',
                        height: '75px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid #0f172a' : '2px solid transparent',
                        boxShadow: isSelected ? '0 0 0 2px #38bdf8' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 70%)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: '4px 6px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#ffffff',
                      }}>
                        {preset.label}
                      </div>
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: '#0f172a',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom URL Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Or Custom Image URL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={coverInput}
                  onChange={(e) => setCoverInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '0.88rem',
                  }}
                />
                <ImageIcon size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>
            </div>

            {/* Preview */}
            {coverInput && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.35rem' }}>Live Preview:</div>
                <div style={{ width: '100%', height: '110px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <img
                    src={coverInput}
                    alt="Cover Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/mountain_resort.jpg';
                    }}
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                className="btn btn-secondary"
                disabled={isUpdatingCover}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleUpdateCover(coverInput)}
                className="btn btn-primary"
                disabled={isUpdatingCover || !coverInput.trim()}
              >
                {isUpdatingCover ? 'Saving...' : 'Save Cover Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
