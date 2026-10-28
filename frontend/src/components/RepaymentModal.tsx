import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

interface Props {
  tripId: number;
  initialFrom?: { type: 'person' | 'family'; id: number; name: string };
  initialTo?: { type: 'person' | 'family'; id: number; name: string };
  initialAmountPaise?: number;
  accounts: Array<{ key: string; type: 'person' | 'family'; id: number; name: string }>;
  onRepaymentSaved: () => void;
  onClose: () => void;
}

export const RepaymentModal: React.FC<Props> = ({
  tripId,
  initialFrom,
  initialTo,
  initialAmountPaise,
  accounts,
  onRepaymentSaved,
  onClose,
}) => {
  const { t, formatINR } = useI18n();

  const [fromType, setFromType] = useState<'person' | 'family'>(initialFrom?.type || accounts[0]?.type || 'person');
  const [fromId, setFromId] = useState<number>(initialFrom?.id || accounts[0]?.id || 1);

  const [toType, setToType] = useState<'person' | 'family'>(initialTo?.type || accounts[1]?.type || 'person');
  const [toId, setToId] = useState<number>(initialTo?.id || accounts[1]?.id || 2);

  const [amountRupees, setAmountRupees] = useState(() =>
    initialAmountPaise ? String(initialAmountPaise / 100) : ''
  );
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [allowAdvance, setAllowAdvance] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toPaise = (val: string): number => {
    const num = parseFloat(val.trim());
    return isNaN(num) || num <= 0 ? 0 : Math.round(num * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = toPaise(amountRupees);
    if (paise <= 0) {
      setErrorMsg('Please enter a valid repayment amount');
      return;
    }

    if (fromType === toType && fromId === toId) {
      setErrorMsg('Sender and recipient must be different');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await api.post(`/trips/${tripId}/repayments`, {
        from_type: fromType,
        from_id: fromId,
        to_type: toType,
        to_id: toId,
        amount_paise: paise,
        paid_on: paidOn,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        allow_advance: allowAdvance,
      });

      onRepaymentSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record repayment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{t.recordRepayment}</h3>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">{t.close}</button>
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
            <ShieldAlert size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Sender & Recipient */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From (Debtor)</label>
              <select
                className="form-select"
                value={`${fromType}:${fromId}`}
                onChange={e => {
                  const [t, id] = e.target.value.split(':');
                  setFromType(t as any);
                  setFromId(Number(id));
                }}
              >
                {accounts.map(a => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', paddingTop: '1.25rem' }}>
              <ArrowRight size={20} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To (Creditor)</label>
              <select
                className="form-select"
                value={`${toType}:${toId}`}
                onChange={e => {
                  const [t, id] = e.target.value.split(':');
                  setToType(t as any);
                  setToId(Number(id));
                }}
              >
                {accounts.map(a => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t.repaymentAmount}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="₹ Amount"
                value={amountRupees}
                onChange={e => setAmountRupees(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-input"
                value={paidOn}
                onChange={e => setPaidOn(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reference & Note */}
          <div className="form-group">
            <label className="form-label">{t.reference}</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. UPI / Google Pay / Cash / Bank Txn"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.note}</label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional description"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Advance checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="checkbox"
              id="advanceCheck"
              checked={allowAdvance}
              onChange={e => setAllowAdvance(e.target.checked)}
            />
            <label htmlFor="advanceCheck" style={{ fontSize: '0.85rem', color: '#95b8a6', cursor: 'pointer' }}>
              {t.allowAdvance} (Permit payment above current net debt)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">{t.cancel}</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? t.loading : t.recordRepayment}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
