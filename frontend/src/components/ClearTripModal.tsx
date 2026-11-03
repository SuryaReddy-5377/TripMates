import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  AlertTriangle,
  ShieldAlert,
  Trash2,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export interface TripToClear {
  id: number;
  name: string;
  destination?: string | null;
  participant_count?: number;
  expense_count?: number;
  total_spent_paise?: number;
}

interface Props {
  trip: TripToClear;
  onClose: () => void;
  onTripCleared: () => void;
}

export const ClearTripModal: React.FC<Props> = ({ trip, onClose, onTripCleared }) => {
  const { t, formatINR } = useI18n();

  // Two-step confirmation state
  const [step, setStep] = useState<1 | 2>(1);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const normalizedTripName = trip.name.trim().toLowerCase();
  const normalizedTyped = typedConfirmation.trim().toLowerCase();
  const isMatch = normalizedTyped === 'delete' || normalizedTyped === normalizedTripName;

  const handleExecuteDelete = async () => {
    if (!isMatch || !isAgreed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.delete(`/admin/trips/${trip.id}`);
      onTripCleared();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clear trip for all users');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="card-white"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '20px',
          padding: '2rem',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
          border: '1.5px solid #fecaca',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fecaca',
              flexShrink: 0,
            }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#dc2626', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Lock size={12} /> {t.superAdmin} · Permanent Action
              </div>
              <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                {t.clearTripForAllUsers}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: '#dc2626',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Selected Trip Details Card */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Target Trip to Clear
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {trip.name}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            {trip.destination && <span>📍 {trip.destination}</span>}
            {trip.participant_count !== undefined && <span>👥 {trip.participant_count} participants</span>}
            {trip.expense_count !== undefined && <span>💳 {trip.expense_count} expenses</span>}
            {trip.total_spent_paise !== undefined && trip.total_spent_paise > 0 && (
              <span>💰 {formatINR(trip.total_spent_paise)}</span>
            )}
          </div>
        </div>

        {/* STEP 1: WARNING AND IMPACT EXPLANATION */}
        {step === 1 && (
          <div>
            <div style={{
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
              borderRadius: '14px',
              padding: '1rem 1.15rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#be123c', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                <AlertTriangle size={17} />
                <span>Critical Warning: Affects All Platform Users</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.45 }}>
                {t.clearTripWarning}
              </p>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                The following data will be permanently purged from PostgreSQL:
              </div>
              <ul style={{ margin: '0 0 0 1.25rem', padding: 0, color: '#475569', fontSize: '0.8rem' }}>
                <li>The trip record from all users' dashboards and family trip lists</li>
                <li>All participant invitations, attendance states, and history</li>
                <li>All expenses, itemized bill items, charges, and member split allocations</li>
                <li>All repayments and debt settlements associated with this trip</li>
                <li>All visiting itinerary places, map coordinates, and trip notifications</li>
              </ul>
              <div style={{ marginTop: '0.65rem', padding: '0.55rem 0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={15} />
                <span><strong>User accounts</strong>, <strong>family accounts</strong>, and <strong>unrelated trips</strong> will remain 100% unaffected.</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>Proceed to Final Confirmation</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SECOND CONFIRMATION WITH TYPED PHRASE */}
        {step === 2 && (
          <div>
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '0.9rem 1rem',
              marginBottom: '1rem',
            }}>
              <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: '0.86rem', marginBottom: '0.25rem' }}>
                Second Confirmation Required
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.4 }}>
                To verify administrative intent and prevent accidental deletion, please type{' '}
                <strong style={{ background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '4px', letterSpacing: '0.04em' }}>
                  {trip.name}
                </strong>{' '}
                or <strong style={{ background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>DELETE</strong> in the box below:
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Type trip name or DELETE to confirm:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={trip.name}
                value={typedConfirmation}
                onChange={e => setTypedConfirmation(e.target.value)}
                autoFocus
                style={{
                  borderColor: isMatch ? '#059669' : '#cbd5e1',
                  background: isMatch ? '#f0fdf4' : '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                }}
              />
              {typedConfirmation && (
                <div style={{ fontSize: '0.74rem', marginTop: '0.25rem', color: isMatch ? '#059669' : '#dc2626', fontWeight: 600 }}>
                  {isMatch ? '✓ Confirmation matched' : 'Phrase does not match'}
                </div>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', cursor: 'pointer', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#334155' }}>
              <input
                type="checkbox"
                checked={isAgreed}
                onChange={e => setIsAgreed(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
              />
              <span>
                I confirm that I want to <strong>permanently erase this trip for ALL users</strong> and understand this cannot be reversed.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={!isMatch || !isAgreed || isSubmitting}
                className="btn btn-danger"
                style={{ minWidth: '220px', justifyContent: 'center' }}
              >
                {isSubmitting ? (
                  <span>{t.clearingTrip}</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Trash2 size={15} />
                    <span>{t.clearTripBtn}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

