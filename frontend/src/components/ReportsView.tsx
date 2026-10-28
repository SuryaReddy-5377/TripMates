import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { PieChart, TrendingUp, Wallet, Download, Users, CheckCircle2 } from 'lucide-react';

interface Props {
  tripId: number;
}

export const ReportsView: React.FC<Props> = ({ tripId }) => {
  const { t, formatINR } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/trips/${tripId}/reports`);
        setData(res);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [tripId]);

  if (loading) {
    return <div className="card-white p-6 text-center" style={{ background: '#ffffff', color: '#64748b' }}>{t.loading}</div>;
  }

  if (!data) {
    return <div className="card-white p-6 text-center" style={{ background: '#ffffff', color: '#64748b' }}>Unable to load report data.</div>;
  }

  const budget = data.budgetUtilization;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Cards: Total Spend & Budget */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="card-white p-4" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#0f172a', marginBottom: '0.5rem' }}>
            <Wallet size={20} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{t.totalSpent}</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a' }}>
            {formatINR(data.totalSpentPaise)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
            Across all non-voided trip expenses
          </div>
        </div>

        {budget && (
          <div className="card-white p-4" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: budget.isOverBudget ? '#dc2626' : '#059669', marginBottom: '0.5rem' }}>
              <TrendingUp size={20} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                {budget.isOverBudget ? t.overBudget : t.budgetRemaining}
              </span>
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: budget.isOverBudget ? '#dc2626' : '#0f172a' }}>
              {formatINR(Math.abs(budget.remainingPaise))}
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '0.65rem' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, budget.percentage)}%`,
                  background: budget.isOverBudget ? '#dc2626' : '#0f172a',
                  borderRadius: '4px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
              <span>{budget.percentage}% used</span>
              <span>Budget: {budget.budgetFormatted}</span>
            </div>
          </div>
        )}
      </div>

      {/* Spending by Category */}
      <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
          {t.categoryBreakdown}
        </h3>

        {data.byCategory.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No expenses recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {data.byCategory.map((cat: any) => (
              <div key={cat.category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{cat.category} ({cat.count} items)</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatINR(cat.totalPaise)} ({cat.percentageOfTotal}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${cat.percentageOfTotal}%`,
                      background: '#0f172a',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spending by Payer */}
      <div className="card-white p-5" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>
          Contributions by Payer
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
          {data.byPayer.map((payer: any, idx: number) => (
            <div
              key={idx}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                {payer.paid_by_type === 'family' ? 'Family Payer' : 'Individual Payer'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', margin: '0.2rem 0' }}>
                {payer.payer_name}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                {formatINR(payer.total_paise)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{payer.count} transactions</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
