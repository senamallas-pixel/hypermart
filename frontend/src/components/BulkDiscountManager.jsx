import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, XCircle, Tag, Percent, AlertTriangle } from "lucide-react";
import {
  listProductDiscounts,
  createProductDiscount,
  deleteProductDiscount,
  listOrderDiscounts,
  createOrderDiscount,
  deleteOrderDiscount,
} from "../api/client";

// ── Helpers ──────────────────────────────────────────────────────────

const OFFER_TYPE_LABELS = {
  bogo: "BOGO",
  buy_x_get_y: "Buy X Get Y",
  bulk_price: "Bulk Price",
  individual: "Individual",
};

function offerDescription(d) {
  switch (d.type) {
    case "bogo":
      return "Buy 1 Get 1 Free";
    case "buy_x_get_y":
      return `Buy ${d.buy_qty} Get ${d.get_qty} Free`;
    case "bulk_price":
      return `Buy ${d.buy_qty} for ₹${d.bulk_price}`;
    case "individual":
      return d.discount_type === "percentage"
        ? `${d.discount_value}% OFF`
        : `₹${d.discount_value} OFF`;
    default:
      return "";
  }
}

function validityBadge(validTill) {
  if (!validTill) return { label: "Always Active", color: "text-green-600 bg-green-50" };
  const remaining = Math.ceil(
    (new Date(validTill) - new Date()) / (1000 * 60 * 60 * 24)
  );
  if (remaining < 0) return { label: "Expired", color: "text-red-600 bg-red-50" };
  if (remaining <= 3) return { label: `${remaining}d left`, color: "text-amber-600 bg-amber-50" };
  return { label: `${remaining}d left`, color: "text-green-600 bg-green-50" };
}

// ── Add Discount Modal ───────────────────────────────────────────────

