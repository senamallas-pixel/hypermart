// src/pages/UserProfileView.jsx - Read-only user profile view

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Mail, Phone, MapPin, Star, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';

const UserProfileView = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useApp();
  const { t } = useTranslation();

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      const response = await api.get(`/users/${userId}`);
      setUser(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-200">
          <AlertCircle className="text-red-600 mb-4" size={32} />
          <h2 className="font-bold text-lg text-red-600 mb-2">Profile Not Available</h2>
          <p className="text-[#1A1A1A]/60">{error || 'This user profile could not be found.'}</p>
          <a href="/#/marketplace" className="mt-6 block text-center px-4 py-2 bg-[#5A5A40] text-white rounded-xl font-bold">
            Back to Marketplace
          </a>
        </div>
      </div>
    );
  }

  const getRating = () => {
    // Calculate from reviews/ratings if available
    return user.rating || 4.5;
  };

  const reviewCount = user.review_count || 0;

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/#/marketplace" className="p-2 hover:bg-white rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-[#5A5A40]" />
          </a>
          <h1 className="font-serif text-3xl font-bold">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-8 border border-[#1A1A1A]/5 shadow-sm">
          {/* Photo and Basic Info */}
          <div className="flex flex-col sm:flex-row gap-8 mb-8 pb-8 border-b border-[#1A1A1A]/5">
            <div className="w-32 h-32 rounded-2xl overflow-hidden bg-[#F5F5F0] border-2 border-[#5A5A40]/20 flex-shrink-0">
              {user.photo_url ? (
                <img src={user.photo_url} alt={user.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5A5A40]/20">No photo</div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="font-serif text-2xl font-bold mb-2">{user.display_name}</h2>
              
              {user.role === 'owner' && (
                <div className="mb-4">
                  <h3 className="text-[#5A5A40] font-bold text-sm mb-1 flex items-center gap-2">
                    <Building2 size={14} />Business Name
                  </h3>
                  <p className="text-[#1A1A1A]">{user.shop_name}</p>
                </div>
              )}

              {/* Rating */}
              {user.role === 'owner' && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={i < Math.floor(getRating()) ? 'fill-amber-400 text-amber-400' : 'text-[#1A1A1A]/20'}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-sm">{getRating().toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
                </div>
              )}

              <p className="text-[#1A1A1A]/60 text-sm mb-4">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>

              {user.bio && (
                <p className="text-[#1A1A1A] text-sm mb-4">{user.bio}</p>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4 mb-8 pb-8 border-b border-[#1A1A1A]/5">
            <h3 className="font-bold text-lg mb-4">Contact Information</h3>
            
            {user.email && (
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-[#5A5A40]" />
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]/50 uppercase">Email</p>
                  <p className="text-[#1A1A1A]">{user.email}</p>
                </div>
              </div>
            )}

            {user.phone && (
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-[#5A5A40]" />
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]/50 uppercase">Phone</p>
                  <p className="text-[#1A1A1A]">{user.phone}</p>
                </div>
              </div>
            )}

            {user.location && (
              <div className="flex items-center gap-3">
                <MapPin size={18} className="text-[#5A5A40]" />
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]/50 uppercase">Location</p>
                  <p className="text-[#1A1A1A]">{user.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          {user.role === 'owner' && (
            <div className="mb-8 pb-8 border-b border-[#1A1A1A]/5">
              <p className="text-xs font-bold text-[#1A1A1A]/50 uppercase mb-3">Status</p>
              <div className="flex flex-wrap gap-2">
                {user.is_verified && (
                  <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">
                    ✓ Verified Seller
                  </span>
                )}
                {user.email_verified && (
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                    ✓ Email Verified
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {currentUser?.id !== userId && currentUser?.role === 'admin' && (
            <div className="flex gap-3">
              <span className="text-xs text-[#1A1A1A]/40 italic">Admin view</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfileView;
