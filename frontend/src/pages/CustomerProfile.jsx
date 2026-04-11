// src/pages/CustomerProfile.jsx — Customer profile: edit name, email, phone, photo

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Loader2, CheckCircle2, AlertCircle, User, Mail, Phone, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { updateMe, uploadFile } from '../api/client';

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useApp();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    display_name: currentUser?.display_name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    photo_url: currentUser?.photo_url || '',
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#5A5A40]" />
          <p className="mt-4 text-[#5A5A40]">Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setMessage({ type: '', text: '' });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please upload an image file' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'File size must be less than 5MB' });
      return;
    }

    setUploading(true);
    try {
      const res = await uploadFile(file);
      const url = res.data.url;
      const absoluteUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}`;
      setFormData(prev => ({ ...prev, photo_url: absoluteUrl }));
      setMessage({ type: 'success', text: 'Photo uploaded successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateMe({
        display_name: formData.display_name,
        email: formData.email,
        phone: formData.phone,
        photo_url: formData.photo_url,
      });
      setCurrentUser(res.data);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-white border-b border-[#1A1A1A]/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <motion.button
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/marketplace')}
            className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[#5A5A40]" />
          </motion.button>
          <h1 className="text-xl font-bold text-[#1A1A1A]">My Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-[#1A1A1A]/5 overflow-hidden shadow-sm"
        >
          {/* Photo Section */}
          <div className="p-6 border-b border-[#1A1A1A]/5">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#5A5A40] to-[#1A1A1A] flex items-center justify-center text-white overflow-hidden">
                  {formData.photo_url ? (
                    <img src={formData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-white/60" />
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 bg-[#5A5A40] p-2 rounded-full text-white hover:bg-[#3A3A2A] transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>

              {/* User Info */}
              <div className="text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A1A]">{formData.display_name || 'Customer'}</h2>
                <p className="text-[#5A5A40]/60 text-sm mt-1">{formData.email}</p>
                <div className="flex items-center gap-2 mt-3 text-[#5A5A40]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium">Account Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {/* Messages */}
            {message.text && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                )}
                <p className={message.type === 'success' ? 'text-emerald-700' : 'text-red-700'}>
                  {message.text}
                </p>
              </motion.div>
            )}

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Phone Number</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full pl-10 pr-4 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || uploading}
              className="w-full mt-8 py-3 bg-gradient-to-r from-[#5A5A40] to-[#3A3A2A] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
