import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/context';
import { api } from '../api/client';
import {
  User,
  Users,
  Shield,
  Plus,
  Trash2,
  X,
  Check,
  Edit2,
  Mail,
  Lock,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onProfileUpdated: () => void;
}

export const ProfileModal: React.FC<Props> = ({ onClose, onProfileUpdated }) => {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Family Name state
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [savingFamily, setSavingFamily] = useState(false);

  // Add Member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await api.get('/auth/profile');
      setProfile(data);
      if (data.family) {
        setFamilyNameInput(data.family.name);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveFamilyName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyNameInput.trim()) return;

    try {
      setSavingFamily(true);
      setErrorMsg(null);
      await api.post('/auth/profile/family', { name: familyNameInput.trim() });
      setSuccessMsg('Family group updated successfully!');
      setIsEditingFamilyName(false);
      loadProfile();
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update family name');
    } finally {
      setSavingFamily(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    try {
      setAddingMember(true);
      setErrorMsg(null);
      await api.post('/auth/profile/family/members', {
        display_name: memberName.trim(),
        email: memberEmail.trim() || undefined,
        password: memberPassword || undefined,
      });
      setSuccessMsg(`Added ${memberName} to your family!`);
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      setShowAddMember(false);
      loadProfile();
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add family member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (personId: number, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your family?`)) return;

    try {
      setErrorMsg(null);
      await api.delete(`/auth/profile/family/members/${personId}`);
      setSuccessMsg(`Removed ${name} from family.`);
      loadProfile();
      onProfileUpdated();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member');
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="card-white"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: '20px',
          padding: '2rem',
          margin: 'auto',
          position: 'relative',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <User size={15} /> {t.yourAccountAndFamily}
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0 0 0', fontFamily: 'var(--font-display)' }}>
              {t.memberProfile}
            </h2>
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
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>{t.loading}</div>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* User Personal Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                }}>
                  {profile.person?.display_name?.slice(0, 2).toUpperCase() || profile.user.email.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {profile.person?.display_name || profile.user.email}
                    </h3>
                    <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                      {profile.user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {profile.user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Family Unit Section */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HeartHandshake size={20} style={{ color: '#0f172a' }} />
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {profile.family ? profile.family.name : t.yourFamilyGroup}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {profile.familyMembers?.length ? `${t.familyOfCount} ${profile.familyMembers.length}` : t.manageFamilyMembers}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingFamilyName(!isEditingFamilyName)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                >
                  <Edit2 size={13} /> {isEditingFamilyName ? t.cancel : t.rename}
                </button>
              </div>

              {/* Rename / Create Family Form */}
              {isEditingFamilyName && (
                <form onSubmit={handleSaveFamilyName} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <input
                    type="text"
                    value={familyNameInput}
                    onChange={(e) => setFamilyNameInput(e.target.value)}
                    placeholder="e.g. Reddy Family"
                    className="form-input"
                    style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    required
                  />
                  <button type="submit" disabled={savingFamily} className="btn btn-primary btn-sm">
                    {savingFamily ? t.loading : t.save}
                  </button>
                </form>
              )}

              {/* Members List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
                {profile.familyMembers?.map((m: any) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: m.is_current_user ? '#f0fdf4' : '#f8fafc',
                      border: m.is_current_user ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: m.is_current_user ? '#15803d' : '#e2e8f0',
                        color: m.is_current_user ? '#ffffff' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}>
                        {m.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                          {m.display_name} {m.is_current_user && <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>({t.you})</span>}
                        </div>
                        {m.email && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.email}</div>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {m.is_family_admin === 1 && (
                        <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>{t.adminBadge}</span>
                      )}
                      {!m.is_current_user && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.id, m.display_name)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem' }}
                          title={t.delete}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Member Toggle / Form */}
              {!showAddMember ? (
                <button
                  type="button"
                  onClick={() => setShowAddMember(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.55rem', fontSize: '0.82rem' }}
                >
                  <Plus size={15} /> {t.addFamilyMemberBtn}
                </button>
              ) : (
                <form
                  onSubmit={handleAddMember}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    {t.addMemberToFamily}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      {t.nameLabel} *
                    </label>
                    <input
                      type="text"
                      placeholder={t.namePlaceholder}
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                      {t.emailOptional}
                    </label>
                    <input
                      type="email"
                      placeholder="member@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      className="form-input"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  {memberEmail && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        {t.password} *
                      </label>
                      <input
                        type="password"
                        placeholder={t.createPasswordPlaceholder}
                        value={memberPassword}
                        onChange={(e) => setMemberPassword(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        required={!!memberEmail}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowAddMember(false)}
                      className="btn btn-secondary btn-sm"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={addingMember || !memberName.trim()}
                      className="btn btn-primary btn-sm"
                    >
                      {addingMember ? t.adding : t.addMember}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

