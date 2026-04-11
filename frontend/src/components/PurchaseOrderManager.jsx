// src/components/PurchaseOrderManager.jsx — Purchase-order CRUD for shop owners

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { Plus, X, Package, ClipboardList, XCircle, Loader2 } from 'lucide-react';
import { listPurchaseOrders, createPurchaseOrder, updatePOStatus } from '../api/client';

const STATUS_COLORS = {
  received:  'bg-green-100 text-green-700',
  sent:      'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  draft:     'bg-amber-100 text-amber-700',
};

export default function PurchaseOrderManager({ shopId, products, suppliers }) {
  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  const [pos, setPOs]                 = useState([]);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // poId being acted on
  const [showCreate, setShowCreate]   = useState(false);
  const [detailPO, setDetailPO]       = useState(null);

  // Create-form state
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formItems, setFormItems]           = useState([]); // [{product_id, name, price, quantity}]
  const [formNotes, setFormNotes]           = useState('');
  const [creating, setCreating]             = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */
  const getSupplierName = useCallback(
    (id) => {
      const s = suppliers.find((sup) => sup.id === id);
      return s ? s.name : `Supplier #${id}`;
    },
    [suppliers],
  );

  /* ------------------------------------------------------------------ */
  /*  Data fetching                                                      */
  /* ------------------------------------------------------------------ */
  const fetchPOs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listPurchaseOrders(shopId);
      setPOs(response.data);
    } catch (err) {
      console.error('Failed to load purchase orders', err);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  /* ------------------------------------------------------------------ */
  /*  Status mutations                                                   */
  /* ------------------------------------------------------------------ */
  const handleStatusChange = useCallback(
    async (poId, newStatus) => {
      try {
        setActionLoading(poId);
        await updatePOStatus(shopId, poId, newStatus);
        await fetchPOs();
      } catch (err) {
        console.error(`Failed to update PO #${poId} to ${newStatus}`, err);
      } finally {
        setActionLoading(null);
      }
    },
    [shopId, fetchPOs],
  );

  /* ------------------------------------------------------------------ */
  /*  Create PO                                                          */
  /* ------------------------------------------------------------------ */
  const openCreateModal = useCallback(() => {
    setFormSupplierId('');
    setFormItems([]);
    setFormNotes('');
    setShowCreate(true);
  }, []);

  const addItemToForm = useCallback((product) => {
    setFormItems((prev) => {
      if (prev.find((i) => i.product_id === product.id)) return prev;
      return [
        ...prev,
        { product_id: product.id, name: product.name, price: product.price, quantity: 1 },
      ];
    });
  }, []);

  const updateItemQty = useCallback((productId, quantity) => {
    setFormItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, quantity: Math.max(1, quantity) } : i)),
    );
  }, []);

  const removeItem = useCallback((productId) => {
    setFormItems((prev) => prev.filter((i) => i.product_id !== productId));
  }, []);

  const formTotal = useMemo(
    () => formItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [formItems],
  );

  const handleCreate = useCallback(async () => {
    if (!formSupplierId || formItems.length === 0) return;
    try {
      setCreating(true);
      await createPurchaseOrder(shopId, {
        supplier_id: Number(formSupplierId),
        items: formItems.map(({ product_id, name, price, quantity }) => ({
          product_id,
          name,
          price,
          quantity,
        })),
        notes: formNotes,
      });
      setShowCreate(false);
      await fetchPOs();
    } catch (err) {
      console.error('Failed to create purchase order', err);
    } finally {
      setCreating(false);
    }
  }, [shopId, formSupplierId, formItems, formNotes, fetchPOs]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-[#5A5A40]" />
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1A1A]">Purchase Orders</h2>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md"
        >
          <Plus size={18} /> Create PO
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#5A5A40]" />
        </div>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#1A1A1A]/40">
          <Package size={48} className="mb-3 opacity-40" />
          <p className="font-bold">No purchase orders yet</p>
          <p className="text-sm mt-1">Click "Create PO" to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1A1A1A]/10">
                <th className="text-left p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">PO ID</th>
                <th className="text-left p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Supplier</th>
                <th className="text-left p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Date</th>
                <th className="text-center p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Items</th>
                <th className="text-right p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</th>
                <th className="text-center p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Status</th>
                <th className="text-right p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/5">
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-[#F5F5F0]/30 transition-colors">
                  <td className="p-6 font-bold text-[#5A5A40]">#{po.id}</td>
                  <td className="p-6">{getSupplierName(po.supplier_id)}</td>
                  <td className="p-6 text-[#1A1A1A]/60">
                    {new Date(po.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="p-6 text-center">{po.items?.length ?? 0}</td>
                  <td className="p-6 text-right font-bold">{'\u20B9'}{Number(po.total_amount).toLocaleString('en-IN')}</td>
                  <td className="p-6 text-center">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[po.status] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetailPO(po)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#F5F5F0] text-[#1A1A1A]/60 hover:bg-[#5A5A40]/10 transition-all"
                      >
                        View
                      </button>
                      {po.status === 'draft' && (
                        <button
                          disabled={actionLoading === po.id}
                          onClick={() => handleStatusChange(po.id, 'sent')}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-50"
                        >
                          {actionLoading === po.id ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                        </button>
                      )}
                      {po.status === 'sent' && (
                        <button
                          disabled={actionLoading === po.id}
                          onClick={() => handleStatusChange(po.id, 'received')}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-all disabled:opacity-50"
                        >
                          {actionLoading === po.id ? <Loader2 size={14} className="animate-spin" /> : 'Receive'}
                        </button>
                      )}
                      {po.status !== 'received' && po.status !== 'cancelled' && (
                        <button
                          disabled={actionLoading === po.id}
                          onClick={() => handleStatusChange(po.id, 'cancelled')}
                          className="px-3 py-1.5 text-xs font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
                        >
                          {actionLoading === po.id ? <Loader2 size={14} className="animate-spin" /> : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Detail Modal                                                  */}
      {/* ============================================================= */}
      {detailPO && (
        <div
          className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setDetailPO(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#F5F5F0] w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-8 border-b border-[#1A1A1A]/10">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">
                  Purchase Order #{detailPO.id}
                </h3>
                <p className="text-sm text-[#1A1A1A]/50 mt-1">
                  {getSupplierName(detailPO.supplier_id)} &middot;{' '}
                  {new Date(detailPO.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[detailPO.status] || 'bg-gray-100 text-gray-600'}`}
                >
                  {detailPO.status}
                </span>
                <button
                  onClick={() => setDetailPO(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1A1A1A]/5 transition-colors"
                >
                  <X size={20} className="text-[#1A1A1A]/40" />
                </button>
              </div>
            </div>

            {/* Items table */}
            <div className="px-5 sm:px-10 py-5 sm:py-8 max-h-[60vh] overflow-y-auto">
              <div className="bg-white border border-[#1A1A1A]/10 rounded-[2.5rem] overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1A1A1A]/10">
                      <th className="text-left p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">#</th>
                      <th className="text-left p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Product</th>
                      <th className="text-center p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Qty</th>
                      <th className="text-right p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Price</th>
                      <th className="text-right p-6 text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]/5">
                    {detailPO.items?.map((item, idx) => (
                      <tr key={item.id ?? idx} className="hover:bg-[#F5F5F0]/30 transition-colors">
                        <td className="p-6 text-[#1A1A1A]/40">{idx + 1}</td>
                        <td className="p-6 font-medium">{item.name}</td>
                        <td className="p-6 text-center">{item.quantity}</td>
                        <td className="p-6 text-right text-[#1A1A1A]/60">{'\u20B9'}{Number(item.price).toLocaleString('en-IN')}</td>
                        <td className="p-6 text-right font-bold">{'\u20B9'}{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grand total */}
              <div className="p-6 bg-[#5A5A40] rounded-2xl text-white mt-6 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-widest opacity-70">Grand Total</span>
                <span className="font-serif text-2xl font-bold">
                  {'\u20B9'}{Number(detailPO.total_amount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  Create PO Modal                                               */}
      {/* ============================================================= */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#F5F5F0] w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl border border-white/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-8 border-b border-[#1A1A1A]/10">
              <h3 className="font-serif text-2xl font-bold text-[#1A1A1A]">Create Purchase Order</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#1A1A1A]/5 transition-colors"
              >
                <X size={20} className="text-[#1A1A1A]/40" />
              </button>
            </div>

            {/* Body */}
            <div className="px-10 py-8 max-h-[70vh] overflow-y-auto space-y-6">
              {/* Supplier select */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1 mb-2">
                  Supplier
                </label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1 mb-2">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any notes for this order..."
                  className="w-full px-6 py-4 bg-white border border-[#1A1A1A]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                />
              </div>

              {/* Two-column: product list | selected items */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left: product catalogue */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1 mb-2">
                    Products
                  </label>
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-2xl max-h-72 overflow-y-auto divide-y divide-[#1A1A1A]/5">
                    {products.length === 0 ? (
                      <p className="p-4 text-sm text-[#1A1A1A]/40 text-center">No products available</p>
                    ) : (
                      products.map((p) => {
                        const alreadyAdded = formItems.some((i) => i.product_id === p.id);
                        return (
                          <button
                            key={p.id}
                            disabled={alreadyAdded}
                            onClick={() => addItemToForm(p)}
                            className={`w-full flex items-center justify-between px-5 py-3 text-sm text-left transition-colors ${
                              alreadyAdded
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-[#F5F5F0]/60 cursor-pointer'
                            }`}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-[#1A1A1A]/40">{'\u20B9'}{p.price}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: selected items */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 ml-1 mb-2">
                    Selected Items
                  </label>
                  <div className="bg-white border border-[#1A1A1A]/10 rounded-2xl max-h-72 overflow-y-auto divide-y divide-[#1A1A1A]/5">
                    {formItems.length === 0 ? (
                      <p className="p-4 text-sm text-[#1A1A1A]/40 text-center">
                        Click a product to add it
                      </p>
                    ) : (
                      formItems.map((item) => (
                        <div
                          key={item.product_id}
                          className="flex items-center justify-between px-5 py-3 gap-3"
                        >
                          <span className="text-sm font-medium flex-1 truncate">{item.name}</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQty(item.product_id, parseInt(e.target.value, 10) || 1)
                            }
                            className="w-20 px-3 py-2 bg-[#F5F5F0] border border-[#1A1A1A]/10 rounded-xl text-sm text-center focus:ring-2 focus:ring-[#5A5A40] outline-none"
                          />
                          <span className="text-sm font-bold w-20 text-right">
                            {'\u20B9'}{(item.price * item.quantity).toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => removeItem(item.product_id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Total bar */}
              <div className="p-6 bg-[#5A5A40] rounded-2xl text-white flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-widest opacity-70">Total</span>
                <span className="font-serif text-2xl font-bold">
                  {'\u20B9'}{formTotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Submit */}
              <button
                disabled={creating || !formSupplierId || formItems.length === 0}
                onClick={handleCreate}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} /> Create Purchase Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
