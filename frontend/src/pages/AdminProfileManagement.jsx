// src/pages/AdminProfileManagement.jsx - Admin user profile management

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Edit3, Trash2, Eye, Loader2, CheckCircle2, X, Plus } from 'lucide-react';
import { listUsers, changeRole, deleteUser } from '../api/client';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../hooks/useTranslation';

export default function AdminProfileManagement() {
  const { t } = useTranslation();
  const { currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setFilteredUsers(users.filter(u =>
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await listUsers();
      setUsers(response.data || []);
    } catch {
      setToast('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditing(user.id);
    setForm(user);
  };

  const handleSave = async () => {
    try {
      await changeRole(editing, form.role);
      setUsers(users.map(u => u.id === editing ? { ...u, role: form.role } : u));
      setToast('User role updated');
      setEditing(null);
    } catch {
      setToast('Update failed');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setToast('User deleted');
    } catch {
      setToast('Delete failed');
    }
  };

  if (!currentUser?.role === 'admin') return <div className="p-8 text-red-600">Access denied</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 sm:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-3xl font-bold">{t('admin.userManagement')}</h1>
          <button className="px-4 py-2 bg-[#5A5A40] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-[#4A4A30] transition-colors">
            <Plus size={16} />Add User
          </button>
        </div>

        {toast && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-200 text-sm text-green-700 font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />{toast}
          </motion.div>
        )}

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-3 text-[#5A5A40]/40" size={18} />
          <input
            type="text"
            placeholder={t('admin.searchUsers')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] bg-white"
          />
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#1A1A1A]/5 overflow-hidden shadow-sm">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-[#1A1A1A]/50">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5F5F0] border-b border-[#1A1A1A]/5">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[#1A1A1A]/60">Name</th>
                      <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[#1A1A1A]/60">Email</th>
                      <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[#1A1A1A]/60">Business</th>
                      <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[#1A1A1A]/60">Role</th>
                      <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-[#1A1A1A]/60">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, idx) => (
                      <tr key={user.id} className={`border-b border-[#1A1A1A]/5 ${idx % 2 ? 'bg-[#F5F5F0]/30' : ''}`}>
                        <td className="px-6 py-4 font-semibold text-[#1A1A1A]">{user.display_name}</td>
                        <td className="px-6 py-4 text-[#1A1A1A]/60">{user.email}</td>
                        <td className="px-6 py-4 text-[#1A1A1A]/60">{user.shop_name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setViewing(user)} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
                              <Eye size={16} className="text-[#5A5A40]" />
                            </button>
                            <button onClick={() => handleEdit(user)} className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors">
                              <Edit3 size={16} className="text-[#5A5A40]" />
                            </button>
                            <button onClick={() => handleDelete(user.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={16} className="text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif text-2xl font-bold">Edit User</h2>
                <button onClick={() => setEditing(null)} className="p-2 hover:bg-[#F5F5F0] rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Name</label>
                  <input
                    type="text"
                    value={form.display_name || ''}
                    onChange={(e) => setForm({...form, display_name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Role</label>
                  <select
                    value={form.role || 'customer'}
                    onChange={(e) => setForm({...form, role: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40]"
                  >
                    <option value="customer">Customer</option>
                    <option value="owner">Shop Owner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 px-4 py-2 border border-[#1A1A1A]/10 rounded-xl font-bold hover:bg-[#F5F5F0] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* View Modal */}
        {viewing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-serif text-2xl font-bold">User Details</h2>
                <button onClick={() => setViewing(null)} className="p-2 hover:bg-[#F5F5F0] rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#1A1A1A]/50 mb-1">Name</label>
                  <p className="text-[#1A1A1A]">{viewing.display_name}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#1A1A1A]/50 mb-1">Email</label>
                  <p className="text-[#1A1A1A]">{viewing.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#1A1A1A]/50 mb-1">Role</label>
                  <p className="text-[#1A1A1A]">{viewing.role}</p>
                </div>
                {viewing.shop_name && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#1A1A1A]/50 mb-1">Business</label>
                    <p className="text-[#1A1A1A]">{viewing.shop_name}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setViewing(null)}
                className="w-full px-4 py-2 bg-[#5A5A40] text-white rounded-xl font-bold hover:bg-[#4A4A30] transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
