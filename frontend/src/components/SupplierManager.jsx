import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Plus, X, Edit3, Trash2, Loader2 } from "lucide-react";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../api/client";

const EMPTY_FORM = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  gst_number: "",
};

// ---------------------------------------------------------------------------
// Supplier form modal (create / edit)
// ---------------------------------------------------------------------------
function SupplierFormModal({ open, onClose, onSubmit, initial, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setForm(initial ?? EMPTY_FORM);
  }, [initial]);

  if (!open) return null;

  const isEdit = Boolean(initial);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <motion.div
      className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-[#F5F5F0] w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-[#1A1A1A]/5 flex justify-between items-center bg-white/50">
          <h2 className="font-serif text-xl font-bold text-[#1A1A1A]">
            {isEdit ? "Edit Supplier" : "Add Supplier"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1A1A1A]/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#1A1A1A]/60" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Name (required) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                Name *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Supplier name"
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                Contact Person
              </label>
              <input
                name="contact_person"
                value={form.contact_person}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Contact person"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                Phone
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Phone number"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="Email address"
              />
            </div>

            {/* GST Number */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                GST Number
              </label>
              <input
                name="gst_number"
                value={form.gst_number}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                placeholder="GST number"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1">
                Address
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all resize-none"
                placeholder="Full address"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------
function DeleteConfirmModal({ open, onClose, onConfirm, supplier, deleting }) {
  if (!open || !supplier) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="font-serif text-xl font-bold text-[#1A1A1A]">
            Delete Supplier
          </h3>
          <p className="text-sm text-[#1A1A1A]/60">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-[#1A1A1A]">
              {supplier.name}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="px-8 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SupplierManager({ shopId }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---- Data fetching ----
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listSuppliers(shopId);
      setSuppliers(response.data);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // ---- Handlers ----
  const openCreate = () => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier({
      name: supplier.name ?? "",
      contact_person: supplier.contact_person ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      gst_number: supplier.gst_number ?? "",
      _id: supplier.id,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSupplier(null);
  };

  const handleFormSubmit = async (data) => {
    try {
      setSaving(true);
      if (editingSupplier) {
        await updateSupplier(shopId, editingSupplier._id, data);
      } else {
        await createSupplier(shopId, data);
      }
      closeForm();
      await fetchSuppliers();
    } catch (err) {
      console.error("Failed to save supplier:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteSupplier(shopId, deleteTarget.id);
      setDeleteTarget(null);
      await fetchSuppliers();
    } catch (err) {
      console.error("Failed to delete supplier:", err);
    } finally {
      setDeleting(false);
    }
  };

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold text-[#1A1A1A]">
          Suppliers
        </h1>
        <button
          onClick={openCreate}
          className="px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#5A5A40]" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-20 text-sm text-[#1A1A1A]/40">
            No suppliers yet. Click &ldquo;Add Supplier&rdquo; to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1A1A]/5">
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-left">
                  Name
                </th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-left">
                  Contact Person
                </th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-left">
                  Phone
                </th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-left">
                  GST Number
                </th>
                <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-[#F5F5F0]/30 transition-colors border-b border-[#1A1A1A]/5 last:border-b-0"
                >
                  <td className="p-6">
                    <div className="text-sm font-semibold text-[#1A1A1A]">
                      {s.name}
                    </div>
                    {s.email && (
                      <div className="text-xs text-[#1A1A1A]/40 mt-0.5">
                        {s.email}
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-sm text-[#1A1A1A]/70">
                    {s.contact_person || "\u2014"}
                  </td>
                  <td className="p-6 text-sm text-[#1A1A1A]/70">
                    {s.phone || "\u2014"}
                  </td>
                  <td className="p-6 text-sm text-[#1A1A1A]/70">
                    {s.gst_number || "\u2014"}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-2 hover:bg-[#5A5A40]/10 rounded-xl transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4 text-[#1A1A1A]/50" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <SupplierFormModal
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        initial={editingSupplier}
        saving={saving}
      />

      <DeleteConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        supplier={deleteTarget}
        deleting={deleting}
      />
    </div>
  );
}
