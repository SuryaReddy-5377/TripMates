import React, { useState } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  Lightbulb,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Rocket,
  MessageSquare,
  Bug,
  HelpCircle,
} from 'lucide-react';

interface Props {
  user: any;
  person?: any;
  onClose: () => void;
}

export const SuggestionModal: React.FC<Props> = ({ user, person, onClose }) => {
  const { t } = useI18n();

  const [category, setCategory] = useState<'feature' | 'improvement' | 'feedback' | 'bug' | 'other'>('feature');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const categories: Array<{ id: 'feature' | 'improvement' | 'feedback' | 'bug' | 'other'; label: string; icon: any }> = [
    { id: 'feature', label: t.categoryFeature, icon: Sparkles },
    { id: 'improvement', label: t.categoryImprovement, icon: Rocket },
    { id: 'feedback', label: t.categoryFeedback, icon: MessageSquare },
    { id: 'bug', label: t.categoryBug, icon: Bug },
    { id: 'other', label: t.categoryOther, icon: HelpCircle },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a title for your suggestion.');
      return;
    }
    if (message.trim().length < 3) {
      setErrorMsg('Please enter more details (at least 3 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.post('/suggestions', {
        title: title.trim(),
        message: message.trim(),
        category,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit suggestion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setMessage('');
    setCategory('feature');
    setIsSuccess(false);
    setErrorMsg(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="card-white"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '2rem',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
              color: '#854d0e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(250, 204, 21, 0.25)',
            }}>
              <Lightbulb size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                {t.sendSuggestion}
              </h2>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {t.suggestionFeatureDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '9999px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              {t.suggestionSuccessTitle}
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.55, maxWidth: '440px', margin: '0 auto 1.75rem auto' }}>
              {t.suggestionSuccessMessage}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                style={{ padding: '0.55rem 1.15rem', borderRadius: '10px' }}
              >
                {t.sendAnotherSuggestion}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
                style={{ padding: '0.55rem 1.35rem', borderRadius: '10px' }}
              >
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Sender badge info */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.65rem 0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
            }}>
              <span style={{ color: '#64748b' }}>
                {t.suggestionSender}: <strong style={{ color: '#0f172a' }}>{person?.display_name || user?.email?.split('@')[0]}</strong>
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {user?.email}
              </span>
            </div>

            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.75rem',
                color: '#b91c1c',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Category selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                {t.suggestionCategory}
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {categories.map(c => {
                  const Icon = c.icon;
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '9999px',
                        border: isSelected ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                        background: isSelected ? '#0f172a' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#475569',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={14} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                {t.suggestionTitle} *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={t.suggestionTitlePlaceholder}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={200}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Message field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                {t.suggestionMessage} *
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder={t.suggestionMessagePlaceholder}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={5000}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: '100px',
                  lineHeight: 1.5,
                  fontSize: '0.85rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {message.length} / 5000
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '10px' }}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting || !title.trim() || !message.trim()}
                style={{
                  padding: '0.6rem 1.35rem',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Send size={16} />
                <span>{isSubmitting ? t.submittingSuggestion : t.submitSuggestion}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

