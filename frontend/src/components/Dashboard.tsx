import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import { PineForestBanner } from './NatureBanners';
import { TripCreationModal } from './TripCreationModal';
import {
  Compass,
  Plus,
  Calendar,
  MapPin,
  Lock,
  Wallet,
  Users,
  KeyRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  user: any;
  person: any;
  family: any;
  onSelectTrip: (tripId: number) => void;
}

export const Dashboard: React.FC<Props> = ({
  user,
  person,
  family,
  onSelectTrip,
}) => {
  const { t, formatINR } = useI18n();

  const [trips, setTrips] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joiningInvite, setJoiningInvite] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [tripsData, famsData, personsData] = await Promise.all([
        api.get('/trips'),
        api.get('/families'),
        api.get('/persons'),
      ]);
      setTrips(tripsData);
      setFamilies(famsData);
      setPersons(personsData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    try {
      setJoiningInvite(true);
      setJoinMsg(null);
      const res = await api.post('/invitations/accept', { invite_code: inviteCode.trim() });
      setJoinMsg({ text: res.message, isError: false });
      setInviteCode('');
      loadDashboardData();
      if (res.trip_id) {
        onSelectTrip(res.trip_id);
      }
    } catch (err: any) {
      setJoinMsg({ text: err.message || 'Failed to accept invitation', isError: true });
    } finally {
      setJoiningInvite(false);
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '4rem' }}>
      {/* Welcome Banner matching Lovable theme */}
      <div style={{ marginTop: '1.5rem', marginBottom: '1.75rem' }}>
        <PineForestBanner
          title={`Namaste, ${person?.display_name || user.email.split('@')[0]}!`}
          subtitle={family ? `Belonging to ${family.name} · Every trip, every photo, every rupee — together.` : 'Every trip, every photo, every rupee — together.'}
          height={180}
          bgImage="/images/photo-family-beach.jpg"
        />
      </div>

      {/* Action Bar: Create Trip & Invite Code Input */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {/* Create Trip Card */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="card-white"
          style={{
            padding: '1.25rem',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <Plus size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{t.createTrip}</h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Plan a new trip with family and friends</p>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: '#0f172a' }} />
        </div>

        {/* Join Trip via Code */}
        <div className="card-white" style={{ padding: '1.25rem', borderRadius: '16px', background: '#ffffff' }}>
          <form onSubmit={handleAcceptInvite} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter Invite Code (e.g. TRIP-789A)"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                style={{ padding: '0.65rem 0.85rem', fontSize: '0.88rem' }}
              />
            </div>
            <button
              type="submit"
              disabled={joiningInvite || !inviteCode.trim()}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap', padding: '0.65rem 1.1rem' }}
            >
              <KeyRound size={16} /> Join
            </button>
          </form>
          {joinMsg && (
            <div style={{ fontSize: '0.78rem', marginTop: '0.4rem', color: joinMsg.isError ? '#dc2626' : '#059669', fontWeight: 600 }}>
              {joinMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Trips Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <Compass size={22} style={{ color: '#0f172a' }} />
          {t.activeTrips} ({trips.length})
        </h2>
      </div>

      {loading ? (
        <div className="card-white" style={{ padding: '3rem', textAlign: 'center', fontSize: '1.1rem', color: '#64748b' }}>
          {t.loading}
        </div>
      ) : trips.length === 0 ? (
        <div className="card-white" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '16px' }}>
          <Compass size={44} style={{ color: '#0f172a', margin: '0 auto 1rem', opacity: 0.6 }} />
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.35rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: '#0f172a',
          }}>
            No trips planned yet
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
            Get started by creating your family's first trip or join an existing trip using an invitation code!
          </p>
          <button type="button" onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={16} /> {t.createTrip}
          </button>
        </div>
      ) : (
        /* Trips Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.35rem' }}>
          {trips.map(trip => (
            <div
              key={trip.id}
              onClick={() => onSelectTrip(trip.id)}
              className="card-white"
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Card Photography Banner */}
              <div style={{
                height: '140px',
                backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%), url(${
                  trip.id % 2 === 0 ? '/images/photo-family-beach.jpg' : '/images/trip-kerala.jpg'
                })`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className={`badge ${trip.status === 'completed' ? 'badge-green' : 'badge-amber'}`}>
                    {trip.status.toUpperCase()}
                  </span>
                  {trip.is_private === 1 && (
                    <span className="badge badge-amber" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Lock size={12} /> Private
                    </span>
                  )}
                </div>

                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  textShadow: '0 2px 10px rgba(0,0,0,0.6)',
                  letterSpacing: '-0.015em',
                  margin: 0,
                }}>
                  {trip.name}
                </h3>
              </div>

              {/* Card Body */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0f172a', fontSize: '0.92rem', fontWeight: 600 }}>
                    <MapPin size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span>{trip.destination || 'Unspecified location'}</span>
                  </div>

                  {(trip.start_date || trip.end_date) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#64748b', fontSize: '0.82rem' }}>
                      <Calendar size={15} style={{ flexShrink: 0 }} />
                      <span>{trip.start_date || ''} {trip.end_date ? 'to ' + trip.end_date : ''}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    {trip.expense_count} expenses · <strong style={{ color: '#0f172a' }}>{formatINR(trip.total_spent_paise)}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0f172a', fontSize: '0.85rem', fontWeight: 700 }}>
                    {t.viewDetails} →
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trip Creation Modal */}
      {showCreateModal && (
        <TripCreationModal
          families={families}
          persons={persons}
          onTripCreated={(id) => {
            setShowCreateModal(false);
            loadDashboardData();
            onSelectTrip(id);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};
