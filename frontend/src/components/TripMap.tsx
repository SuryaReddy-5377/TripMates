import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  MapPin,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Navigation,
  Info,
} from 'lucide-react';

interface Place {
  id: number;
  trip_id: number;
  name: string;
  latitude: number;
  longitude: number;
  order_index: number;
  notes: string | null;
  planned_date: string | null;
}

interface Props {
  tripId?: number;
  destination: string | null;
  tripName: string;
  canEditRoute?: boolean;
}

// Approximate coordinate table for common Indian family trip destinations
const DESTINATION_COORDS: Record<string, [number, number]> = {
  goa: [15.2993, 74.124],
  ooty: [11.4102, 76.695],
  manali: [32.2432, 77.1892],
  munnar: [10.0889, 77.0595],
  coorg: [12.3375, 75.8069],
  wayanad: [11.6854, 76.132],
  pondicherry: [11.9416, 79.8083],
  puducherry: [11.9416, 79.8083],
  jaipur: [26.9124, 75.7873],
  rishikesh: [30.0869, 78.2676],
  araku: [18.3273, 82.8775],
  tirupati: [13.6288, 79.4192],
  hyderabad: [17.385, 78.4867],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  vizag: [17.6868, 83.2185],
  visakhapatnam: [17.6868, 83.2185],
  kodaikanal: [10.2381, 77.4892],
  shillong: [25.5788, 91.8933],
  darjeeling: [27.041, 88.2663],
};

