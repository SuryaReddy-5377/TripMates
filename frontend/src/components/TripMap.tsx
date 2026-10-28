import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/context';
import { MapPin } from 'lucide-react';

interface Props {
  destination: string | null;
  tripName: string;
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

export const TripMap: React.FC<Props> = ({ destination, tripName }) => {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const cleanDest = (destination || '').trim().toLowerCase();
  let coords: [number, number] = [15.2993, 74.124]; // default Goa

  for (const [key, c] of Object.entries(DESTINATION_COORDS)) {
    if (cleanDest.includes(key)) {
      coords = c;
      break;
    }
  }

  useEffect(() => {
    // Only run if window.L (Leaflet) is loaded from CDN or local module
    if (!mapContainerRef.current) return;

    const initMap = async () => {
      try {
        let L: any = (window as any).L;
        if (!L) {
          L = await import('leaflet');
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
        }

        const map = L.map(mapContainerRef.current).setView(coords, 10);
        mapInstanceRef.current = map;

        // Free OpenStreetMap tile server (respects tile usage policy with standard attribution)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map);

        L.marker(coords)
          .addTo(map)
          .bindPopup(`<b>${tripName}</b><br/>${destination || 'Destination'}`)
          .openPopup();
      } catch (err) {
        console.warn('Map initialization note:', err);
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [destination, tripName]);

  return (
    <div className="card-white p-4" style={{ borderRadius: '16px', background: '#ffffff', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
        <MapPin size={22} style={{ color: '#f59e0b' }} />
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)', margin: 0 }}>{t.destinationMap}</h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
            {destination ? destination : 'Trip Location'} · {t.noMapCoords}
          </p>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '340px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </div>
  );
};
