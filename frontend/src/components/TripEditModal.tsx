import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  X,
  MapPin,
  Calendar,
  Users,
  Search,
  Check,
  ImageIcon,
  Sparkles,
  HeartHandshake,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface Props {
  trip: any;
  onClose: () => void;
  onTripUpdated: () => void;
}

const PRESET_IMAGES = [
  { label: 'Mountain Resort', url: '/images/mountain_resort.jpg' },
  { label: 'Kerala Backwaters', url: '/images/trip-kerala.jpg' },
  { label: 'Beach Vacation', url: '/images/photo-family-beach.jpg' },
  { label: 'Sea Shore', url: '/images/beach_vacation.jpg' },
  { label: 'Hero Family Trip', url: '/images/hero_family_trip.jpg' },
];

export const TripEditModal: React.FC<Props> = ({ trip, onClose, onTripUpdated }) => {
  const { t } = useI18n();

  const [name, setName] = useState(trip.name || '');
  const [destination, setDestination] = useState(trip.destination || '');
  const [startDate, setStartDate] = useState(trip.start_date || '');
  const [endDate, setEndDate] = useState(trip.end_date || '');
  const [budgetRupees, setBudgetRupees] = useState(trip.budget_paise ? String(Math.round(trip.budget_paise / 100)) : '');
  const [description, setDescription] = useState(trip.description || '');
  const [coverImage, setCoverImage] = useState(trip.cover_image || '/images/mountain_resort.jpg');
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Participants & available members
  const initialParticipantIds = useMemo(() => {
    return (trip.participants || []).map((p: any) => p.id);
  }, [trip]);

  const [availablePersons, setAvailablePersons] = useState<any[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(initialParticipantIds);
  const [memberSearch, setMemberSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoading(true);
        const data = await api.get('/persons/available');
        setAvailablePersons(data);
      } catch (err: any) {
        console.error('Failed to load available members:', err);
      } finally {
        setLoading(false);
      }
    };
    loadMembers();
  }, []);

  // Filtered persons based on search
  const filteredPersons = useMemo(() => {
    if (!memberSearch.trim()) return availablePersons;
    const q = memberSearch.toLowerCase();
    return availablePersons.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.family_name && p.family_name.toLowerCase().includes(q))
    );
  }, [availablePersons, memberSearch]);

  // Group filtered persons by family
  const groupedPersons = useMemo(() => {
    const familiesMap = new Map<string, { familyId: number | null; familyName: string; members: any[] }>();
    const individualMembers: any[] = [];

    filteredPersons.forEach(person => {
      if (person.family_name) {
        const key = `fam_${person.family_id || person.family_name}`;
        if (!familiesMap.has(key)) {
          familiesMap.set(key, {
            familyId: person.family_id,
            familyName: person.family_name,
            members: [],
          });
        }
        familiesMap.get(key)!.members.push(person);
      } else {
        individualMembers.push(person);
      }
    });

    return {
      families: Array.from(familiesMap.values()),
      individuals: individualMembers,
    };
  }, [filteredPersons]);

  const togglePerson = (personId: number) => {
    setSelectedPersonIds(prev =>
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  };

  const toggleFamily = (members: any[]) => {
    const memberIds = members.map(m => m.id);
    const allSelected = memberIds.every(id => selectedPersonIds.includes(id));

    if (allSelected) {
      // Deselect all from this family
      setSelectedPersonIds(prev => prev.filter(id => !memberIds.includes(id)));
    } else {
      // Select all from this family
      setSelectedPersonIds(prev => Array.from(new Set([...prev, ...memberIds])));
    }
  };

  const selectAll = () => {
    const allIds = filteredPersons.map(p => p.id);
    setSelectedPersonIds(prev => Array.from(new Set([...prev, ...allIds])));
  };

  const clearAll = () => {
    setSelectedPersonIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Trip name is required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const budgetVal = budgetRupees.trim() ? Number(budgetRupees) : null;
      const budgetPaise = budgetVal && !isNaN(budgetVal) && budgetVal >= 0 ? Math.round(budgetVal * 100) : null;

      await api.patch(`/trips/${trip.id}`, {
        name: name.trim(),
        destination: destination.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
        budget_paise: budgetPaise,
        cover_image: coverImage.trim() || null,
        participant_person_ids: selectedPersonIds,
      });

      onTripUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update trip');
    } finally {
      setSubmitting(false);
    }
  };

  const newlyInvitedCount = selectedPersonIds.filter(id => !initialParticipantIds.includes(id)).length;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="card-white"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '2rem',
          position: 'relative',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={15} /> Trip Settings & Members
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-display)' }}>
              Edit Trip Details
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Update trip destinations, dates, and invite missed family members or friends.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={22} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Trip Name & Destination */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Trip Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="form-input"
                placeholder="e.g. Manali Family Holiday"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Destination
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.2rem' }}
                  placeholder="e.g. Manali, Himachal Pradesh"
                />
              </div>
            </div>
          </div>

          {/* Dates & Budget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Total Budget (₹)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={budgetRupees}
                  onChange={e => setBudgetRupees(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '1.8rem' }}
                  placeholder="50000"
                />
              </div>
            </div>
          </div>

          {/* Cover Photo */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Cover Photo
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {PRESET_IMAGES.map(img => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setCoverImage(img.url)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: coverImage === img.url ? '#0f172a' : '#ffffff',
                    color: coverImage === img.url ? '#ffffff' : '#475569',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  {img.label}
                </button>
              ))}
            </div>
            <input
              type="url"
              placeholder="Or custom photo URL (https://...)"
              value={customImageUrl}
              onChange={e => {
                setCustomImageUrl(e.target.value);
                if (e.target.value.trim()) setCoverImage(e.target.value.trim());
              }}
              className="form-input"
              style={{ fontSize: '0.82rem' }}
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              Highlights & Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="form-textarea"
              placeholder="Planned activities, packing reminders, stay notes..."
            />
          </div>

          {/* MANAGE PARTICIPANTS & INVITE FORGOTTEN MEMBERS */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                  <Users size={18} color="#0f172a" />
                  Trip Participants ({selectedPersonIds.length} Selected)
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {newlyInvitedCount > 0 ? (
                    <span style={{ color: '#059669', fontWeight: 600 }}>
                      + {newlyInvitedCount} newly selected member{newlyInvitedCount > 1 ? 's' : ''} will receive an invitation!
                    </span>
                  ) : (
                    'Select individuals or entire families to join the trip and split expenses.'
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '0.25rem 0.65rem', color: '#dc2626' }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name, email, or family..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 1rem 0.5rem 2.2rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#ffffff',
                }}
              />
            </div>

            {/* Family Groups */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '4px' }}>
              {groupedPersons.families.map(fam => {
                const memberIds = fam.members.map(m => m.id);
                const allSelected = memberIds.every(id => selectedPersonIds.includes(id));
                const someSelected = memberIds.some(id => selectedPersonIds.includes(id));

                return (
                  <div
                    key={fam.familyName}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '0.85rem',
                    }}
                  >
                    {/* Family Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <HeartHandshake size={16} style={{ color: '#0f172a' }} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                          {fam.familyName}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          ({fam.members.length} member{fam.members.length > 1 ? 's' : ''})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFamily(fam.members)}
                        style={{
                          background: allSelected ? '#f1f5f9' : '#0f172a',
                          color: allSelected ? '#0f172a' : '#ffffff',
                          border: 'none',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {allSelected ? 'Deselect Family' : 'Invite Entire Family'}
                      </button>
                    </div>

                    {/* Member Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {fam.members.map(m => {
                        const isSelected = selectedPersonIds.includes(m.id);
                        const isAlreadyInTrip = initialParticipantIds.includes(m.id);

                        return (
                          <div
                            key={m.id}
                            onClick={() => togglePerson(m.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              background: isSelected ? '#f0fdf4' : '#f8fafc',
                              border: isSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: isSelected ? '#15803d' : '#e2e8f0',
                                color: isSelected ? '#ffffff' : '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}>
                                {m.display_name.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  {m.display_name}
                                </div>
                                {isAlreadyInTrip ? (
                                  <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 600 }}>Active in trip</span>
                                ) : isSelected ? (
                                  <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>Will be invited</span>
                                ) : null}
                              </div>
                            </div>

                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              border: isSelected ? '1px solid #15803d' : '1px solid #cbd5e1',
                              background: isSelected ? '#15803d' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                            }}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Individuals */}
              {groupedPersons.individuals.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.65rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                    Individual Members ({groupedPersons.individuals.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {groupedPersons.individuals.map(m => {
                      const isSelected = selectedPersonIds.includes(m.id);
                      const isAlreadyInTrip = initialParticipantIds.includes(m.id);

                      return (
                        <div
                          key={m.id}
                          onClick={() => togglePerson(m.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: isSelected ? '#f0fdf4' : '#f8fafc',
                            border: isSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: isSelected ? '#15803d' : '#e2e8f0',
                              color: isSelected ? '#ffffff' : '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                            }}>
                              {m.display_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {m.display_name}
                              </div>
                              {isAlreadyInTrip ? (
                                <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 600 }}>Active in trip</span>
                              ) : isSelected ? (
                                <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>Will be invited</span>
                              ) : null}
                            </div>
                          </div>

                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: isSelected ? '1px solid #15803d' : '1px solid #cbd5e1',
                            background: isSelected ? '#15803d' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                          }}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="btn btn-primary"
            >
              {submitting ? 'Saving Changes...' : 'Save & Send Invitations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