export const TripMap: React.FC<Props> = ({ tripId, destination, tripName, canEditRoute = false }) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineCachedTime, setOfflineCachedTime] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states for adding a place
  const [placeName, setPlaceName] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [offlineSavedToast, setOfflineSavedToast] = useState(false);

  const cleanDest = (destination || '').trim().toLowerCase();
  let defaultCoords: [number, number] = [15.2993, 74.124]; // default Goa
  for (const [key, c] of Object.entries(DESTINATION_COORDS)) {
    if (cleanDest.includes(key)) {
      defaultCoords = c;
      break;
    }
  }

  // Monitor online / offline network state
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load places from backend or fallback to localStorage
  const loadPlaces = async () => {
    if (!tripId) return;
    setLoading(true);
    setErrorMsg(null);

    // Check cached offline data first
    try {
      const cached = localStorage.getItem(`tripmates_offline_trip_${tripId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.savedAt) setOfflineCachedTime(parsed.savedAt);
        if (parsed?.places && (!navigator.onLine || places.length === 0)) {
          setPlaces(parsed.places);
        }
      }
    } catch {
      // ignore
    }

    if (navigator.onLine) {
      try {
        const res = await api.get(`/trips/${tripId}/places`);
        if (res.places) {
          setPlaces(res.places);
        }
      } catch (err: any) {
        console.warn('Could not fetch online places; using local cached version if present:', err);
        setIsOffline(true);
        const cached = localStorage.getItem(`tripmates_offline_trip_${tripId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.places) setPlaces(parsed.places);
        } else {
          setErrorMsg(err.message || 'Unable to load visiting places');
        }
      } finally {
        setLoading(false);
      }
    } else {
      setIsOffline(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, [tripId]);

  // Leaflet map initialization & markers rendering
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let isSubscribed = true;

    const renderMap = async () => {
      try {
        let L: any = (window as any).L;
        if (!L) {
          L = await import('leaflet');
        }
        if (!isSubscribed) return;

        if (!mapInstanceRef.current && mapContainerRef.current) {
          const initialCenter = places.length > 0
            ? [places[0].latitude, places[0].longitude]
            : defaultCoords;

          const map = L.map(mapContainerRef.current, {
            zoomControl: true,
            scrollWheelZoom: false,
          }).setView(initialCenter, 11);

          mapInstanceRef.current = map;

          // Free OpenStreetMap standard tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
          }).addTo(map);

          routeLayerGroupRef.current = L.layerGroup().addTo(map);
        }

        const map = mapInstanceRef.current;
        const layerGroup = routeLayerGroupRef.current;
        if (!map || !layerGroup) return;

        layerGroup.clearLayers();

        if (places.length > 0) {
          const latlngs: [number, number][] = places.map(p => [p.latitude, p.longitude]);

          // Draw dotted / connecting route polyline
          if (latlngs.length > 1) {
            L.polyline(latlngs, {
              color: '#0f172a',
              weight: 4,
              opacity: 0.8,
              dashArray: '6, 8',
            }).addTo(layerGroup);
          }

          // Add numbered pin markers
          places.forEach((p, index) => {
            const isStart = index === 0;
            const isEnd = index === places.length - 1 && places.length > 1;
            const bg = isStart ? '#059669' : isEnd ? '#dc2626' : '#0f172a';

            const customIcon = L.divIcon({
              className: 'custom-trip-marker',
              html: `
                <div style="
                  background: ${bg};
                  color: #ffffff;
                  width: 30px;
                  height: 30px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 700;
                  font-size: 13px;
                  box-shadow: 0 3px 8px rgba(0,0,0,0.35);
                  border: 2px solid #ffffff;
                ">
                  ${index + 1}
                </div>
              `,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              popupAnchor: [0, -16],
            });

            const marker = L.marker([p.latitude, p.longitude], { icon: customIcon });
            marker.bindPopup(`
              <div style="padding: 4px; font-family: sans-serif;">
                <strong style="font-size: 14px; color: #0f172a;">Stop ${index + 1}: ${p.name}</strong>
                ${p.notes ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${p.notes}</p>` : ''}
                <div style="margin-top: 6px; font-size: 10px; color: #94a3b8;">${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div>
              </div>
            `);
            marker.addTo(layerGroup);
          });

          // Fit bounds
          if (latlngs.length === 1) {
            map.setView(latlngs[0], 12);
          } else {
            const bounds = L.latLngBounds(latlngs);
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        } else {
          // No places added yet, show destination center
          const marker = L.marker(defaultCoords);
          marker.bindPopup(`<b>${tripName}</b><br/>${destination || 'Destination'}`).openPopup();
          marker.addTo(layerGroup);
          map.setView(defaultCoords, 10);
        }
      } catch (err) {
        console.warn('Map render notice:', err);
      }
    };

    renderMap();

    return () => {
      isSubscribed = false;
    };
  }, [places, defaultCoords, tripName, destination]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle adding a place
  const handleAddPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !placeName.trim()) return;

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      setErrorMsg('Please enter valid GPS coordinates (Latitude: -90 to 90, Longitude: -180 to 180).');
      return;
    }

    try {
      setIsSavingPlace(true);
      setErrorMsg(null);
      const res = await api.post(`/trips/${tripId}/places`, {
        name: placeName.trim(),
        latitude: lat,
        longitude: lng,
        notes: notes.trim() || null,
      });

      setPlaces(prev => [...prev, res]);
      setPlaceName('');
      setLatStr('');
      setLngStr('');
      setNotes('');
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add visiting place');
    } finally {
      setIsSavingPlace(false);
    }
  };

  // Handle reordering places (Move up / Move down)
  const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
    if (!tripId) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= places.length) return;

    const newOrder = [...places];
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setPlaces(newOrder);

    try {
      await api.put(`/trips/${tripId}/places/reorder`, {
        place_ids: newOrder.map(p => p.id),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update route order');
      loadPlaces();
    }
  };

  // Handle removing a place
  const handleRemovePlace = async (placeId: number) => {
    if (!tripId || !confirm('Remove this place from the trip route?')) return;
    try {
      await api.delete(`/trips/${tripId}/places/${placeId}`);
      setPlaces(prev => prev.filter(p => p.id !== placeId));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove place');
    }
  };

  // Explicit User-Controlled Offline Preparation
  const handlePrepareOffline = () => {
    if (!tripId) return;
    try {
      const payload = {
        tripId,
        tripName,
        destination,
        places,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`tripmates_offline_trip_${tripId}`, JSON.stringify(payload));
      setOfflineCachedTime(payload.savedAt);
      setOfflineSavedToast(true);
      setTimeout(() => setOfflineSavedToast(false), 4500);
    } catch (err) {
      setErrorMsg('Could not save itinerary locally: storage limit exceeded.');
    }
  };

  // Preset button: fill coordinates with destination baseline
  const fillDestinationCoords = () => {
    setLatStr(defaultCoords[0].toString());
    setLngStr(defaultCoords[1].toString());
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Header Card */}
      <div className="card-white p-4" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
            }}>
              <Navigation size={22} color="#0f172a" />
            </span>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)', margin: 0 }}>
                {t.plannedRoute || 'Planned Route & Visiting Places'}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '3px 0 0 0' }}>
                {places.length > 0
                  ? `${places.length} stops planned · ${destination || 'Destination'}`
                  : `${destination ? destination : 'Trip Location'} · ${t.noMapCoords || 'No route stops added yet'}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Offline Preparation Button */}
            <button
              type="button"
              onClick={handlePrepareOffline}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Save route, places, and itinerary to device for offline access"
            >
              <DownloadCloud size={16} />
              <span>{t.prepareOffline || 'Prepare for Offline'}</span>
            </button>

            {/* Add Place toggle (Only authorized creator or super admin) */}
            {canEditRoute && (
              <button
                type="button"
                onClick={() => setShowAddForm(prev => !prev)}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.82rem',
                  padding: '0.5rem 0.85rem',
                }}
              >
                <Plus size={16} />
                <span>{showAddForm ? t.cancel : (t.addPlace || 'Add Place')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Offline saved toast notification */}
        {offlineSavedToast && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>
              <strong>{t.offlineReady || 'Route cached for offline use.'}</strong> Full itinerary, coordinates, and stops are stored on this device.
            </span>
          </div>
        )}

        {/* Offline Banner if disconnected */}
        {isOffline && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}>
            <WifiOff size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>{t.offlineFallbackTitle || 'Offline Itinerary Mode'}</strong>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#b45309' }}>
                {t.offlineFallbackDesc || 'Internet connection unavailable. Displaying your cached itinerary, order of stops, and coordinates.'}
              </p>
            </div>
          </div>
        )}

        {/* Add Visiting Place Form */}
        {showAddForm && canEditRoute && (
          <form
            onSubmit={handleAddPlace}
            style={{
              marginTop: '1.25rem',
              padding: '1.15rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              display: 'grid',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                {t.addPlace || 'Add Visiting Place to Route'}
              </span>
              <button
                type="button"
                onClick={fillDestinationCoords}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Use {destination || 'Destination'} Coords
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>{t.placeName || 'Place Name'}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rohtang Pass or Baga Beach"
                  value={placeName}
                  onChange={e => setPlaceName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>{t.latitude || 'Latitude'}</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="e.g. 15.2993"
                  value={latStr}
                  onChange={e => setLatStr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>{t.longitude || 'Longitude'}</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="e.g. 74.1240"
                  value={lngStr}
                  onChange={e => setLngStr(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>{t.notes || 'Notes / Planned Time'}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Morning visit 9:00 AM"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="btn btn-secondary btn-sm"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isSavingPlace}
                className="btn btn-primary btn-sm"
              >
                {isSavingPlace ? t.loading : (t.save || 'Save Stop')}
              </button>
            </div>
          </form>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Map Canvas Container */}
        <div style={{ position: 'relative', marginTop: '1.25rem' }}>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '380px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              background: '#f1f5f9',
            }}
          />

          {/* Transparent licensing badge in accordance with OpenStreetMap Policy */}
          <div style={{
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.74rem',
            color: '#64748b',
          }}>
            <Info size={14} style={{ flexShrink: 0 }} />
            <span>
              {t.offlineNotice || 'Map tiles rendered via standard OpenStreetMap attribution. Offline caching preserves complete route geometry and itinerary without bulk scraping.'}
            </span>
          </div>
        </div>
      </div>

      {/* Visiting Places Itinerary & Reordering List */}
      <div className="card-white p-4" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>
              {t.visitingPlaces || 'Visiting Places & Itinerary Sequence'}
            </h4>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
              Planned stops in chronological travel order
            </p>
          </div>
          {offlineCachedTime && (
            <span style={{ fontSize: '0.74rem', color: '#059669', background: '#ecfdf5', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 600 }}>
              Cached locally
            </span>
          )}
        </div>

        {places.length === 0 ? (
          <div style={{
            padding: '2.5rem 1rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
          }}>
            <MapPin size={32} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8' }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#475569' }}>
              No visiting places added yet.
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem' }}>
              {canEditRoute
                ? 'Click "Add Place" above to plot tourist stops, beaches, viewpoints or restaurants along the route.'
                : 'The trip creator can add planned visiting places to plot the travel route.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {places.map((place, index) => {
              const isStart = index === 0;
              const isEnd = index === places.length - 1 && places.length > 1;

              return (
                <div
                  key={place.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    gap: '0.75rem',
                  }}
                >
                  {/* Sequence Number Badge + Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isStart ? '#059669' : isEnd ? '#dc2626' : '#0f172a',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      flexShrink: 0,
                    }}>
                      {index + 1}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                          {place.name}
                        </strong>
                        {isStart && (
                          <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#059669', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                            START
                          </span>
                        )}
                        {isEnd && (
                          <span style={{ fontSize: '0.7rem', background: '#fef2f2', color: '#dc2626', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                            END
                          </span>
                        )}
                      </div>

                      {place.notes && (
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {place.notes}
                        </p>
                      )}

                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Creator / Admin Controls (Reorder & Remove) */}
                  {canEditRoute && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorder(index, 'up')}
                        title={t.moveUp || 'Move Up'}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.35rem',
                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                          color: index === 0 ? '#cbd5e1' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>

                      <button
                        type="button"
                        disabled={index === places.length - 1}
                        onClick={() => handleReorder(index, 'down')}
                        title={t.moveDown || 'Move Down'}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0.35rem',
                          cursor: index === places.length - 1 ? 'not-allowed' : 'pointer',
                          color: index === places.length - 1 ? '#cbd5e1' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemovePlace(place.id)}
                        title={t.removePlace || 'Remove Place'}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '0.35rem',
                          cursor: 'pointer',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: '0.2rem',
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
