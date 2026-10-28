import React from 'react';
import { MapPinned } from 'lucide-react';

export const NatureLogo: React.FC<{ size?: number; className?: string }> = ({ size = 36, className = '' }) => (
  <span
    className={className}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '12px',
      background: '#0f172a',
      color: '#ffffff',
      boxShadow: 'var(--shadow-sm)',
    }}
  >
    <MapPinned size={size * 0.58} />
  </span>
);

export const PineForestBanner: React.FC<{ title?: string; subtitle?: string; height?: number; bgImage?: string }> = ({
  title,
  subtitle,
  height = 200,
  bgImage = '/images/photo-family-beach.jpg',
}) => (
  <div style={{
    position: 'relative',
    height,
    width: '100%',
    overflow: 'hidden',
    borderRadius: '18px',
    backgroundImage: `url(${bgImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 40%',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-subtle)',
  }}>
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(to right, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.6) 55%, rgba(15, 23, 42, 0.25) 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '1.75rem 2.25rem',
    }}>
      {title && (
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.9rem',
          color: '#ffffff',
          fontWeight: 700,
          marginBottom: '0.4rem',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h2>
      )}
      {subtitle && (
        <p style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '0.98rem',
          maxWidth: '620px',
          fontWeight: 500,
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

export const CoastalMountainBanner: React.FC<{ title?: string; subtitle?: string; height?: number }> = ({
  title,
  subtitle,
  height = 180,
}) => (
  <PineForestBanner
    title={title}
    subtitle={subtitle}
    height={height}
    bgImage="/images/trip-kerala.jpg"
  />
);

export const MountainResortBanner: React.FC<{ title?: string; subtitle?: string; height?: number }> = ({
  title,
  subtitle,
  height = 180,
}) => (
  <PineForestBanner
    title={title}
    subtitle={subtitle}
    height={height}
    bgImage="/images/photo-family-beach.jpg"
  />
);
