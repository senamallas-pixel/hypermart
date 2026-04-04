// src/pages/OwnerProfile.jsx - Shop Owner Profile

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Edit3, Save, Camera, Mail, Phone, MapPin, Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateMe, uploadFile } from '../api/client';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';

export default function OwnerProfile() {
  const { t } = useTranslation();
  const { currentUser, signOut } = useApp();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    display_name: currentUser?.display_name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    shop_name: currentUser?.shop_name || '',
  });
  const [preview, setPreview] = useState(currentUser?.profile_photo || '');

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setToast('Only images allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { setToast('Max 5MB'); return; }
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setPreview(evt.target?.result);
      setLoading(true);
      try {
        const uploaded = await uploadFile(file);
        await updateMe({ profile_photo: uploaded.data.file_path });
        setToast('Photo updated!');
      } catch {
        setToast('Upload failed');
      } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.display_name || !form.email) { setToast('Name and email required'); return; }
    setLoading(true);
    try {
      await updateMe({
        display_name: form.display_name,
        phone: form.phone || undefined,
        shop_name: form.shop_name || undefined,
      });
      setToast('Profile updated!');
      setEditing(false);
    } catch {
      setToast('Update failed');
    } finally { setLoading(false); }
  };

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/#/owner" className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-[#5A5A40]" />
          </a>
          <h1 className="font-serif text-3xl font-bold">{t('profile.myProfile')}</h1>
        </div>

        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-200 text-sm text-green-700 font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />{toast}
          </motion.div>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-8 border border-[#1A1A1A]/5 shadow-sm">
          {/* Photo Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-[#F5F5F0] border-2 border-[#5A5A40]/20 mb-4">
              {preview ? (
                <img src={preview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20 text-sm">No photo</div>
              )}
            </div>
            <label className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40]/10 rounded-xl text-sm font-bold text-[#5A5A40] cursor-pointer hover:bg-[#5A5A40]/20 transition-colors">
              <Camera size={16} />
              {t('profile.updatePhoto')}
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={loading} />
            </label>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-[#1A1A1A]/60 mb-2 uppercase tracking-wider">{t('common.name')}</label>
              {editing ? (
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => handleChange('display_name', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] transition-colors"
                  disabled={loading}
                />
              ) : (
                <p className="px-4 py-3 rounded-2xl bg-[#F5F5F0] text-[#1A1A1A]">{form.display_name}</p>
              )}
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-bold text-[#1A1A1A]/60 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Mail size={14} />{t('common.email')}
              </label>
              <p className="px-4 py-3 rounded-2xl bg-[#F5F5F0] text-[#1A1A1A]/50 text-sm">{form.email}</p>
              <p className="text-xs text-[#1A1A1A]/30 mt-2">Contact support to change email</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-bold text-[#1A1A1A]/60 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Phone size={14} />{t('common.phone')}
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] transition-colors"
                  disabled={loading}
                />
              ) : (
                <p className="px-4 py-3 rounded-2xl bg-[#F5F5F0] text-[#1A1A1A]">{form.phone || 'Not provided'}</p>
              )}
            </div>

            {/* Shop Name */}
            <div>
              <label className="block text-sm font-bold text-[#1A1A1A]/60 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={14} />Business Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={form.shop_name}
                  onChange={(e) => handleChange('shop_name', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] transition-colors"
                  disabled={loading}
                />
              ) : (
                <p className="px-4 py-3 rounded-2xl bg-[#F5F5F0] text-[#1A1A1A]">{form.shop_name || 'Not provided'}</p>
              )}
            </div>

            {/* Status Badge */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-blue-600" />
              <div>
                <p className="text-sm font-bold text-blue-900">{t('profile.accountActive')}</p>
                <p className="text-xs text-blue-700">Role: Shop Owner</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-8 pt-8 border-t border-[#1A1A1A]/5">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} />{t('profile.editProfile')}
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex-1 px-6 py-3 border border-[#1A1A1A]/10 text-[#1A1A1A]/60 rounded-2xl font-bold uppercase tracking-wider hover:bg-[#F5F5F0] transition-colors"
                >
                  {t('common.logout')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold uppercase tracking-wider hover:bg-[#4A4A30] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {loading ? 'Saving...' : t('profile.saveChanges')}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 px-6 py-3 border border-[#1A1A1A]/10 text-[#1A1A1A]/60 rounded-2xl font-bold uppercase tracking-wider hover:bg-[#F5F5F0] transition-colors"
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
