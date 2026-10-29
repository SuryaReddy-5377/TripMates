import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  Compass,
  MapPin,
  Calendar,
  Wallet,
  ImageIcon,
  Users,
  Check,
  Lock,
  Search,
  Sparkles,
  AlertCircle,
  X,
  HeartHandshake,
} from 'lucide-react';

interface Family {
  id: number;
  name: string;
}

interface Person {
  id: number;
  display_name: string;
  family_id?: number | null;
  family_name?: string | null;
  email?: string | null;
}

interface Props {
  families: Family[];
  persons: Person[];
  onTripCreated: (tripId: number) => void;
  onClose: () => void;
}

// Preset photo options from public images
const PRESET_IMAGES = [
  { label: 'Mountain Resort', url: '/images/mountain_resort.jpg' },
  { label: 'Kerala Backwaters', url: '/images/trip-kerala.jpg' },
  { label: 'Beach Vacation', url: '/images/photo-family-beach.jpg' },
  { label: 'Sea Shore', url: '/images/beach_vacation.jpg' },
  { label: 'Family Travel', url: '/images/hero_family_trip.jpg' },
];

export const TripCreationModal: React.FC<Props> = ({
  families,
  persons: initialPersons,
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
  const [coverImage, setCoverImage] = useState('/images/mountain_resort.jpg');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // All available members registered on the site
  const [availablePersons, setAvailablePersons] = useState<Person[]>(initialPersons);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<number[]>(families.map(f => f.id));
  const [memberSearch, setMemberSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch all registered persons across the system so anyone can invite any logged-in user
  useEffect(() => {
    const fetchAvailable = async () => {
      try {
        const res = await api.get('/persons/available');
        if (Array.isArray(res) && res.length > 0) {
          setAvailablePersons(res);
        }
      } catch {
        // fallback to initialPersons
      }
    };
    fetchAvailable();
  }, []);

  const togglePerson = (id: number) => {
    setSelectedPersonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllPersons = () => {
    setSelectedPersonIds(availablePersons.map(p => p.id));
  };

  const clearAllPersons = () => {
    setSelectedPersonIds([]);
  };

  const toggleFamily = (id: number) => {
    setSelectedFamilyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectPresetImage = (url: string) => {
    setCoverImage(url);
    setCustomImageUrl('');
  };

  const handleCustomImageChange = (url: string) => {
    setCustomImageUrl(url);
    if (url.trim()) {
      setCoverImage(url.trim());
    }
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
        cover_image: coverImage || undefined,
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

  const filteredPersons = availablePersons.filter(p => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      p.display_name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.family_name && p.family_name.toLowerCase().includes(q))
    );
  });

  // Group filtered persons by family
  const groupedPersons = useMemo(() => {
    const familiesMap = new Map<string, { familyId: number | null; familyName: string; members: any[] }>();
    const individualMembers: any[] = [];

    filteredPersons.forEach(person => {
      if (person.family_name) {
        const key = `fam_${person.family_id || person.family_name}`;
        if (!familiesMap.has(key)) {
          familiesMap.set(key, {
            familyId: person.family_id ?? null,
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

  const toggleFamilyGroup = (members: any[]) => {
    const memberIds = members.map(m => m.id);
    const allSelected = memberIds.every(id => selectedPersonIds.includes(id));

    if (allSelected) {
      setSelectedPersonIds(prev => prev.filter(id => !memberIds.includes(id)));
    } else {
      setSelectedPersonIds(prev => Array.from(new Set([...prev, ...memberIds])));
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div
        className="modal-content fade-up"
        style={{
          maxWidth: '760px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '2rem 1.75rem',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              <Compass size={16} /> {t.newAdventure}
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em' }}>
              {t.planNewTrip}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
              {t.planNewTripDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            color: '#dc2626',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.35rem' }}>
          {/* Main Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t.tripName} *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Manali Summer Getaway 2026"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t.destination}</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="e.g. Manali, Himachal Pradesh"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dates & Budget */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t.startDate}</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t.endDate}</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>{t.budget} (₹)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#94a3b8' }}>₹</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  style={{ paddingLeft: '2rem' }}
                  placeholder="50000"
                  value={budgetRupees}
                  onChange={e => setBudgetRupees(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Cover Image Selector */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.15rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ImageIcon size={16} color="#0f172a" /> {t.tripMainCoverImage}
              </label>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.customizableByCreator}</span>
            </div>

            {/* Live Preview Banner */}
            <div style={{
              position: 'relative',
              height: '140px',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '0.85rem',
              border: '1px solid #cbd5e1',
            }}>
              <img
                src={coverImage}
                alt="Cover preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => {
                  (e.target as any).src = '/images/mountain_resort.jpg';
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '12px',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                backdropFilter: 'blur(4px)',
              }}>
                {t.currentCoverPreview}
              </div>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                {t.chooseTravelPresets}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {PRESET_IMAGES.map(img => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => handleSelectPresetImage(img.url)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: coverImage === img.url ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                      background: coverImage === img.url ? '#0f172a' : '#ffffff',
                      color: coverImage === img.url ? '#ffffff' : '#334155',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL Input */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>
                {t.enterCustomImageUrl}
              </span>
              <input
                type="url"
                className="form-input"
                placeholder="https://images.unsplash.com/photo-... or custom photo URL"
                value={customImageUrl}
                onChange={e => handleCustomImageChange(e.target.value)}
                style={{ fontSize: '0.84rem' }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>{t.descriptionAndHighlights}</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder={t.descriptionPlaceholder}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* INVITE MEMBERS (Matching Lovable.app) */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.98rem' }}>
                  <Users size={18} color="#0f172a" />
                  {t.inviteMembers} ({selectedPersonIds.length} {t.confirm})
                </label>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                  {t.inviteMembersDesc}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={selectAllPersons}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem' }}
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={clearAllPersons}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem', color: '#dc2626' }}
                >
                  {t.selectNone}
                </button>
              </div>
            </div>

            {/* Member search bar */}
            <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={t.searchMembersPlaceholder}
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 1rem 0.55rem 2.2rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>

            {/* Family Groups & Individual Member Cards */}
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              paddingRight: '4px',
            }}>
              {groupedPersons.families.map(fam => {
                const memberIds = fam.members.map(m => m.id);
                const allSelected = memberIds.every(id => selectedPersonIds.includes(id));

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
                        onClick={() => toggleFamilyGroup(fam.members)}
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
                        {allSelected ? t.deselectFamily : t.inviteEntireFamily}
                      </button>
                    </div>

                    {/* Member Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {fam.members.map(p => {
                        const isSelected = selectedPersonIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePerson(p.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              background: isSelected ? '#ffffff' : '#f8fafc',
                              border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
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
                                fontSize: '0.78rem',
                                flexShrink: 0,
                              }}>
                                {p.display_name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}>
                                  {p.display_name}
                                </div>
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
                    {t.individualMembers} ({groupedPersons.individuals.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {groupedPersons.individuals.map(p => {
                      const isSelected = selectedPersonIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => togglePerson(p.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: isSelected ? '#ffffff' : '#f8fafc',
                            border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
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
                              fontSize: '0.78rem',
                              flexShrink: 0,
                            }}>
                              {p.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {p.display_name}
                              </div>
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
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Toggle */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}>
            <input
              type="checkbox"
              id="privateTripToggle"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              style={{ marginTop: '0.25rem', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <div>
              <label htmlFor="privateTripToggle" style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={15} style={{ color: '#f59e0b' }} />
                {t.privateTrip}
              </label>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                {t.privateTripNote}
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
              }}
            >
              <Sparkles size={16} />
              {isSubmitting ? t.loading : t.createTripAndInvite}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