function AddDiscountModal({ open, onClose, shopId, products, onCreated }) {
  const [segment, setSegment] = useState("product"); // "product" | "order"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Product form state
  const [productId, setProductId] = useState("");
  const [offerType, setOfferType] = useState("bogo");
  const [buyQty, setBuyQty] = useState("");
  const [getQty, setGetQty] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [validTill, setValidTill] = useState("");

  // Order form state
  const [minBillValue, setMinBillValue] = useState("");
  const [orderDiscountType, setOrderDiscountType] = useState("percentage");
  const [orderDiscountValue, setOrderDiscountValue] = useState("");
  const [orderValidTill, setOrderValidTill] = useState("");

  const quickValues = [299, 399, 499, 999];

  // Reset on open
  useEffect(() => {
    if (open) {
      setSegment("product");
      setError("");
      setProductId("");
      setOfferType("bogo");
      setBuyQty("");
      setGetQty("");
      setBulkPrice("");
      setDiscountType("percentage");
      setDiscountValue("");
      setValidTill("");
      setMinBillValue("");
      setOrderDiscountType("percentage");
      setOrderDiscountValue("");
      setOrderValidTill("");
    }
  }, [open]);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (segment === "product") {
        const selectedProduct = products.find(
          (p) => String(p.id) === String(productId)
        );
        if (!selectedProduct) {
          setError("Please select a product.");
          setSubmitting(false);
          return;
        }
        const payload = {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          type: offerType,
          buy_qty: null,
          get_qty: null,
          bulk_price: null,
          discount_value: null,
          valid_till: validTill || null,
        };
        if (offerType === "buy_x_get_y") {
          payload.buy_qty = Number(buyQty);
          payload.get_qty = Number(getQty);
        } else if (offerType === "bulk_price") {
          payload.buy_qty = Number(buyQty);
          payload.bulk_price = Number(bulkPrice);
        } else if (offerType === "individual") {
          payload.discount_type = discountType;
          payload.discount_value = Number(discountValue);
        }
        await createProductDiscount(shopId, payload);
      } else {
        if (!minBillValue) {
          setError("Please enter a minimum bill value.");
          setSubmitting(false);
          return;
        }
        await createOrderDiscount(shopId, {
          min_bill_value: Number(minBillValue),
          discount_type: orderDiscountType,
          discount_value: Number(orderDiscountValue),
          valid_till: orderValidTill || null,
        });
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white w-full max-w-xl rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors"
          >
            <X size={20} />
          </button>

          <h2 className="text-xl font-bold text-[#1A1A1A] mb-6">
            Create New Offer
          </h2>

          {/* Segment toggle */}
          <div className="flex bg-[#F5F5F0] rounded-2xl p-1 mb-6">
            {[
              { key: "product", label: "Product Specific" },
              { key: "order", label: "Bill Value Based" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSegment(s.key)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                  segment === s.key
                    ? "bg-white text-[#1A1A1A] shadow-sm"
                    : "text-[#1A1A1A]/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-xl">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {segment === "product" ? (
            <div className="space-y-4">
              {/* Product select */}
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold appearance-none"
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₹{p.mrp}
                  </option>
                ))}
              </select>

              {/* Offer type */}
              <select
                value={offerType}
                onChange={(e) => setOfferType(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold appearance-none"
              >
                <option value="bogo">Buy 1 Get 1 Free (BOGO)</option>
                <option value="buy_x_get_y">Buy X Get Y Free</option>
                <option value="bulk_price">Bulk Price</option>
                <option value="individual">Individual Discount</option>
              </select>

              {/* Conditional fields */}
              {(offerType === "buy_x_get_y" || offerType === "bulk_price") && (
                <input
                  type="number"
                  placeholder="Buy Quantity"
                  value={buyQty}
                  onChange={(e) => setBuyQty(e.target.value)}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  min="1"
                />
              )}

              {offerType === "buy_x_get_y" && (
                <input
                  type="number"
                  placeholder="Get Quantity (Free)"
                  value={getQty}
                  onChange={(e) => setGetQty(e.target.value)}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  min="1"
                />
              )}

              {offerType === "bulk_price" && (
                <input
                  type="number"
                  placeholder="Bulk Price (₹)"
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(e.target.value)}
                  className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                  min="0"
                />
              )}

              {offerType === "individual" && (
                <>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold appearance-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat (₹)</option>
                  </select>
                  <input
                    type="number"
                    placeholder={
                      discountType === "percentage"
                        ? "Discount %"
                        : "Discount ₹"
                    }
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                    min="0"
                  />
                </>
              )}

              {/* Valid till */}
              <input
                type="date"
                value={validTill}
                onChange={(e) => setValidTill(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                placeholder="Valid till (optional)"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick value buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickValues.map((val) => (
                  <button
                    key={val}
                    onClick={() => setMinBillValue(String(val))}
                    className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
                      String(minBillValue) === String(val)
                        ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                        : "bg-white text-[#1A1A1A] border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30"
                    }`}
                  >
                    ₹{val}
                  </button>
                ))}
              </div>

              <input
                type="number"
                placeholder="Min Bill Value (₹)"
                value={minBillValue}
                onChange={(e) => setMinBillValue(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                min="0"
              />

              <select
                value={orderDiscountType}
                onChange={(e) => setOrderDiscountType(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold appearance-none"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>

              <input
                type="number"
                placeholder={
                  orderDiscountType === "percentage"
                    ? "Discount %"
                    : "Discount ₹"
                }
                value={orderDiscountValue}
                onChange={(e) => setOrderDiscountValue(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                min="0"
              />

              <input
                type="date"
                value={orderValidTill}
                onChange={(e) => setOrderValidTill(e.target.value)}
                className="w-full p-4 bg-[#F5F5F0] rounded-2xl focus:outline-none font-bold"
                placeholder="Valid till (optional)"
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-6 py-4 bg-[#1A1A1A] text-white font-bold rounded-2xl hover:bg-[#1A1A1A]/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Offer"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function BulkDiscountManager({ shopId, products }) {
  const [activeTab, setActiveTab] = useState("product");
  const [productDiscounts, setProductDiscounts] = useState([]);
  const [orderDiscounts, setOrderDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, orderRes] = await Promise.all([
        listProductDiscounts(shopId),
        listOrderDiscounts(shopId),
      ]);
      setProductDiscounts(prodRes.data);
      setOrderDiscounts(orderRes.data);
    } catch (err) {
      console.error("Failed to load discounts:", err);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const handleDeleteProduct = async (id) => {
    setDeletingId(id);
    try {
      await deleteProductDiscount(shopId, id);
      await loadDiscounts();
    } catch (err) {
      console.error("Failed to delete product discount:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteOrder = async (id) => {
    setDeletingId(id);
    try {
      await deleteOrderDiscount(shopId, id);
      await loadDiscounts();
    } catch (err) {
      console.error("Failed to delete order discount:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const tabs = [
    { key: "product", label: "Product Offers" },
    { key: "order", label: "Bill Value Offers" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Discounts</h2>
          <p className="text-[#1A1A1A]/40 text-sm mt-1">
            Manage product and bill-value offers
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-[#1A1A1A] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#1A1A1A]/90 transition-colors"
        >
          <Plus size={16} />
          Create New Offer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#1A1A1A]/10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative pb-3 text-sm font-bold transition-colors ${
              activeTab === tab.key ? "text-[#5A5A40]" : "text-[#1A1A1A]/40"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="discount-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5A5A40]"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#1A1A1A]/10 border-t-[#1A1A1A] rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === "product" ? (
            <motion.div
              key="product"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {productDiscounts.length === 0 ? (
                <div className="text-center py-16 text-[#1A1A1A]/40">
                  <Tag size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">No product offers yet</p>
                  <p className="text-sm mt-1">
                    Create your first product discount to get started
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {productDiscounts.map((d) => {
                    const validity = validityBadge(d.valid_till);
                    return (
                      <motion.div
                        key={d.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-6 shadow-sm relative group overflow-hidden"
                      >
                        {/* Action buttons */}
                        <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteProduct(d.id)}
                            disabled={deletingId === d.id}
                            className="bg-red-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-bl-2xl hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === d.id ? "…" : "Delete"}
                          </button>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center flex-shrink-0">
                            <Tag size={18} className="text-[#5A5A40]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[#1A1A1A] truncate">
                              {d.product_name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full">
                                {OFFER_TYPE_LABELS[d.type] || d.type}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${validity.color}`}
                              >
                                {validity.label}
                              </span>
                            </div>
                            <p className="text-sm text-[#1A1A1A]/60 mt-2 font-medium">
                              {offerDescription(d)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="order"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {orderDiscounts.length === 0 ? (
                <div className="text-center py-16 text-[#1A1A1A]/40">
                  <Percent size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-bold">No bill value offers yet</p>
                  <p className="text-sm mt-1">
                    Create your first bill-value discount to get started
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {orderDiscounts.map((d) => {
                    const validity = validityBadge(d.valid_till);
                    const desc =
                      d.discount_type === "percentage"
                        ? `${d.discount_value}% OFF`
                        : `₹${d.discount_value} OFF`;
                    return (
                      <motion.div
                        key={d.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-[#1A1A1A]/10 rounded-[2rem] p-6 shadow-sm relative group overflow-hidden"
                      >
                        {/* Action buttons */}
                        <div className="absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteOrder(d.id)}
                            disabled={deletingId === d.id}
                            className="bg-red-500 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-bl-2xl hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {deletingId === d.id ? "…" : "Delete"}
                          </button>
                        </div>

                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#5A5A40]/10 flex items-center justify-center flex-shrink-0">
                            <Percent size={18} className="text-[#5A5A40]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[#1A1A1A]">
                              Bill Above ₹{d.min_bill_value}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full">
                                Tiered Discount
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${validity.color}`}
                              >
                                {validity.label}
                              </span>
                            </div>
                            <p className="text-sm text-[#1A1A1A]/60 mt-2 font-medium">
                              {desc}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Modal */}
      <AddDiscountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        shopId={shopId}
        products={products}
        onCreated={loadDiscounts}
      />
    </div>
  );
}
