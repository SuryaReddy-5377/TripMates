import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { Users, Check, AlertCircle, ShieldAlert, Sparkles, Filter, Calculator } from 'lucide-react';

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

  const [splitMethod, setSplitMethod] = useState<'individual_remainder' | 'equal' | 'per_head' | 'custom' | 'percentage' | 'family_wise' | 'mixed'>('individual_remainder');

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
          setErrorMsg(`Individual portions total (${formatINR(individualTotalPaise)}) exceeds total expense (${formatINR(totalPaise)}) by ${formatINR(individualTotalPaise - totalPaise)}`);
          return;
        }

        const payload: any = {
          title: title || 'Draft Expense',
          expense_date: expenseDate,
          category,
          paid_by_type: payerType,
          paid_by_id: Number(payerId),
          accounting_mode: splitMethod === 'family_wise' ? 'family' : splitMethod === 'mixed' ? 'mixed' : 'individual',
          split_method: splitMethod,
          total_paise: totalPaise,
        };

        if (splitMethod === 'individual_remainder') {
          payload.individual_remainder_entries = selectedKeys.map(k => ({
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
        } else if (splitMethod === 'mixed') {
          const mixedParts = families.map(f => ({
            type: 'family',
            id: String(f.id),
            amount: Math.round(totalPaise / Math.max(1, families.length + 1)),
          }));
          payload.mixed_parts = mixedParts;
        }

        const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
        setPreview(res);
      } catch (err: any) {
        setPreview(null);
        setErrorMsg(err.message || 'Calculation error');
      }
    };

    const timeout = setTimeout(runPreview, 250);
    return () => clearTimeout(timeout);
  }, [
    title, expenseDate, category, totalRupees, payerType, payerId,
    splitMethod, selectedKeys, individualAmounts, customAmounts,
    percentages, perHeadRateStr, perHeadCounts, tripId, families,
    totalPaise, individualTotalPaise, isIndividualTotalOver
  ]);

  // Selection toggle helpers
  const toggleKey = (key: string) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const selectAll = () => {
    setSelectedKeys(participants.map(p => `p:${p.id}`));
  };

  const selectNone = () => {
    setSelectedKeys([]);
  };

  const selectByFamily = (famId: number) => {
    const famPersonKeys = participants.filter(p => p.family_id === famId).map(p => `p:${p.id}`);
    const allSelected = famPersonKeys.every(k => selectedKeys.includes(k));
    if (allSelected) {
      setSelectedKeys(prev => prev.filter(k => !famPersonKeys.includes(k)));
    } else {
      setSelectedKeys(prev => Array.from(new Set([...prev, ...famPersonKeys])));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(t.enterValidTitle || 'Please enter an expense title');
      return;
    }
    if (totalPaise <= 0) {
      setErrorMsg(t.expenseAmountMustBePositive || 'Please enter an expense amount greater than ₹0');
      return;
    }
    if (selectedKeys.length === 0) {
      setErrorMsg(t.selectAtLeastOneParticipant || 'Please select at least one participant sharing this expense');
      return;
    }
    if (splitMethod === 'individual_remainder' && isIndividualTotalOver) {
      setErrorMsg(`Individual portions total (${formatINR(individualTotalPaise)}) exceeds total expense (${formatINR(totalPaise)})`);
      return;
    }
    if (!preview) {
      setErrorMsg('Please ensure calculations reconcile before saving');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload: any = {
        title: title.trim(),
        expense_date: expenseDate,
        category,
        paid_by_type: payerType,
        paid_by_id: Number(payerId),
        accounting_mode: splitMethod === 'family_wise' ? 'family' : splitMethod === 'mixed' ? 'mixed' : 'individual',
        split_method: splitMethod,
        total_paise: totalPaise,
      };

      if (splitMethod === 'individual_remainder') {
        payload.individual_remainder_entries = selectedKeys.map(k => ({
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
    <div className="glass-panel-elevated p-4 sm:p-6" style={{ borderRadius: '16px', maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{t.quickSplit}</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Flexible splitting: Individual portions + Equal shared remainder, Equal, Per-Head, Custom, Percentage, or Family</p>
        </div>
        <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm">{t.cancel}</button>
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

      <form onSubmit={handleSave}>
        {/* Form Inputs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.expenseTitle}</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Manali River Rafting or Lunch"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.totalAmount} (₹)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#64748b',
              }}>₹</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                style={{
                  paddingLeft: '28px',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
                placeholder="0.00"
                value={totalRupees}
                onChange={e => setTotalRupees(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.expenseDate}</label>
            <input
              type="date"
              className="form-input"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.whoPaid || t.paidBy}</label>
            <select
              className="form-select"
              value={`${payerType}:${payerId}`}
              onChange={e => {
                const [type, id] = e.target.value.split(':');
                setPayerType(type as any);
                setPayerId(Number(id));
              }}
            >
              <optgroup label="Individuals">
                {participants.map(p => (
                  <option key={`p:${p.id}`} value={`p:${p.id}`}>{p.display_name}</option>
                ))}
              </optgroup>
              {families.length > 0 && (
                <optgroup label="Families">
                  {families.map(f => (
                    <option key={`f:${f.id}`} value={`f:${f.id}`}>{f.name} (Family)</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Category Pills Selection */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ marginBottom: '0.4rem' }}>{t.category}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {['Food', 'Transport', 'Stay', 'Activities', 'Shopping', 'General'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: category === cat ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                  background: category === cat ? '#0f172a' : '#ffffff',
                  color: category === cat ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Split Method Tabs */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="form-label">{t.splitMethod}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {[
              { id: 'individual_remainder', label: t.individualRemainderSplit },
              { id: 'equal', label: t.equalSplit },
              { id: 'per_head', label: t.perHeadSplit },
              { id: 'custom', label: t.customSplit },
              { id: 'percentage', label: t.percentageSplit },
              { id: 'family_wise', label: t.familyWiseSplit },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSplitMethod(m.id as any)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: splitMethod === m.id ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  background: splitMethod === m.id ? '#0f172a' : '#f8fafc',
                  color: splitMethod === m.id ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Live Math Summary for Individual Amount + Equal Shared Remainder */}
        {splitMethod === 'individual_remainder' && (
          <div style={{
            background: isIndividualTotalOver ? '#fef2f2' : '#f0fdf4',
            border: isIndividualTotalOver ? '1px solid #fecaca' : '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.85rem',
          }}>
            <div>
              <div style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>{t.totalAmount}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{formatINR(totalPaise)}</div>
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>{t.individualTotal}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isIndividualTotalOver ? '#dc2626' : '#0f172a' }}>
                {formatINR(individualTotalPaise)}
              </div>
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>{t.sharedRemainder}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: sharedRemainderPaise < 0 ? '#dc2626' : '#059669' }}>
                {sharedRemainderPaise < 0 ? `Over by ${formatINR(Math.abs(sharedRemainderPaise))}` : formatINR(sharedRemainderPaise)}
              </div>
            </div>
            <div>
              <div style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>{t.equalRemainderShare}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669' }}>
                {selectedKeys.length > 0 ? `${formatINR(equalRemainderPerPersonPaise)} / person` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Participant Selection Filters (Select All, Clear, By Family) */}
        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              {t.participatingMembers} ({selectedKeys.length} of {participants.length} selected)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={selectAll}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#dc2626' }}
              >
                {t.selectNone}
              </button>
            </div>
          </div>

          {/* Quick family filter pills */}
          {families.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.selectFamily}:</span>
              {families.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectByFamily(f.id)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Participants interactive cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
            {participants.map(p => {
              const key = `p:${p.id}`;
              const isSelected = selectedKeys.includes(key);
              const previewAlloc = preview?.allocations?.find((a: any) => a.id === key);
              const finalAmount = previewAlloc ? previewAlloc.amount : 0;

              return (
                <div
                  key={key}
                  onClick={() => toggleKey(key)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '12px',
                    background: isSelected ? '#ffffff' : '#f1f5f9',
                    border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? '#0f172a' : '#64748b' }}>
                        {p.display_name}
                      </div>
                      {p.family_name && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.family_name}</div>
                      )}
                    </div>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                        background: isSelected ? '#0f172a' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={14} />}
                    </div>
                  </div>

                  {/* Input field for Individual Amount + Equal Shared Remainder */}
                  {isSelected && splitMethod === 'individual_remainder' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>
                          {t.individualPortion}
                        </label>
                        {preview && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                            {formatINR(finalAmount)}
                          </span>
                        )}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.8rem' }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          placeholder="0"
                          value={individualAmounts[key] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setIndividualAmounts(prev => ({ ...prev, [key]: val }));
                          }}
                          style={{
                            paddingLeft: '1.35rem',
                            paddingRight: '0.5rem',
                            paddingTop: '0.3rem',
                            paddingBottom: '0.3rem',
                            fontSize: '0.85rem',
                            width: '100%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Input field for Custom Split */}
                  {isSelected && splitMethod === 'custom' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                        Custom Amount (₹)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.8rem' }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          placeholder="0"
                          value={customAmounts[key] ?? ''}
                          onChange={e => setCustomAmounts(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ paddingLeft: '1.35rem', paddingRight: '0.5rem', paddingTop: '0.3rem', paddingBottom: '0.3rem', fontSize: '0.85rem', width: '100%' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Input field for Percentage Split */}
                  {isSelected && splitMethod === 'percentage' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                        Percentage (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-input"
                        placeholder="0"
                        value={percentages[key] ?? ''}
                        onChange={e => setPercentages(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: '100%' }}
                      />
                    </div>
                  )}

                  {/* Input field for Per-Head Split */}
                  {isSelected && splitMethod === 'per_head' && (
                    <div
                      style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                        Heads / Portions
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        className="form-input"
                        value={perHeadCounts[key] ?? 1}
                        onChange={e => setPerHeadCounts(prev => ({ ...prev, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: '100%' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Calculation Preview Breakdown */}
        {preview && (
          <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{t.liveBreakdown}</h4>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Total: <strong style={{ color: '#0f172a' }}>{formatINR(preview.totalPaise)}</strong> · Payer own share: {formatINR(preview.summary.payerOwnShare)} · Recoverable: <strong style={{ color: '#059669' }}>{formatINR(preview.summary.recoverable)}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {participants.map(p => {
                const key = `p:${p.id}`;
                const alloc = preview.allocations.find((a: any) => a.id === key);
                const amount = alloc ? alloc.amount : 0;
                const isSelected = selectedKeys.includes(key);
                const indPaise = toPaise(individualAmounts[key] || '0');
                const remainderShare = isSelected ? Math.max(0, amount - indPaise) : 0;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      background: isSelected ? '#ffffff' : '#f1f5f9',
                      border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: isSelected ? '#0f172a' : '#64748b' }}>
                        {p.display_name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isSelected ? '#dc2626' : '#64748b' }}>
                        {isSelected ? (
                          splitMethod === 'individual_remainder' ? (
                            `₹${Math.round(indPaise / 100)} ind. + ₹${Math.round(remainderShare / 100)} shared`
                          ) : t.owes
                        ) : t.owesNothing}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#0f172a' : '#94a3b8' }}>
                      {formatINR(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">{t.cancel}</button>
          <button
            type="submit"
            disabled={isSubmitting || !preview || isIndividualTotalOver}
            className="btn btn-primary"
          >
            {isSubmitting ? t.loading : `${t.save} (${preview ? formatINR(preview.totalPaise) : '...' })`}
          </button>
        </div>
      </form>
    </div>
  );
};
