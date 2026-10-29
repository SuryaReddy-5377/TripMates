import React from 'react';
import { useI18n } from '../i18n/context';
import { Mail, Phone, Heart, Sparkles, MapPinned, Lightbulb } from 'lucide-react';

interface Props {
  onOpenSuggestion?: () => void;
  isLoggedIn?: boolean;
}

export const Footer: React.FC<Props> = ({ onOpenSuggestion, isLoggedIn = false }) => {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        background: '#0f172a',
        color: '#f8fafc',
        borderTop: '1px solid #1e293b',
        padding: '3rem 1.5rem 2rem 1.5rem',
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        {/* Top Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '2.5rem',
            paddingBottom: '2.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.85rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
              >
                <MapPinned size={20} />
              </div>
              <span
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                  fontFamily: 'var(--font-display)',
                }}
              >
                TripMates
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '340px' }}>
              {t.footerRights}
            </p>
          </div>

          {/* Developer / Creator Contact Card */}
          <div>
            <h4
              style={{
                margin: '0 0 1rem 0',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#cbd5e1',
              }}
            >
              {t.contactDeveloper}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f1f5f9' }}>
                <span style={{ fontWeight: 800, letterSpacing: '0.02em', color: '#38bdf8' }}>SURYA REDDY</span>
                <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>Creator & Lead</span>
              </div>

              <a
                href="mailto:suryareddy5377@gmail.com"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  color: '#cbd5e1',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
              >
                <Mail size={16} style={{ color: '#38bdf8' }} />
                <span>suryareddy5377@gmail.com</span>
              </a>

              <a
                href="tel:9796143143"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  color: '#cbd5e1',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
              >
                <Phone size={16} style={{ color: '#38bdf8' }} />
                <span>+91 9796143143</span>
              </a>
            </div>
          </div>

          {/* Feedback & Suggestion CTA */}
          <div>
            <h4
              style={{
                margin: '0 0 1rem 0',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#cbd5e1',
              }}
            >
              {t.sendSuggestion}
            </h4>
            <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.55 }}>
              {t.suggestionFeatureDesc}
            </p>
            {onOpenSuggestion && (
              <button
                type="button"
                onClick={onOpenSuggestion}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
                  color: '#854d0e',
                  border: 'none',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(250, 204, 21, 0.25)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
              >
                <Lightbulb size={16} />
                <span>{t.sendSuggestion}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Bar: Copyright & Credit */}
        <div
          style={{
            paddingTop: '1.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            fontSize: '0.82rem',
            color: '#64748b',
          }}
        >
          <div>
            &copy; {currentYear} TripMates. {t.footerRights}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{t.footerCreator}</span>
            <Heart size={14} style={{ color: '#ef4444', fill: '#ef4444', display: 'inline' }} />
          </div>
        </div>
      </div>
    </footer>
  );
};

