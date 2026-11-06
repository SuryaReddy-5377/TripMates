import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/context';
import { Translations } from '../i18n/translations';
import { api } from '../api/client';
import {
  Users,
  User,
  Check,
  AlertCircle,
  ShieldAlert,
  X,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Scale,
  Edit3,
  Utensils,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface Participant {
  id: number;
  display_name: string;
  family_id: number | null;
  family_name: string | null;
  attendance?: string;
}

export interface Family {
  id: number;
  name: string;
}

interface Props {
  tripId: number;
  participants: Participant[];
  families: Family[];
  expenseToEdit?: any | null;
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
  expenseToEdit,
  onExpenseSaved,
  onCancel,
}) => {
  const { t, formatINR } = useI18n();

  const isEditing = Boolean(expenseToEdit && expenseToEdit.id);

  // Form State
  const [title, setTitle] = useState(expenseToEdit?.title || '');
  const [expenseDate, setExpenseDate] = useState(() => expenseToEdit?.expense_date || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(expenseToEdit?.category || 'Food');
  const [totalRupees, setTotalRupees] = useState(() => {
    if (expenseToEdit?.total_paise) {
      return (expenseToEdit.total_paise / 100).toString();
    }
    return '';
  });
  const [payerType, setPayerType] = useState<'person' | 'family'>(
    (expenseToEdit?.paid_by_type === 'family' || (expenseToEdit?.paid_by_type as any) === 'f') ? 'family' : 'person'
  );
  const [payerId, setPayerId] = useState<number>(expenseToEdit?.paid_by_id || participants[0]?.id || 1);

  // ONLY TWO MAIN SPLITTING OPTIONS: 'equal' | 'custom'
  const [mainOption, setMainOption] = useState<'equal' | 'custom'>(() => {
    if (expenseToEdit?.split_method === 'custom' || expenseToEdit?.split_method === 'individual_remainder') {
      return 'custom';
    }
    return 'equal';
  });

  // SUB-OPTIONS: 'per_head' | 'family_wise'
  const [subOption, setSubOption] = useState<'per_head' | 'family_wise'>(() => {
    if (expenseToEdit?.split_method === 'family_wise' || expenseToEdit?.accounting_mode === 'family') {
      return 'family_wise';
    }
    return 'per_head';
  });

  // PARTICIPANT SELECTION FOR PER-HEAD (e.g. ['p:1', 'p:2'])
  const [selectedPersonKeys, setSelectedPersonKeys] = useState<string[]>(() => {
    return participants.map(p => `p:${p.id}`);
  });

  // FAMILY SELECTION FOR FAMILY-WISE (e.g. ['f:1', 'f:2'])
  const [selectedFamilyKeys, setSelectedFamilyKeys] = useState<string[]>(() => {
    return families.map(f => `f:${f.id}`);
  });

  // FAMILY MEMBER SELECTION (familyKey -> array of person keys included, e.g. 'f:1' -> ['p:2', 'p:3'])
  const [familyMemberInclusions, setFamilyMemberInclusions] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    families.forEach(f => {
      map[`f:${f.id}`] = participants.filter(p => p.family_id === f.id).map(p => `p:${p.id}`);
    });
    return map;
  });

  // CUSTOM AMOUNTS: person amounts in ₹ (e.g. 'p:1' -> '1500')
  const [customPersonAmounts, setCustomPersonAmounts] = useState<Record<string, string>>({});

  // CUSTOM AMOUNTS: family amounts in ₹ (e.g. 'f:1' -> '3000')
  const [customFamilyAmounts, setCustomFamilyAmounts] = useState<Record<string, string>>({});

  // CUSTOM AMOUNTS: internal family member breakdown amounts in ₹ (familyKey -> (personKey -> amountStr))
  const [familyMemberCustomAmounts, setFamilyMemberCustomAmounts] = useState<Record<string, Record<string, string>>>({});

  // Optional supported remainder rule in Custom Amount -> Per Head
  const [splitRemainderEqually, setSplitRemainderEqually] = useState(false);

  // Collapsible state for families in Family-Wise mode
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    families.forEach(f => { initial[`f:${f.id}`] = true; });
    return initial;
  });

  const [preview, setPreview] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Helper to parse rupee string into integer paise safely
  const toPaise = (rupeeStr: string): number => {
    const clean = (rupeeStr || '').trim().replace(/,/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || num < 0 ? 0 : Math.round(num * 100);
  };

  const totalPaise = toPaise(totalRupees);

  // Load existing expense allocations if editing
  useEffect(() => {
    if (!expenseToEdit?.id) return;

    const loadExisting = async () => {
      try {
        setIsLoadingDetails(true);
        const data = await api.get(`/trips/${tripId}/expenses/${expenseToEdit.id}`);
        if (!data) return;

        setTitle(data.title || '');
        setExpenseDate(data.expense_date || '');
        setCategory(data.category || 'Food');
        setTotalRupees((data.total_paise / 100).toString());
        setPayerType((data.paid_by_type === 'family' || data.paid_by_type === 'f') ? 'family' : 'person');
        setPayerId(data.paid_by_id || 1);

        if (data.split_method === 'family_wise' || data.accounting_mode === 'family') {
          setSubOption('family_wise');
          const famKeys = (data.allocations || [])
            .filter((a: any) => a.account_type === 'family')
            .map((a: any) => `f:${a.account_id}`);
          if (famKeys.length > 0) {
            setSelectedFamilyKeys(famKeys);
          }

          if (data.split_method === 'custom' || (data.allocations || []).some((a: any) => a.account_type === 'family' && data.split_method === 'family_wise')) {
            const famAmts: Record<string, string> = {};
            (data.allocations || []).forEach((a: any) => {
              if (a.account_type === 'family') {
                famAmts[`f:${a.account_id}`] = (a.amount_paise / 100).toString();
              }
            });
            setCustomFamilyAmounts(famAmts);
          }

          if (data.family_breakdowns && data.family_breakdowns.length > 0) {
            const inclusions: Record<string, string[]> = {};
            const memAmts: Record<string, Record<string, string>> = {};
            data.family_breakdowns.forEach((fb: any) => {
              const fKey = `f:${fb.family_id}`;
              const pKey = `p:${fb.person_id}`;
              inclusions[fKey] = inclusions[fKey] || [];
              if (!inclusions[fKey].includes(pKey)) inclusions[fKey].push(pKey);
              memAmts[fKey] = memAmts[fKey] || {};
              memAmts[fKey][pKey] = (fb.amount_paise / 100).toString();
            });
            setFamilyMemberInclusions(prev => ({ ...prev, ...inclusions }));
            setFamilyMemberCustomAmounts(memAmts);
          }
        } else {
          setSubOption('per_head');
          const pKeys = (data.allocations || [])
            .filter((a: any) => a.account_type === 'person')
            .map((a: any) => `p:${a.account_id}`);
          if (pKeys.length > 0) {
            setSelectedPersonKeys(pKeys);
          }

          if (data.split_method === 'custom') {
            setMainOption('custom');
            const pAmts: Record<string, string> = {};
            (data.allocations || []).forEach((a: any) => {
              if (a.account_type === 'person') {
                pAmts[`p:${a.account_id}`] = (a.amount_paise / 100).toString();
              }
            });
            setCustomPersonAmounts(pAmts);
          } else if (data.split_method === 'individual_remainder') {
            setMainOption('custom');
            setSplitRemainderEqually(true);
            const pAmts: Record<string, string> = {};
            (data.allocations || []).forEach((a: any) => {
              if (a.account_type === 'person') {
                pAmts[`p:${a.account_id}`] = (a.amount_paise / 100).toString();
              }
            });
            setCustomPersonAmounts(pAmts);
          }
        }
      } catch (err) {
        console.error('Failed to load expense details for editing', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    loadExisting();
  }, [expenseToEdit?.id, tripId]);

  // Calculations for Per-Head Custom
  const personAllocatedPaise = useMemo(() => {
    return selectedPersonKeys.reduce((sum, key) => sum + toPaise(customPersonAmounts[key] || '0'), 0);
  }, [selectedPersonKeys, customPersonAmounts]);

  const personRemainingPaise = totalPaise - personAllocatedPaise;
  const isPersonOver = personAllocatedPaise > totalPaise;
  const isPersonMatched = personAllocatedPaise === totalPaise && totalPaise > 0;

  // Participants who do NOT have an explicit custom amount entered
  const zeroAmountPersonKeys = useMemo(() => {
    return selectedPersonKeys.filter(key => toPaise(customPersonAmounts[key] || '0') === 0);
  }, [selectedPersonKeys, customPersonAmounts]);

  const targetRemainderKeys = useMemo(() => {
    return (zeroAmountPersonKeys.length > 0 && zeroAmountPersonKeys.length < selectedPersonKeys.length)
      ? zeroAmountPersonKeys
      : selectedPersonKeys;
  }, [zeroAmountPersonKeys, selectedPersonKeys]);

  // Remainder per person if remainder rule is active (split strictly among remaining members with 0)
  const equalRemainderPerPersonPaise = (mainOption === 'custom' && subOption === 'per_head' && splitRemainderEqually && targetRemainderKeys.length > 0)
    ? Math.floor(Math.max(0, personRemainingPaise) / targetRemainderKeys.length)
    : 0;

  // Calculations for Family-Wise Custom
  const familyAllocatedPaise = useMemo(() => {
    return selectedFamilyKeys.reduce((sum, key) => sum + toPaise(customFamilyAmounts[key] || '0'), 0);
  }, [selectedFamilyKeys, customFamilyAmounts]);

  const familyRemainingPaise = totalPaise - familyAllocatedPaise;
  const isFamilyOver = familyAllocatedPaise > totalPaise;
  const isFamilyMatched = familyAllocatedPaise === totalPaise && totalPaise > 0;

  // Real-time Preview computation and API sync
  useEffect(() => {
    const runPreview = async () => {
      try {
        setErrorMsg(null);
        if (totalPaise <= 0) {
          setPreview(null);
          return;
        }

        const safePayerId = Number(payerId) > 0 ? Number(payerId) : (participants[0]?.id || 1);
        const safePayerType: 'person' | 'family' = (payerType === 'family' || (payerType as any) === 'f') ? 'family' : 'person';

        // 1. Equal Split -> Per Head
        if (mainOption === 'equal' && subOption === 'per_head') {
          if (selectedPersonKeys.length === 0) {
            setPreview(null);
            return;
          }
          const payload = {
            title: title.trim() || 'Expense',
            expense_date: expenseDate,
            category,
            total_paise: totalPaise,
            paid_by_type: safePayerType,
            paid_by_id: safePayerId,
            accounting_mode: 'individual',
            split_method: 'equal',
            participant_keys: selectedPersonKeys,
          };
          const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
          setPreview(res);
          return;
        }

        // 2. Equal Split -> Family-Wise
        if (mainOption === 'equal' && subOption === 'family_wise') {
          if (selectedFamilyKeys.length === 0) {
            setPreview(null);
            return;
          }

          // Build family breakdown where family amount is divided among participating members
          const familyBreakdownsPayload: Record<string, Array<{ id: string; amount?: number }>> = {};
          selectedFamilyKeys.forEach(fKey => {
            const includedMembers = familyMemberInclusions[fKey] || [];
            if (includedMembers.length > 0) {
              familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({ id: mKey }));
            }
          });

          const payload = {
            title: title.trim() || 'Expense',
            expense_date: expenseDate,
            category,
            total_paise: totalPaise,
            paid_by_type: safePayerType,
            paid_by_id: safePayerId,
            accounting_mode: 'family',
            split_method: 'family_wise',
            participant_keys: selectedFamilyKeys,
            family_breakdowns: familyBreakdownsPayload,
          };
          const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
          setPreview(res);
          return;
        }

        // 3. Custom Amount -> Per Head
        if (mainOption === 'custom' && subOption === 'per_head') {
          if (selectedPersonKeys.length === 0) {
            setPreview(null);
            return;
          }

          if (splitRemainderEqually) {
            if (isPersonOver) {
              setPreview(null);
              return;
            }
            const payload = {
              title: title.trim() || 'Expense',
              expense_date: expenseDate,
              category,
              total_paise: totalPaise,
              paid_by_type: safePayerType,
              paid_by_id: safePayerId,
              accounting_mode: 'individual',
              split_method: 'individual_remainder',
              remainder_target: 'remaining_only',
              individual_entries: selectedPersonKeys.map(k => ({
                id: k,
                individual_amount_paise: toPaise(customPersonAmounts[k] || '0'),
              })),
            };
            const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
            setPreview(res);
          } else {
            // Strict custom split
            if (!isPersonMatched) {
              setPreview(null);
              return;
            }
            const payload = {
              title: title.trim() || 'Expense',
              expense_date: expenseDate,
              category,
              total_paise: totalPaise,
              paid_by_type: safePayerType,
              paid_by_id: safePayerId,
              accounting_mode: 'individual',
              split_method: 'custom',
              custom_entries: selectedPersonKeys.map(k => ({
                id: k,
                amount_paise: toPaise(customPersonAmounts[k] || '0'),
              })),
            };
            const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
            setPreview(res);
          }
          return;
        }

        // 4. Custom Amount -> Family-Wise
        if (mainOption === 'custom' && subOption === 'family_wise') {
          if (selectedFamilyKeys.length === 0 || !isFamilyMatched) {
            setPreview(null);
            return;
          }

          const familyBreakdownsPayload: Record<string, Array<{ id: string; amount?: number }>> = {};
          selectedFamilyKeys.forEach(fKey => {
            const includedMembers = familyMemberInclusions[fKey] || [];
            if (includedMembers.length > 0) {
              const memCustom = familyMemberCustomAmounts[fKey];
              const hasCustom = memCustom && Object.values(memCustom).some(v => toPaise(v) > 0);
              if (hasCustom) {
                familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({
                  id: mKey,
                  amount: toPaise(memCustom[mKey] || '0'),
                }));
              } else {
                familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({ id: mKey }));
              }
            }
          });

          const payload = {
            title: title.trim() || 'Expense',
            expense_date: expenseDate,
            category,
            total_paise: totalPaise,
            paid_by_type: safePayerType,
            paid_by_id: safePayerId,
            accounting_mode: 'family',
            split_method: 'family_wise',
            custom_entries: selectedFamilyKeys.map(k => ({
              id: k,
              amount_paise: toPaise(customFamilyAmounts[k] || '0'),
            })),
            family_breakdowns: familyBreakdownsPayload,
          };
          const res = await api.post(`/trips/${tripId}/expenses/preview`, payload);
          setPreview(res);
          return;
        }
      } catch (err) {
        setPreview(null);
      }
    };

    const timer = setTimeout(runPreview, 250);
    return () => clearTimeout(timer);
  }, [
    totalPaise,
    mainOption,
    subOption,
    selectedPersonKeys,
    selectedFamilyKeys,
    familyMemberInclusions,
    customPersonAmounts,
    customFamilyAmounts,
    familyMemberCustomAmounts,
    splitRemainderEqually,
    isPersonMatched,
    isPersonOver,
    isFamilyMatched,
    tripId,
    title,
    expenseDate,
    category,
    payerId,
    payerType,
    participants,
  ]);

  // Toggle individual person
  const togglePerson = (key: string) => {
    setSelectedPersonKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Toggle family inclusion
  const toggleFamily = (key: string) => {
    setSelectedFamilyKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Toggle member inside a family
  const toggleFamilyMember = (fKey: string, pKey: string) => {
    setFamilyMemberInclusions(prev => {
      const current = prev[fKey] || [];
      const updated = current.includes(pKey)
        ? current.filter(k => k !== pKey)
        : [...current, pKey];
      return { ...prev, [fKey]: updated };
    });
  };

  // Select all / none helpers
  const selectAllPersons = () => {
    setSelectedPersonKeys(participants.map(p => `p:${p.id}`));
  };

  const selectNonePersons = () => {
    setSelectedPersonKeys([]);
  };

  const selectAllFamilies = () => {
    setSelectedFamilyKeys(families.map(f => `f:${f.id}`));
  };

  const selectNoneFamilies = () => {
    setSelectedFamilyKeys([]);
  };

  // Quick action: auto-fill remaining balance into the active person custom amounts
  const autoFillRemainingPerHead = () => {
    if (personRemainingPaise <= 0 || selectedPersonKeys.length === 0) return;
    const shareEach = Math.floor(personRemainingPaise / selectedPersonKeys.length);
    const updated: Record<string, string> = { ...customPersonAmounts };
    let remainderAcc = personRemainingPaise;
    selectedPersonKeys.forEach((key, idx) => {
      const currentVal = toPaise(updated[key] || '0');
      const addVal = idx === selectedPersonKeys.length - 1 ? remainderAcc : shareEach;
      remainderAcc -= addVal;
      updated[key] = ((currentVal + addVal) / 100).toFixed(2);
    });
    setCustomPersonAmounts(updated);
  };

  // Form Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg(t.enterValidTitle || 'Please enter an expense title / description');
      return;
    }

    if (totalPaise <= 0) {
      setErrorMsg(t.expenseAmountMustBePositive || 'Please enter an expense amount greater than ₹0');
      return;
    }

    if (subOption === 'per_head' && selectedPersonKeys.length === 0) {
      setErrorMsg(t.selectAtLeastOneParticipant || 'Please select at least one participating member');
      return;
    }

    if (subOption === 'family_wise' && selectedFamilyKeys.length === 0) {
      setErrorMsg('Please select at least one participating family');
      return;
    }

    if (mainOption === 'custom' && subOption === 'per_head') {
      if (splitRemainderEqually) {
        if (isPersonOver) {
          setErrorMsg(`Individual entries sum (${formatINR(personAllocatedPaise)}) exceeds bill (${formatINR(totalPaise)})`);
          return;
        }
      } else {
        if (!isPersonMatched) {
          const diff = personAllocatedPaise - totalPaise;
          setErrorMsg(
            diff > 0
              ? `Allocations exceed bill total by ${formatINR(Math.abs(diff))}. Total must equal ${formatINR(totalPaise)}.`
              : `Allocations are short by ${formatINR(Math.abs(diff))}. Total must equal ${formatINR(totalPaise)}.`
          );
          return;
        }
      }
    }

    if (mainOption === 'custom' && subOption === 'family_wise') {
      if (!isFamilyMatched) {
        const diff = familyAllocatedPaise - totalPaise;
        setErrorMsg(
          diff > 0
            ? `Family allocations exceed bill total by ${formatINR(Math.abs(diff))}. Total must equal ${formatINR(totalPaise)}.`
            : `Family allocations are short by ${formatINR(Math.abs(diff))}. Total must equal ${formatINR(totalPaise)}.`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const safePayerId = Number(payerId) > 0 ? Number(payerId) : (participants[0]?.id || 1);
      const safePayerType: 'person' | 'family' = (payerType === 'family' || (payerType as any) === 'f') ? 'family' : 'person';

      let payload: any = {
        title: title.trim(),
        expense_date: expenseDate,
        category,
        total_paise: totalPaise,
        paid_by_type: safePayerType,
        paid_by_id: safePayerId,
      };

      // 1. Equal Split -> Per Head
      if (mainOption === 'equal' && subOption === 'per_head') {
        payload.accounting_mode = 'individual';
        payload.split_method = 'equal';
        payload.participant_keys = selectedPersonKeys;
      }
      // 2. Equal Split -> Family-Wise
      else if (mainOption === 'equal' && subOption === 'family_wise') {
        payload.accounting_mode = 'family';
        payload.split_method = 'family_wise';
        payload.participant_keys = selectedFamilyKeys;

        const familyBreakdownsPayload: Record<string, Array<{ id: string; amount?: number }>> = {};
        selectedFamilyKeys.forEach(fKey => {
          const includedMembers = familyMemberInclusions[fKey] || [];
          if (includedMembers.length > 0) {
            familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({ id: mKey }));
          }
        });
        payload.family_breakdowns = familyBreakdownsPayload;
      }
      // 3. Custom Amount -> Per Head
      else if (mainOption === 'custom' && subOption === 'per_head') {
        payload.accounting_mode = 'individual';
        if (splitRemainderEqually) {
          payload.split_method = 'individual_remainder';
          payload.remainder_target = 'remaining_only';
          payload.individual_entries = selectedPersonKeys.map(k => ({
            id: k,
            individual_amount_paise: toPaise(customPersonAmounts[k] || '0'),
          }));
        } else {
          payload.split_method = 'custom';
          payload.custom_entries = selectedPersonKeys.map(k => ({
            id: k,
            amount_paise: toPaise(customPersonAmounts[k] || '0'),
          }));
        }
      }
      // 4. Custom Amount -> Family-Wise
      else if (mainOption === 'custom' && subOption === 'family_wise') {
        payload.accounting_mode = 'family';
        payload.split_method = 'family_wise';
        payload.custom_entries = selectedFamilyKeys.map(k => ({
          id: k,
          amount_paise: toPaise(customFamilyAmounts[k] || '0'),
        }));

        const familyBreakdownsPayload: Record<string, Array<{ id: string; amount?: number }>> = {};
        selectedFamilyKeys.forEach(fKey => {
          const includedMembers = familyMemberInclusions[fKey] || [];
          if (includedMembers.length > 0) {
            const memCustom = familyMemberCustomAmounts[fKey];
            const hasCustom = memCustom && Object.values(memCustom).some(v => toPaise(v) > 0);
            if (hasCustom) {
              familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({
                id: mKey,
                amount: toPaise(memCustom[mKey] || '0'),
              }));
            } else {
              familyBreakdownsPayload[fKey] = includedMembers.map(mKey => ({ id: mKey }));
            }
          }
        });
        payload.family_breakdowns = familyBreakdownsPayload;
      }

      if (isEditing) {
        await api.put(`/trips/${tripId}/expenses/${expenseToEdit.id}`, payload);
      } else {
        await api.post(`/trips/${tripId}/expenses`, payload);
      }

      onExpenseSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingDetails) {
    return (
      <div className="card-white" style={{ borderRadius: '20px', padding: '3rem', textAlign: 'center', background: '#fff' }}>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{t.loading || 'Loading expense details...'}</p>
      </div>
    );
  }

  return (
    <div
      className="card-white"
      style={{
        borderRadius: '20px',
        maxWidth: '740px',
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
            <CreditCard size={15} /> {isEditing ? t.editExpense : t.expenseEngine}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-display)' }}>
            {isEditing ? t.editExpense : t.addExpense}
          </h2>
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            {isEditing ? t.editExpenseSubtitle : t.expenseEngineSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}
          title={t.close || 'Close'}
        >
          <X size={22} />
        </button>
      </div>

      {errorMsg && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
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

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
        {/* HERO AMOUNT INPUT */}
        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
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
              autoFocus={!isEditing}
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
            value={`${payerType === 'family' || (payerType as any) === 'f' ? 'f' : 'p'}:${payerId}`}
            onChange={e => {
              const [prefix, id] = e.target.value.split(':');
              setPayerType(prefix === 'f' ? 'family' : 'person');
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

        {/* ONLY TWO MAIN SPLITTING OPTIONS */}
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {t.splitMethod}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {/* OPTION 1: EQUAL SPLIT */}
            <div
              onClick={() => setMainOption('equal')}
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: mainOption === 'equal' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                background: mainOption === 'equal' ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                boxShadow: mainOption === 'equal' ? '0 4px 12px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: mainOption === 'equal' ? '#0f172a' : '#f1f5f9',
                color: mainOption === 'equal' ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Scale size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                    1. {t.equalSplit}
                  </div>
                  {mainOption === 'equal' && (
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.35 }}>
                  {t.equalSplitDesc}
                </div>
              </div>
            </div>

            {/* OPTION 2: CUSTOM AMOUNT */}
            <div
              onClick={() => setMainOption('custom')}
              style={{
                padding: '1rem',
                borderRadius: '14px',
                border: mainOption === 'custom' ? '2px solid #0f172a' : '1px solid #e2e8f0',
                background: mainOption === 'custom' ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                boxShadow: mainOption === 'custom' ? '0 4px 12px rgba(15,23,42,0.08)' : 'none',
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: mainOption === 'custom' ? '#0f172a' : '#f1f5f9',
                color: mainOption === 'custom' ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Edit3 size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                    2. {t.customAmount}
                  </div>
                  {mainOption === 'custom' && (
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.35 }}>
                  {t.customAmountDesc}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SUB-OPTION TOGGLE: PER HEAD vs FAMILY-WISE */}
        <div style={{
          background: '#f1f5f9',
          padding: '0.35rem',
          borderRadius: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.35rem',
        }}>
          <button
            type="button"
            onClick={() => setSubOption('per_head')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '9px',
              border: 'none',
              background: subOption === 'per_head' ? '#ffffff' : 'transparent',
              color: subOption === 'per_head' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: subOption === 'per_head' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <User size={15} />
            <span>A. {t.perHeadSubOption}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubOption('family_wise')}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '9px',
              border: 'none',
              background: subOption === 'family_wise' ? '#ffffff' : 'transparent',
              color: subOption === 'family_wise' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: subOption === 'family_wise' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={15} />
            <span>B. {t.familyWiseSubOption}</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: EQUAL SPLIT -> PER HEAD                                          */}
        {/* ========================================================================= */}
        {mainOption === 'equal' && subOption === 'per_head' && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                  {t.participatingMembers} ({selectedPersonKeys.length} / {participants.length})
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.73rem', color: '#64748b' }}>
                  {category === 'Food' ? 'Select people who ate. Exclude those who did not eat (charged ₹0).' : t.perHeadEqualDesc}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={selectAllPersons}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={selectNonePersons}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', color: '#dc2626' }}
                >
                  {t.selectNone}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.55rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '2px' }}>
              {participants.map(p => {
                const key = `p:${p.id}`;
                const isSelected = selectedPersonKeys.includes(key);
                const alloc = preview?.allocations?.find((a: any) => a.id === key);
                const sharePaise = alloc ? alloc.amount : (isSelected && selectedPersonKeys.length > 0 ? Math.floor(totalPaise / selectedPersonKeys.length) : 0);

                return (
                  <div
                    key={key}
                    onClick={() => togglePerson(key)}
                    style={{
                      padding: '0.7rem 0.85rem',
                      borderRadius: '12px',
                      background: isSelected ? '#ffffff' : '#f1f5f9',
                      border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                      opacity: isSelected ? 1 : 0.65,
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', paddingTop: '0.3rem', borderTop: '1px solid #f1f5f9', fontSize: '0.72rem' }}>
                      <span style={{ color: isSelected ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                        {isSelected ? (category === 'Food' ? t.ateFood : t.includedInSplit) : (category === 'Food' ? t.didNotEat : t.excludedFromSplit)}
                      </span>
                      <strong style={{ color: isSelected ? '#0f172a' : '#94a3b8' }}>
                        {isSelected ? formatINR(sharePaise) : '₹0'}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: EQUAL SPLIT -> FAMILY-WISE                                       */}
        {/* ========================================================================= */}
        {mainOption === 'equal' && subOption === 'family_wise' && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                  {t.familyWiseSplit} ({selectedFamilyKeys.length} / {families.length} {t.familiesGroup})
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.73rem', color: '#64748b' }}>
                  {t.familyWiseEqualDesc}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={selectAllFamilies}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={selectNoneFamilies}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', color: '#dc2626' }}
                >
                  {t.selectNone}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {families.map(f => {
                const fKey = `f:${f.id}`;
                const isFamilySelected = selectedFamilyKeys.includes(fKey);
                const famMembers = participants.filter(p => p.family_id === f.id);
                const includedMemberKeys = familyMemberInclusions[fKey] || [];
                const isExpanded = Boolean(expandedFamilies[fKey]);

                // Family share in preview or calculated
                const famAlloc = preview?.allocations?.find((a: any) => a.id === fKey);
                const familySharePaise = famAlloc
                  ? famAlloc.amount
                  : (isFamilySelected && selectedFamilyKeys.length > 0 ? Math.floor(totalPaise / selectedFamilyKeys.length) : 0);

                return (
                  <div
                    key={fKey}
                    style={{
                      background: isFamilySelected ? '#ffffff' : '#f1f5f9',
                      border: isFamilySelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '0.9rem 1rem',
                      transition: 'all 0.15s ease',
                      opacity: isFamilySelected ? 1 : 0.65,
                    }}
                  >
                    {/* Family Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        onClick={() => toggleFamily(fKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: 1 }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: isFamilySelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          background: isFamilySelected ? '#0f172a' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}>
                          {isFamilySelected && <Check size={13} />}
                        </div>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                            {f.name}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: '#64748b', marginLeft: '0.5rem' }}>
                            ({includedMemberKeys.length} / {famMembers.length} {t.membersGroup})
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                            {t.familyContribution}
                          </span>
                          <strong style={{ fontSize: '0.98rem', color: isFamilySelected ? '#0f172a' : '#94a3b8' }}>
                            {isFamilySelected ? formatINR(familySharePaise) : '₹0'}
                          </strong>
                        </div>

                        {famMembers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedFamilies(prev => ({ ...prev, [fKey]: !prev[fKey] }))}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '0.3rem 0.55rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.74rem',
                              color: '#475569',
                              fontWeight: 600,
                            }}
                          >
                            <span>{isExpanded ? t.collapseFamilyMembers : t.expandFamilyMembers}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member Breakdown Inside Family */}
                    {isExpanded && isFamilySelected && famMembers.length > 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>
                          {category === 'Food' ? 'Select family members who ate (family share divides among them):' : 'Included family members:'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.45rem' }}>
                          {famMembers.map(m => {
                            const mKey = `p:${m.id}`;
                            const isMemberIncluded = includedMemberKeys.includes(mKey);
                            const memberSharePaise = (isMemberIncluded && includedMemberKeys.length > 0)
                              ? Math.floor(familySharePaise / includedMemberKeys.length)
                              : 0;

                            return (
                              <div
                                key={mKey}
                                onClick={() => toggleFamilyMember(fKey, mKey)}
                                style={{
                                  padding: '0.55rem 0.7rem',
                                  borderRadius: '8px',
                                  background: isMemberIncluded ? '#f0fdf4' : '#f8fafc',
                                  border: isMemberIncluded ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <div style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '3px',
                                    border: isMemberIncluded ? '1px solid #16a34a' : '1px solid #cbd5e1',
                                    background: isMemberIncluded ? '#16a34a' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                  }}>
                                    {isMemberIncluded && <Check size={10} />}
                                  </div>
                                  <span style={{ fontWeight: 600, color: isMemberIncluded ? '#0f172a' : '#94a3b8' }}>
                                    {m.display_name}
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: isMemberIncluded ? '#15803d' : '#94a3b8' }}>
                                  {isMemberIncluded ? formatINR(memberSharePaise) : '₹0'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: CUSTOM AMOUNT -> PER HEAD                                         */}
        {/* ========================================================================= */}
        {mainOption === 'custom' && subOption === 'per_head' && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                  {t.perHeadCustomDesc}
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.73rem', color: '#64748b' }}>
                  {t.perHeadCustomDesc}
                </p>
              </div>

              {/* Remainder distribution toggle */}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={splitRemainderEqually}
                  onChange={e => setSplitRemainderEqually(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span>{t.splitRemainderEqually}</span>
              </label>
            </div>

            {/* RUNNING TOTAL & VALIDATION STATUS BAR */}
            <div style={{
              background: isPersonMatched ? '#f0fdf4' : isPersonOver ? '#fef2f2' : '#fffbeb',
              border: isPersonMatched ? '1px solid #bbf7d0' : isPersonOver ? '1px solid #fecaca' : '1px solid #fde68a',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}>
              <div>
                <span style={{ color: '#64748b' }}>{t.runningTotal}: </span>
                <strong style={{ color: isPersonOver ? '#dc2626' : '#0f172a' }}>
                  {formatINR(personAllocatedPaise)}
                </strong>
                <span style={{ color: '#94a3b8', margin: '0 0.35rem' }}>/</span>
                <span style={{ color: '#64748b' }}>{formatINR(totalPaise)}</span>
              </div>

              <div>
                {isPersonMatched ? (
                  <span style={{ color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={15} /> {t.perfectReconciliation}
                  </span>
                ) : isPersonOver ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                    ⚠️ {t.excessAmount}: {formatINR(Math.abs(personRemainingPaise))}
                  </span>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#b45309', fontWeight: 700 }}>
                      {t.remainingBalance}: {formatINR(personRemainingPaise)}
                    </span>
                    {!splitRemainderEqually && personRemainingPaise > 0 && (
                      <button
                        type="button"
                        onClick={autoFillRemainingPerHead}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                      >
                        Auto-fill
                      </button>
                    )}
                  </div>
                )}
              </div>

              {splitRemainderEqually && selectedPersonKeys.length > 0 && personRemainingPaise > 0 && (
                <div style={{ width: '100%', fontSize: '0.75rem', color: '#059669', fontWeight: 600, borderTop: '1px dashed #bbf7d0', paddingTop: '0.35rem' }}>
                  +{formatINR(equalRemainderPerPersonPaise)} / {t.member || 'member'} {t.addedFromSharedRemainder} ({targetRemainderKeys.length} {targetRemainderKeys.length === 1 ? (t.member || 'member') : (t.members || 'members')})
                </div>
              )}
            </div>

            {/* List of participants with custom inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '2px' }}>
              {participants.map(p => {
                const key = `p:${p.id}`;
                const isSelected = selectedPersonKeys.includes(key);
                const alloc = preview?.allocations?.find((a: any) => a.id === key);
                const isTargetOfRemainder = targetRemainderKeys.includes(key);
                const finalSharePaise = alloc
                  ? alloc.amount
                  : isSelected
                    ? toPaise(customPersonAmounts[key] || '0') + (splitRemainderEqually && isTargetOfRemainder ? equalRemainderPerPersonPaise : 0)
                    : 0;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '0.75rem 0.85rem',
                      borderRadius: '12px',
                      background: isSelected ? '#ffffff' : '#f1f5f9',
                      border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      opacity: isSelected ? 1 : 0.65,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div
                        onClick={() => togglePerson(key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', minWidth: 0, flex: 1 }}
                      >
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
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.display_name}
                          </div>
                          {p.family_name && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.family_name}</div>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Owes</span>
                          <strong style={{ fontSize: '0.82rem', color: '#059669' }}>{formatINR(finalSharePaise)}</strong>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div style={{ position: 'relative', marginTop: '0.2rem' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.8rem' }}>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ padding: '0.35rem 0.5rem 0.35rem 1.4rem', fontSize: '0.82rem', fontWeight: 600 }}
                          placeholder="0.00"
                          value={customPersonAmounts[key] ?? ''}
                          onChange={e => setCustomPersonAmounts({ ...customPersonAmounts, [key]: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: CUSTOM AMOUNT -> FAMILY-WISE                                     */}
        {/* ========================================================================= */}
        {mainOption === 'custom' && subOption === 'family_wise' && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a' }}>
                  {t.familyWiseCustomDesc}
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.73rem', color: '#64748b' }}>
                  Enter each family's contribution, expand to manage member participation.
                </p>
              </div>
            </div>

            {/* RUNNING TOTAL & VALIDATION STATUS BAR */}
            <div style={{
              background: isFamilyMatched ? '#f0fdf4' : isFamilyOver ? '#fef2f2' : '#fffbeb',
              border: isFamilyMatched ? '1px solid #bbf7d0' : isFamilyOver ? '1px solid #fecaca' : '1px solid #fde68a',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}>
              <div>
                <span style={{ color: '#64748b' }}>{t.runningTotal}: </span>
                <strong style={{ color: isFamilyOver ? '#dc2626' : '#0f172a' }}>
                  {formatINR(familyAllocatedPaise)}
                </strong>
                <span style={{ color: '#94a3b8', margin: '0 0.35rem' }}>/</span>
                <span style={{ color: '#64748b' }}>{formatINR(totalPaise)}</span>
              </div>

              <div>
                {isFamilyMatched ? (
                  <span style={{ color: '#15803d', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={15} /> {t.perfectReconciliation}
                  </span>
                ) : isFamilyOver ? (
                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                    ⚠️ {t.excessAmount}: {formatINR(Math.abs(familyRemainingPaise))}
                  </span>
                ) : (
                  <span style={{ color: '#b45309', fontWeight: 700 }}>
                    {t.remainingBalance}: {formatINR(familyRemainingPaise)}
                  </span>
                )}
              </div>
            </div>

            {/* List of families with custom amount inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {families.map(f => {
                const fKey = `f:${f.id}`;
                const isFamilySelected = selectedFamilyKeys.includes(fKey);
                const famMembers = participants.filter(p => p.family_id === f.id);
                const includedMemberKeys = familyMemberInclusions[fKey] || [];
                const isExpanded = Boolean(expandedFamilies[fKey]);
                const familyPaise = toPaise(customFamilyAmounts[fKey] || '0');

                return (
                  <div
                    key={fKey}
                    style={{
                      background: isFamilySelected ? '#ffffff' : '#f1f5f9',
                      border: isFamilySelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '0.9rem 1rem',
                      opacity: isFamilySelected ? 1 : 0.65,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div
                        onClick={() => toggleFamily(fKey)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: isFamilySelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          background: isFamilySelected ? '#0f172a' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}>
                          {isFamilySelected && <Check size={13} />}
                        </div>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                            {f.name}
                          </span>
                          <span style={{ fontSize: '0.73rem', color: '#64748b', marginLeft: '0.5rem' }}>
                            ({includedMemberKeys.length} / {famMembers.length} {t.membersGroup})
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isFamilySelected && (
                          <div style={{ position: 'relative', width: '130px' }}>
                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.8rem' }}>₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input"
                              style={{ padding: '0.35rem 0.5rem 0.35rem 1.4rem', fontSize: '0.82rem', fontWeight: 700 }}
                              placeholder="0.00"
                              value={customFamilyAmounts[fKey] ?? ''}
                              onChange={e => setCustomFamilyAmounts({ ...customFamilyAmounts, [fKey]: e.target.value })}
                            />
                          </div>
                        )}

                        {famMembers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedFamilies(prev => ({ ...prev, [fKey]: !prev[fKey] }))}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '0.3rem 0.55rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.74rem',
                              color: '#475569',
                              fontWeight: 600,
                            }}
                          >
                            <span>{isExpanded ? t.collapseFamilyMembers : t.expandFamilyMembers}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member Breakdown Inside Family */}
                    {isExpanded && isFamilySelected && famMembers.length > 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 700, marginBottom: '0.5rem' }}>
                          Manage family members (exclude members who did not participate):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.45rem' }}>
                          {famMembers.map(m => {
                            const mKey = `p:${m.id}`;
                            const isMemberIncluded = includedMemberKeys.includes(mKey);
                            const memberSharePaise = (isMemberIncluded && includedMemberKeys.length > 0)
                              ? Math.floor(familyPaise / includedMemberKeys.length)
                              : 0;

                            return (
                              <div
                                key={mKey}
                                onClick={() => toggleFamilyMember(fKey, mKey)}
                                style={{
                                  padding: '0.55rem 0.7rem',
                                  borderRadius: '8px',
                                  background: isMemberIncluded ? '#f0fdf4' : '#f8fafc',
                                  border: isMemberIncluded ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <div style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '3px',
                                    border: isMemberIncluded ? '1px solid #16a34a' : '1px solid #cbd5e1',
                                    background: isMemberIncluded ? '#16a34a' : '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                  }}>
                                    {isMemberIncluded && <Check size={10} />}
                                  </div>
                                  <span style={{ fontWeight: 600, color: isMemberIncluded ? '#0f172a' : '#94a3b8' }}>
                                    {m.display_name}
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: isMemberIncluded ? '#15803d' : '#94a3b8' }}>
                                  {isMemberIncluded ? formatINR(memberSharePaise) : '₹0'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            disabled={
              isSubmitting ||
              totalPaise <= 0 ||
              !title.trim() ||
              (mainOption === 'custom' && subOption === 'per_head' && !splitRemainderEqually && !isPersonMatched) ||
              (mainOption === 'custom' && subOption === 'per_head' && splitRemainderEqually && isPersonOver) ||
              (mainOption === 'custom' && subOption === 'family_wise' && !isFamilyMatched)
            }
            className="btn btn-primary"
            style={{ minWidth: '190px', justifyContent: 'center' }}
          >
            {isSubmitting
              ? (isEditing ? t.updatingExpense : t.savingExpense)
              : isEditing
                ? `${t.updateExpenseBtn} (${totalPaise > 0 ? formatINR(totalPaise) : '₹0'})`
                : `${t.saveExpenseBtn} (${totalPaise > 0 ? formatINR(totalPaise) : '₹0'})`}
          </button>
        </div>
      </form>
    </div>
  );
};
