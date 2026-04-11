// src/pages/CustomerSettings.jsx — Customer account settings: password, preferences, security

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Bell, Shield, Trash2, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { changePassword, deleteMyAccount } from '../api/client';

export default function CustomerSettings() {
  const navigate = useNavigate();
  const { currentUser, signOut } = useApp();
  const [activeTab, setActiveTab] = useState('password');

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Preferences
  const [notifications, setNotifications] = useState({
    email_orders: true,
    email_promotions: false,
    sms_orders: true,
  });

  // Safety states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#5A5A40]" />
      </div>
    );
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
    } catch (error) {
      setPasswordMessage({ type: 'error', text: error.response?.data?.message || 'Failed to change password' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleNotificationToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-white border-b border-[#1A1A1A]/5 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <motion.button
            whileHover={{ x: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/marketplace')}
            className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[#5A5A40]" />
          </motion.button>
          <h1 className="text-xl font-bold text-[#1A1A1A]">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex gap-2 border-b border-[#1A1A1A]/10"
        >
          {[
            { id: 'password', label: 'Password', icon: Lock },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security', icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-[#5A5A40] border-[#5A5A40]'
                    : 'text-[#5A5A40]/60 border-transparent hover:text-[#5A5A40]'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Password Tab */}
        {activeTab === 'password' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-6">Change Your Password</h2>

            {passwordMessage.text && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                )}
                <p className={passwordMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}>
                  {passwordMessage.text}
                </p>
              </motion.div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Current Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-10 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-3 text-[#5A5A40]/40 hover:text-[#5A5A40]"
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                    placeholder="Enter new password"
                    className="w-full pl-10 pr-10 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-3 text-[#5A5A40]/40 hover:text-[#5A5A40]"
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-[#5A5A40]/60 mt-1">At least 8 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2">Confirm New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                    placeholder="Confirm new password"
                    className="w-full pl-10 pr-10 py-3 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-[#F5F5F0]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-3 text-[#5A5A40]/40 hover:text-[#5A5A40]"
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Button */}
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={passwordLoading}
                className="w-full mt-6 py-3 bg-gradient-to-r from-[#5A5A40] to-[#3A3A2A] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-6">Notification Preferences</h2>

            <div className="space-y-4">
              {[
                { key: 'email_orders', label: 'Email notifications for orders', desc: 'Get updates when your orders are placed and delivered' },
                { key: 'email_promotions', label: 'Promotional emails', desc: 'Receive special offers and discounts' },
                { key: 'sms_orders', label: 'SMS notifications for orders', desc: 'Get SMS alerts for order status updates' },
              ].map(pref => (
                <motion.div
                  key={pref.key}
                  whileHover={{ x: 4 }}
                  className="p-4 rounded-lg border border-[#1A1A1A]/5 hover:bg-[#F5F5F0]/50 transition-colors flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-[#1A1A1A]">{pref.label}</h3>
                    <p className="text-sm text-[#5A5A40]/60">{pref.desc}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleNotificationToggle(pref.key)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex items-center ${
                      notifications[pref.key]
                        ? 'bg-emerald-500'
                        : 'bg-[#1A1A1A]/20'
                    }`}
                  >
                    <motion.div
                      initial={false}
                      animate={{ x: notifications[pref.key] ? 24 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 bg-white rounded-full shadow-md"
                    />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-6 py-3 bg-gradient-to-r from-[#5A5A40] to-[#3A3A2A] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Save Preferences
            </motion.button>
          </motion.div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Active Sessions */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Active Sessions</h3>
              <div className="p-4 bg-[#F5F5F0] rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#1A1A1A]">This Device</p>
                  <p className="text-sm text-[#5A5A40]/60">Last active: Now</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Current</span>
              </div>
            </motion.div>

            {/* Logout */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-[#1A1A1A]/5 p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Logout</h3>
              <p className="text-sm text-[#5A5A40]/60 mb-4">Sign out from your account</p>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full px-4 py-3 border border-orange-200 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </motion.button>
            </motion.div>

            {/* Delete Account */}
            <motion.div
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-red-600 mb-4">Delete Account</h3>
              <p className="text-sm text-red-600/60 mb-4">Permanently delete your account and all associated data</p>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-3 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={18} />
                Delete Account
              </motion.button>
            </motion.div>

            {/* Confirmation Modals */}
            <AnimatePresence>
              {showLogoutConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl p-6 max-w-sm mx-4"
                  >
                    <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Logout?</h3>
                    <p className="text-[#5A5A40]/60 mb-6">Are you sure you want to logout from your account?</p>
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 px-4 py-2 border border-[#1A1A1A]/10 text-[#1A1A1A] font-semibold rounded-lg hover:bg-[#F5F5F0]"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleLogout}
                        className="flex-1 px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600"
                      >
                        Logout
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-2xl p-6 max-w-sm mx-4"
                  >
                    <h3 className="text-lg font-bold text-red-600 mb-2">Delete Account?</h3>
                    <p className="text-red-600/60 mb-6">This action cannot be undone. All your data will be permanently deleted.</p>
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-2 border border-[#1A1A1A]/10 text-[#1A1A1A] font-semibold rounded-lg hover:bg-[#F5F5F0]"
                      >
                        Cancel
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          try {
                            await deleteMyAccount();
                            signOut();
                            navigate('/login');
                          } catch (err) {
                            alert(err.response?.data?.detail || 'Failed to delete account');
                            setShowDeleteConfirm(false);
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
