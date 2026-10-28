import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { Plus, Trash2, AlertTriangle, Users, Calculator, Check, ArrowRight, ShieldAlert } from 'lucide-react';

interface Participant {
  id: number;
  display_name: string;
  family_id: number | null;
  family_name: string | null;
}

interface ItemRow {
  name: string;
  unitPriceStr: string;
  quantity: number;
  assignees: string[]; // ['p:1', ...]
  method?: 'equal' | 'byQuantity' | 'custom';
}

interface ChargeRow {
  kind: 'tax' | 'service' | 'tip' | 'discount' | 'adjustment';
  label: string;
  amountStr: string;
  direction?: 'add' | 'subtract';
}

interface Props {
  tripId: number;
  participants: Participant[];
  families: Array<{ id: number; name: string }>;
  onExpenseSaved: () => void;
  onCancel: () => void;
}

export const ItemizedBillEditor: React.FC<Props> = ({
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
  const [payerType, setPayerType] = useState<'person' | 'family'>('person');
  const [payerId, setPayerId] = useState<number>(participants[0]?.id || 1);
  const [receiptTotalStr, setReceiptTotalStr] = useState('');

  // Items list: start with an empty item row for flexible user entry
  const [items, setItems] = useState<ItemRow[]>([
    { name: '', unitPriceStr: '', quantity: 1, assignees: participants.map(p => `p:${p.id}`) },
  ]);

  // Charges list
  const [charges, setCharges] = useState<ChargeRow[]>([]);

  // Preview state from backend engine
  const [preview, setPreview] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to parse rupee string into integer paise
  const toPaise = (rupeeStr: string): number => {
    const clean = rupeeStr.trim().replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num < 0 ? 0 : Math.round(num * 100);
  };

  // Run preview calculation via backend financial engine whenever items/charges change
  useEffect(() => {
    const runPreview = async () => {
      try {
        setErrorMsg(null);
        const validItems = items
          .filter(it => it.name.trim() !== '' && toPaise(it.unitPriceStr) >= 0 && it.quantity > 0)
          .map(it => ({
            name: it.name,
            unitPrice: toPaise(it.unitPriceStr),
            quantity: Number(it.quantity),
            assignees: it.assignees,
          }));

        if (validItems.length === 0) {
          setPreview(null);
          return;
        }

        const validCharges = charges
          .filter(c => toPaise(c.amountStr) > 0)
          .map(c => ({
            kind: c.kind,
            label: c.label || undefined,
            amount: toPaise(c.amountStr),
            direction: c.direction || 'add',
          }));

        const receiptTotalPaise = receiptTotalStr.trim() ? toPaise(receiptTotalStr) : undefined;

        const res = await api.post(`/trips/${tripId}/expenses/preview`, {
          title: title || 'Draft Bill',
          expense_date: expenseDate,
          category,
          paid_by_type: payerType,
          paid_by_id: Number(payerId),
          accounting_mode: 'individual',
          split_method: 'itemized',
          receipt_total_paise: receiptTotalPaise,
          items: validItems,
          charges: validCharges,
        });

        setPreview(res);
      } catch (err: any) {
        setPreview(null);
        setErrorMsg(err.message || 'Calculation error');
      }
    };

    const timeout = setTimeout(runPreview, 250);
    return () => clearTimeout(timeout);
  }, [items, charges, receiptTotalStr, payerType, payerId, tripId, title, expenseDate, category]);

  const addItem = () => {
    setItems([...items, { name: '', unitPriceStr: '', quantity: 1, assignees: participants.map(p => `p:${p.id}`) }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const toggleAssignee = (itemIdx: number, accountKey: string) => {
    const item = items[itemIdx];
    const exists = item.assignees.includes(accountKey);
    const newAssignees = exists
      ? item.assignees.filter(k => k !== accountKey)
      : [...item.assignees, accountKey];

    const updated = [...items];
    updated[itemIdx] = { ...item, assignees: newAssignees };
    setItems(updated);
  };

  const selectAllAssignees = (itemIdx: number) => {
    const updated = [...items];
    updated[itemIdx] = { ...items[itemIdx], assignees: participants.map(p => `p:${p.id}`) };
    setItems(updated);
  };

  const clearAllAssignees = (itemIdx: number) => {
    const updated = [...items];
    updated[itemIdx] = { ...items[itemIdx], assignees: [] };
    setItems(updated);
  };

  const addCharge = () => {
    setCharges([...charges, { kind: 'tax', label: 'GST', amountStr: '' }]);
  };

  const removeCharge = (idx: number) => {
    setCharges(charges.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter an expense title');
      return;
    }
    if (!preview) {
      setErrorMsg('Please complete valid items before saving');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const validItems = items.map(it => ({
        name: it.name,
        unitPrice: toPaise(it.unitPriceStr),
        quantity: Number(it.quantity),
        assignees: it.assignees,
      }));

      const validCharges = charges.map(c => ({
        kind: c.kind,
        label: c.label || undefined,
        amount: toPaise(c.amountStr),
        direction: c.direction || 'add',
      }));

      const receiptTotalPaise = receiptTotalStr.trim() ? toPaise(receiptTotalStr) : undefined;

      await api.post(`/trips/${tripId}/expenses`, {
        title: title.trim(),
        expense_date: expenseDate,
        category,
        paid_by_type: payerType,
        paid_by_id: Number(payerId),
        accounting_mode: 'individual',
        split_method: 'itemized',
        receipt_total_paise: receiptTotalPaise,
        items: validItems,
        charges: validCharges,
      });

      onExpenseSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Participant lookup map
  const pMap = new Map(participants.map(p => [`p:${p.id}`, p.display_name]));

  return (
    <div className="glass-panel-elevated p-4 sm:p-6" style={{ borderRadius: '16px', maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{t.itemizedBill}</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Per-item ordering, live totals, and pro-rata charges</p>
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
        {/* Bill Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">{t.expenseTitle}</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sagar Ratna Breakfast"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.expenseDate}</label>
            <input
              type="date"
              className="form-input"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.category}</label>
            <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="Food">Food / Restaurants</option>
              <option value="Stay">Stay / Accommodation</option>
              <option value="Travel">Travel / Transport</option>
              <option value="Activities">Activities / Sightseeing</option>
              <option value="Supplies">Groceries / Supplies</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t.paidBy}</label>
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

        {/* Section: Items Table */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b7e4c7' }}>{t.items}</h3>
            <button type="button" onClick={addItem} className="btn btn-secondary btn-sm">
              <Plus size={14} /> {t.addItem}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {items.map((item, idx) => {
              const unitPricePaise = toPaise(item.unitPriceStr);
              const subtotalPaise = unitPricePaise * item.quantity;

              return (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(11, 25, 20, 0.75)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t.itemName}
                        value={item.name}
                        onChange={e => {
                          const updated = [...items];
                          updated[idx].name = e.target.value;
                          setItems(updated);
                        }}
                        style={{ padding: '0.5rem 0.75rem' }}
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="Price ₹"
                        value={item.unitPriceStr}
                        onChange={e => {
                          const updated = [...items];
                          updated[idx].unitPriceStr = e.target.value;
                          setItems(updated);
                        }}
                        style={{ padding: '0.5rem 0.75rem' }}
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...items];
                          updated[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                          setItems(updated);
                        }}
                        style={{ padding: '0.5rem 0.75rem' }}
                        required
                      />
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', paddingRight: '0.5rem' }}>
                      {formatINR(subtotalPaise)}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#dc2626',
                          cursor: items.length > 1 ? 'pointer' : 'not-allowed',
                          opacity: items.length > 1 ? 0.8 : 0.25,
                          padding: '0.4rem',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Assignee selection chips for this item */}
                  <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        {t.assignees} ({item.assignees.length} selected)
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => selectAllAssignees(idx)}
                          style={{ background: 'none', border: 'none', color: '#0f172a', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {t.selectAll}
                        </button>
                        <span style={{ color: '#cbd5e1', fontSize: '0.72rem' }}>•</span>
                        <button
                          type="button"
                          onClick={() => clearAllAssignees(idx)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {t.selectNone}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {participants.map(p => {
                        const key = `p:${p.id}`;
                        const isSelected = item.assignees.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleAssignee(idx, key)}
                            style={{
                              padding: '0.25rem 0.65rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                              background: isSelected ? '#0f172a' : '#f8fafc',
                              color: isSelected ? '#ffffff' : '#64748b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {isSelected && <Check size={12} />}
                            {p.display_name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Charges, Taxes, Discounts */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#b7e4c7' }}>{t.chargesAndDiscounts}</h3>
            <button type="button" onClick={addCharge} className="btn btn-secondary btn-sm">
              <Plus size={14} /> {t.addCharge}
            </button>
          </div>

          {charges.map((charge, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 2fr 1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.5rem',
                background: 'rgba(11, 25, 20, 0.5)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
              }}
            >
              <select
                className="form-select"
                value={charge.kind}
                onChange={e => {
                  const updated = [...charges];
                  updated[idx].kind = e.target.value as any;
                  setCharges(updated);
                }}
                style={{ padding: '0.45rem' }}
              >
                <option value="tax">{t.tax}</option>
                <option value="service">{t.serviceCharge}</option>
                <option value="tip">{t.tip}</option>
                <option value="discount">{t.discount}</option>
                <option value="adjustment">{t.adjustment}</option>
              </select>

              <input
                type="text"
                className="form-input"
                placeholder="Label (e.g. 5% GST)"
                value={charge.label}
                onChange={e => {
                  const updated = [...charges];
                  updated[idx].label = e.target.value;
                  setCharges(updated);
                }}
                style={{ padding: '0.45rem' }}
              />

              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="₹ Amount"
                value={charge.amountStr}
                onChange={e => {
                  const updated = [...charges];
                  updated[idx].amountStr = e.target.value;
                  setCharges(updated);
                }}
                style={{ padding: '0.45rem' }}
              />

              <button
                type="button"
                onClick={() => removeCharge(idx)}
                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.4rem' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Section: Optional Receipt Total & Mismatch Warning */}
        <div style={{ marginBottom: '1.5rem', background: 'rgba(11, 25, 20, 0.6)', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">{t.receiptTotal}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="Enter amount printed on paper receipt (₹)"
                value={receiptTotalStr}
                onChange={e => setReceiptTotalStr(e.target.value)}
              />
            </div>
            {preview && (
              <div style={{ textAlign: 'right', minWidth: '160px' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Computed Total</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatINR(preview.totalPaise)}
                </div>
              </div>
            )}
          </div>

          {/* Warning Banner if receipt total mismatches */}
          {preview?.warnings && preview.warnings.length > 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#d97706',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>{t.receiptMismatchWarning}: </strong>
                {preview.warnings[0].message}
              </div>
            </div>
          )}
        </div>

        {/* Live Share Breakdown: Who owes what and who owes ₹0 */}
        {preview && (
          <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{t.liveBreakdown}</h4>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Payer: <strong style={{ color: '#0f172a' }}>{pMap.get(`${payerType}:${payerId}`) || 'Selected Account'}</strong> · Own share: {formatINR(preview.summary.payerOwnShare)} · Recoverable: <strong style={{ color: '#059669' }}>{formatINR(preview.summary.recoverable)}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
              {participants.map(p => {
                const key = `p:${p.id}`;
                const alloc = preview.allocations.find((a: any) => a.id === key);
                const amount = alloc ? alloc.amount : 0;
                const isPayer = payerType === 'person' && payerId === p.id;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {p.display_name} {isPayer && <span style={{ color: '#059669', fontSize: '0.7rem', fontWeight: 700 }}>(Payer)</span>}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: amount > 0 ? '#dc2626' : '#64748b' }}>
                        {amount > 0 ? t.owes : t.owesNothing}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: amount > 0 ? '#0f172a' : '#94a3b8' }}>
                      {formatINR(amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">{t.cancel}</button>
          <button type="submit" disabled={isSubmitting || !preview} className="btn btn-primary">
            {isSubmitting ? t.loading : `${t.save} (${preview ? formatINR(preview.totalPaise) : '...' })`}
          </button>
        </div>
      </form>
    </div>
  );
};
