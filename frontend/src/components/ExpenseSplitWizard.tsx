import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { Translations } from '../i18n/translations';
import { api } from '../api/client';
import {
  Users,
  Check,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  X,
  CreditCard,
  Calendar,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface Participant {
  id: number;
  display_name: string;
  family_id: number | null;
  family_name: string | null;
}

interface Family {
  id: number;
  name: string;
}

interface Props {
  tripId: number;
  participants: Participant[];
  families: Family[];
  onExpenseSaved: () => void;
  onCancel: () => void;
}

const CATEGORIES: Array<{ id: string; labelKey: keyof Translations; icon: string }> = [
  { id: 'Food', labelKey: 'catFood', icon: '🍽️' },
  { id: 'Transport', labelKey: 'catTransport', icon: '🚕' },
  { id: 'Stay', labelKey: 'catStay', icon: '🏨' },
  { id: 'Activities', labelKey: 'catActivities', icon: '🎯' },
  { id: 'Shopping', labelKey: 'catShopping', icon: '🛍️' },
  { id: 'General', labelKey: 'catGeneral', icon: '📦' },
];

export const ExpenseSplitWizard: React.FC<Props> = ({
  tripId,
  participants,
  families,
  onExpenseSaved,
  onCancel,
}) => {
  const { t, formatINR } = useI18n();

  const [title, setTitle] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Food');
  // Starts EMPTY / 0 - users must deliberately enter the expense amount
  const [totalRupees, setTotalRupees] = useState('');
  const [payerType, setPayerType] = useState<'person' | 'family'>('person');
  const [payerId, setPayerId] = useState<number>(participants[0]?.id || 1);

  // Split Method: defaults to equal split
  const [splitMethod, setSplitMethod] = useState<'equal' | 'individual_remainder' | 'custom' | 'per_head' | 'percentage' | 'family_wise'>('equal');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Selected participant keys (e.g. ['p:1', 'p:2'])
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => participants.map(p => `p:${p.id}`));

  // For individual amount + equal shared remainder: record of accountKey -> rupee string
  const [individualAmounts, setIndividualAmounts] = useState<Record<string, string>>({});

  // For custom amounts: record of accountKey -> rupee string
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // For percentages: record of accountKey -> percentage number string
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  // For per-head: rate string + record of accountKey -> heads number
  const [perHeadRateStr, setPerHeadRateStr] = useState('150');
  const [perHeadCounts, setPerHeadCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    participants.forEach(p => { initial[`p:${p.id}`] = 1; });
    return initial;
  });

  const [preview, setPreview] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toPaise = (rupeeStr: string): number => {
    const clean = (rupeeStr || '').trim().replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num < 0 ? 0 : Math.round(num * 100);
  };

  const totalPaise = toPaise(totalRupees);
  const individualTotalPaise = selectedKeys.reduce((sum, k) => sum + toPaise(individualAmounts[k] || '0'), 0);
  const sharedRemainderPaise = totalPaise - individualTotalPaise;
  const isIndividualTotalOver = splitMethod === 'individual_remainder' && individualTotalPaise > totalPaise;
  const equalRemainderPerPersonPaise = (splitMethod === 'individual_remainder' && selectedKeys.length > 0)
    ? Math.floor(Math.max(0, sharedRemainderPaise) / selectedKeys.length)
    : 0;
  const equalSharePaise = selectedKeys.length > 0 ? Math.floor(totalPaise / selectedKeys.length) : 0;

  // Live preview effect
  useEffect(() => {
    const runPreview = async () => {
      try {
        setErrorMsg(null);

        if (totalPaise <= 0) {
          setPreview(null);
          return;
        }

        if (selectedKeys.length === 0) {
          setPreview(null);
          return;
        }

        if (splitMethod === 'individual_remainder' && isIndividualTotalOver) {
          setPreview(null);
          return;
        }

        const hasFamilies = selectedKeys.some(k => k.startsWith('f:'));
        const hasPersons = selectedKeys.some(k => k.startsWith('p:'));
        const accountingMode = splitMethod === 'family_wise'
          ? 'family'
          : (hasFamilies && hasPersons)
            ? 'mixed'
            : hasFamilies
              ? 'family'
              : 'individual';

        const safePayerId = Number(payerId) > 0 ? Number(payerId) : (participants[0]?.id || 1);
        const safePayerType = payerType || 'person';

        const payload: any = {
          title: title.trim() || 'Expense',
          expense_date: expenseDate || new Date().toISOString().split('T')[0],
          category: category || 'general',
          paid_by_type: safePayerType,
          paid_by_id: safePayerId,
          accounting_mode: accountingMode,
          split_method: splitMethod,
          total_paise: totalPaise,
        };

        if (splitMethod === 'individual_remainder') {
          payload.individual_entries = selectedKeys.map(k => ({
            id: k,
            individual_amount_paise: toPaise(individualAmounts[k] || '0'),
          }));
        } else if (splitMethod === 'equal') {
          payload.participant_keys = selectedKeys;
        } else if (splitMethod === 'per_head') {
          payload.per_head_rate_paise = toPaise(perHeadRateStr);
          payload.per_head_entries = Object.entries(perHeadCounts)
            .filter(([k]) => selectedKeys.includes(k))
            .map(([id, heads]) => ({ id, heads }));
        } else if (splitMethod === 'custom') {
          payload.custom_entries = selectedKeys.map(k => ({
            id: k,
            amount_paise: toPaise(customAmounts[k] || '0'),
          }));
        } else if (splitMethod === 'percentage') {
          payload.percentage_entries = selectedKeys.map(k => ({
            id: k,
            bps: Math.round(parseFloat(percentages[k] || '0') * 100),
          }));
        } else if (splitMethod === 'family_wise') {
          payload.participant_keys = families.map(f => `f:${f.id}`);
        }

        const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
        setPreview(res);
      } catch (err: any) {
        setPreview(null);
      }
    };

    const timer = setTimeout(runPreview, 200);
    return () => clearTimeout(timer);
  }, [totalPaise, splitMethod, selectedKeys, individualAmounts, customAmounts, percentages, perHeadRateStr, perHeadCounts, isIndividualTotalOver, tripId, families]);

  const toggleKey = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    setSelectedKeys(participants.map(p => `p:${p.id}`));
  };

  const selectNone = () => {
    setSelectedKeys([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg('Please enter an expense title / description');
      return;
    }

    if (totalPaise <= 0) {
      setErrorMsg('Please enter an expense amount greater than ₹0');
      return;
    }

    if (selectedKeys.length === 0) {
      setErrorMsg('Please select at least one participant');
      return;
    }

    if (splitMethod === 'individual_remainder' && isIndividualTotalOver) {
      setErrorMsg(`Individual amounts sum (${formatINR(individualTotalPaise)}) exceeds total bill (${formatINR(totalPaise)})`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const hasFamilies = selectedKeys.some(k => k.startsWith('f:'));
      const hasPersons = selectedKeys.some(k => k.startsWith('p:'));
      const accountingMode = splitMethod === 'family_wise'
        ? 'family'
        : (hasFamilies && hasPersons)
          ? 'mixed'
          : hasFamilies
            ? 'family'
            : 'individual';

      const safePayerId = Number(payerId) > 0 ? Number(payerId) : (participants[0]?.id || 1);
      const safePayerType = payerType || 'person';

      const payload: any = {
        title: title.trim(),
        expense_date: expenseDate,
        category,
        total_paise: totalPaise,
        paid_by_type: safePayerType,
        paid_by_id: safePayerId,
        accounting_mode: accountingMode,
        split_method: splitMethod,
      };

      if (splitMethod === 'individual_remainder') {
        payload.individual_entries = selectedKeys.map(k => ({
          id: k,
          individual_amount_paise: toPaise(individualAmounts[k] || '0'),
        }));
      } else if (splitMethod === 'equal') {
        payload.participant_keys = selectedKeys;
      } else if (splitMethod === 'per_head') {
        payload.per_head_rate_paise = toPaise(perHeadRateStr);
        payload.per_head_entries = Object.entries(perHeadCounts)
          .filter(([k]) => selectedKeys.includes(k))
          .map(([id, heads]) => ({ id, heads }));
      } else if (splitMethod === 'custom') {
        payload.custom_entries = selectedKeys.map(k => ({
          id: k,
          amount_paise: toPaise(customAmounts[k] || '0'),
        }));
      } else if (splitMethod === 'percentage') {
        payload.percentage_entries = selectedKeys.map(k => ({
          id: k,
          bps: Math.round(parseFloat(percentages[k] || '0') * 100),
        }));
      } else if (splitMethod === 'family_wise') {
        payload.participant_keys = families.map(f => `f:${f.id}`);
      }

      await api.post(`/trips/${tripId}/expenses`, payload);
      onExpenseSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="card-white"
      style={{
        borderRadius: '20px',
        maxWidth: '680px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
        background: '#ffffff',
        boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <CreditCard size={15} /> {t.expenseEngine}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-display)' }}>
            {t.addExpense}
          </h2>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            {t.expenseEngineSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={22} />
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
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* HERO AMOUNT INPUT */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1.25rem',
          textAlign: 'center',
        }}>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
            {t.totalExpenseAmount}
          </label>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={totalRupees}
              onChange={e => setTotalRupees(e.target.value)}
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#0f172a',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                textAlign: 'center',
                width: totalRupees ? `${Math.max(4, totalRupees.length + 1)}ch` : '5ch',
                fontFamily: 'var(--font-display)',
              }}
              required
              autoFocus
            />
          </div>
        </div>

        {/* TITLE & DATE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              {t.expenseTitle} *
            </label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.expenseTitlePlaceholder}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              {t.expenseDate}
            </label>
            <input
              type="date"
              className="form-input"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* WHO PAID */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
            {t.whoPaidTheBill}
          </label>
          <select
            className="form-select"
            value={`${payerType}:${payerId}`}
            onChange={e => {
              const [type, id] = e.target.value.split(':');
              setPayerType(type as any);
              setPayerId(Number(id));
            }}
          >
            <optgroup label={t.membersGroup}>
              {participants.map(p => (
                <option key={`p:${p.id}`} value={`p:${p.id}`}>
                  {p.display_name} {p.family_name ? `(${p.family_name})` : ''}
                </option>
              ))}
            </optgroup>
            {families.length > 0 && (
              <optgroup label={t.familiesGroup}>
                {families.map(f => (
                  <option key={`f:${f.id}`} value={`f:${f.id}`}>
                    {f.name} ({t.familyAccount})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* CATEGORY SELECTOR */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
            {t.category}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: category === cat.id ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: category === cat.id ? '#0f172a' : '#ffffff',
                  color: category === cat.id ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{cat.icon}</span>
                <span>{t[cat.labelKey] || cat.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SPLIT METHOD TABS */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
            {t.splitMethod}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              { id: 'equal', label: t.equalSplit },
              { id: 'individual_remainder', label: t.individualRemainderSplit },
              { id: 'custom', label: t.customSplit },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSplitMethod(m.id as any)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: splitMethod === m.id ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: splitMethod === m.id ? '#0f172a' : '#f8fafc',
                  color: splitMethod === m.id ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                {m.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                background: ['percentage', 'per_head', 'family_wise'].includes(splitMethod) ? '#0f172a' : '#f8fafc',
                color: ['percentage', 'per_head', 'family_wise'].includes(splitMethod) ? '#ffffff' : '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>{t.moreOptions}</span>
              <ChevronDown size={14} />
            </button>
          </div>

          {showMoreOptions && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem', padding: '0.65rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {[
                { id: 'percentage', label: t.percentageSplit },
                { id: 'per_head', label: t.perHeadSplit },
                { id: 'family_wise', label: t.familyWiseSplit },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSplitMethod(m.id as any);
                    setShowMoreOptions(false);
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: splitMethod === m.id ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                    background: splitMethod === m.id ? '#0f172a' : '#ffffff',
                    color: splitMethod === m.id ? '#ffffff' : '#475569',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LIVE MATH BREAKDOWN BAR (Compact & Clean) */}
        {splitMethod === 'individual_remainder' && totalPaise > 0 && (
          <div style={{
            background: isIndividualTotalOver ? '#fef2f2' : '#f0fdf4',
            border: isIndividualTotalOver ? '1px solid #fecaca' : '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            gap: '0.5rem',
          }}>
            <div>
              <span style={{ color: '#64748b' }}>{t.customItems}: </span>
              <strong style={{ color: isIndividualTotalOver ? '#dc2626' : '#0f172a' }}>{formatINR(individualTotalPaise)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>{t.remainingToShare}: </span>
              <strong style={{ color: sharedRemainderPaise < 0 ? '#dc2626' : '#059669' }}>
                {sharedRemainderPaise < 0 ? `Over by ${formatINR(Math.abs(sharedRemainderPaise))}` : formatINR(sharedRemainderPaise)}
              </strong>
            </div>
            {selectedKeys.length > 0 && sharedRemainderPaise > 0 && (
              <div>
                <span style={{ color: '#059669', fontWeight: 700 }}>
                  +{formatINR(equalRemainderPerPersonPaise)} / person
                </span>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTS LIST */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              {t.participatingMembers} ({selectedKeys.length} / {participants.length})
              {splitMethod === 'equal' && selectedKeys.length > 0 && totalPaise > 0 && (
                <span style={{ color: '#059669', fontWeight: 600, marginLeft: '0.4rem' }}>
                  (≈ {formatINR(equalSharePaise)})
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={selectAll}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', color: '#dc2626' }}
              >
                {t.selectNone}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
            {participants.map(p => {
              const key = `p:${p.id}`;
              const isSelected = selectedKeys.includes(key);
              const previewAlloc = preview?.allocations?.find((a: any) => a.id === key);
              const finalAmount = previewAlloc ? previewAlloc.amount : (splitMethod === 'equal' && isSelected ? equalSharePaise : 0);

              return (
                <div
                  key={key}
                  onClick={() => toggleKey(key)}
                  style={{
                    padding: '0.65rem 0.8rem',
                    borderRadius: '10px',
                    background: isSelected ? '#ffffff' : '#f1f5f9',
                    border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isSelected ? '#0f172a' : '#cbd5e1',
                        color: isSelected ? '#ffffff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}>
                        {p.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.display_name}
                        </div>
                        {p.family_name && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.family_name}</div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      background: isSelected ? '#0f172a' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                    }}>
                      {isSelected && <Check size={12} />}
                    </div>
                  </div>

                  {/* Individual input when individual_remainder is active */}
                  {isSelected && splitMethod === 'individual_remainder' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{t.individualPortion}:</span>
                        {finalAmount > 0 && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>
                            {formatINR(finalAmount)}
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.3rem 0.5rem 0.3rem 1.4rem', fontSize: '0.78rem' }}
                          placeholder="0.00"
                          value={individualAmounts[key] ?? ''}
                          onChange={e => setIndividualAmounts({ ...individualAmounts, [key]: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom amount input */}
                  {isSelected && splitMethod === 'custom' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.75rem' }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.3rem 0.5rem 0.3rem 1.4rem', fontSize: '0.78rem' }}
                          placeholder="0.00"
                          value={customAmounts[key] ?? ''}
                          onChange={e => setCustomAmounts({ ...customAmounts, [key]: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-secondary"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || totalPaise <= 0 || !title.trim() || isIndividualTotalOver}
            className="btn btn-primary"
            style={{ minWidth: '180px', justifyContent: 'center' }}
          >
            {isSubmitting ? t.savingExpense : `${t.saveExpenseBtn} (${totalPaise > 0 ? formatINR(totalPaise) : '₹0'})`}
          </button>
        </div>
      </form>
    </div>
  );
};
