import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { Compass, ShieldAlert, Lock, Check } from 'lucide-react';

interface Family {
  id: number;
  name: string;
}

interface Person {
  id: number;
  display_name: string;
}

interface Props {
  families: Family[];
  persons: Person[];
  onTripCreated: (tripId: number) => void;
  onClose: () => void;
}

export const TripCreationModal: React.FC<Props> = ({
  families,
  persons,
  onTripCreated,
  onClose,
}) => {
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budgetRupees, setBudgetRupees] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<number[]>(families.map(f => f.id));
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleFamily = (id: number) => {
    setSelectedFamilyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePerson = (id: number) => {
    setSelectedPersonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a trip name');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const res = await api.post('/trips', {
        name: name.trim(),
        destination: destination.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        budget: budgetRupees.trim() || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        is_private: isPrivate,
        family_ids: selectedFamilyIds,
        participant_person_ids: selectedPersonIds,
      });

      onTripCreated(res.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Compass size={24} style={{ color: '#0f172a' }} />
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>{t.createTrip}</h3>
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t.tripName}</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Goa Family Vacation"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.destination}</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Goa / Ooty / Coorg"
                value={destination}
                onChange={e => setDestination(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.budget} (₹)</label>
              <input
                type="number"
                step="1"
                min="0"
                className="form-input"
                placeholder="e.g. 50000"
                value={budgetRupees}
                onChange={e => setBudgetRupees(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description & Itinerary</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Highlights, planned spots, notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Families in Trip */}
          {families.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Participating Families</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {families.map(f => {
                  const isSelected = selectedFamilyIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFamily(f.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: isSelected ? '1px solid #0f172a' : '1px solid #e2e8f0',
                        background: isSelected ? '#0f172a' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#64748b',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {isSelected && <Check size={14} />}
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Privacy Toggle with Clear Explanation */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}>
            <input
              type="checkbox"
              id="privateTripToggle"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              style={{ marginTop: '0.25rem' }}
            />
            <div>
              <label htmlFor="privateTripToggle" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={15} style={{ color: '#f59e0b' }} />
                {t.privateTrip}
              </label>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                When marked completed, only attendees who actually came (RSVP: Coming) or trip admins can view this trip's financials and history.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">{t.cancel}</button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? t.loading : t.createTrip}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
