// src/components/InvoiceModal.jsx — Shared Invoice Modal for customer & owner roles

import { useRef } from 'react';
import { motion } from 'motion/react';
import { X, Store, Download, Printer } from 'lucide-react';

export default function InvoiceModal({ order, shopView, onClose }) {
  const invoiceRef = useRef(null);

  if (!order) return null;

  const invoiceNo  = `INV-${String(order.id).padStart(6, '0')}`;
  const orderDate  = new Date(order.created_at);
  const subtotal   = order.items.reduce((s, i) => s + (i.line_total ?? i.price * i.quantity), 0);
  const delivery   = 0;
  const total      = order.total ?? subtotal;

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`
      <html><head><title>${invoiceNo}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; color: #1A1A1A; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #5A5A40; }
        .brand { font-size: 24px; font-weight: 800; color: #5A5A40; }
        .brand-sub { font-size: 11px; color: #888; margin-top: 2px; }
        .inv-title { font-size: 28px; font-weight: 800; color: #5A5A40; text-align: right; }
        .inv-no { font-size: 12px; color: #888; text-align: right; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 28px; }
        .meta-block h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 6px; }
        .meta-block p { font-size: 13px; font-weight: 600; }
        .meta-block p.light { color: #666; font-weight: 400; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #999; padding: 10px 12px; border-bottom: 1px solid #eee; }
        th:last-child { text-align: right; }
        td { padding: 12px; border-bottom: 1px solid #f5f5f0; font-size: 13px; }
        td:last-child { text-align: right; font-weight: 700; }
        .qty-col { text-align: center; }
        .price-col { text-align: right; }
        .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; margin-bottom: 32px; }
        .total-row { display: flex; gap: 32px; font-size: 13px; min-width: 240px; justify-content: space-between; }
        .total-row.grand { font-size: 20px; font-weight: 800; padding-top: 10px; border-top: 2px solid #1A1A1A; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
        .status { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 3px 10px; border-radius: 20px; background: #f0f0e8; color: #5A5A40; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]/6">
          <h3 className="font-serif text-lg font-bold">Invoice</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F0] rounded-xl text-xs font-bold text-[#5A5A40] hover:bg-[#5A5A40]/10 transition-all">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F0] rounded-xl transition-colors">
              <X size={20} className="text-[#1A1A1A]/40" />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={invoiceRef}>
          {/* Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-[#5A5A40]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center">
                  <Store size={14} className="text-white" />
                </div>
                <span className="font-serif text-xl font-bold text-[#5A5A40]">HyperMart</span>
              </div>
              <p className="text-[10px] text-[#1A1A1A]/40">Your neighbourhood marketplace</p>
            </div>
            <div className="text-right">
              <h2 className="font-serif text-2xl font-bold text-[#5A5A40]">INVOICE</h2>
              <p className="text-xs text-[#1A1A1A]/40 font-bold">{invoiceNo}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Order Date</p>
              <p className="text-sm font-bold">{orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="text-[10px] text-[#1A1A1A]/40">{orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Shop</p>
              <p className="text-sm font-bold">{order.shop_name}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Status</p>
              <span className="inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#F5F5F0] text-[#5A5A40]">
                {order.status?.replace(/_/g, ' ') || 'pending'}
              </span>
            </div>
            {order.delivery_address && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Delivery Address</p>
                <p className="text-sm">{order.delivery_address}</p>
              </div>
            )}
            {order.payment_method && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Payment</p>
                <span className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  order.payment_status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {order.payment_method === 'razorpay' ? 'Online' : order.payment_method === 'upi' ? 'UPI' : 'Cash'}
                  {' — '}{order.payment_status || 'pending'}
                </span>
              </div>
            )}
            {shopView && order.customer_id && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35 mb-1">Customer</p>
                <p className="text-sm font-bold">#{order.customer_id}</p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-[#1A1A1A]/5 rounded-2xl overflow-hidden mb-6">
           <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-[#F5F5F0]">
                <tr>
                  <th className="text-left px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">#</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Item</th>
                  <th className="text-center px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Qty</th>
                  <th className="text-right px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Price</th>
                  <th className="text-right px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]/5">
                {order.items.map((item, i) => (
                  <tr key={item.id || i}>
                    <td className="px-4 py-3 text-[#1A1A1A]/40">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-[#1A1A1A]/60">&#8377;{item.price}</td>
                    <td className="px-4 py-3 text-right font-bold">&#8377;{item.line_total ?? item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          </div>

          {/* Totals */}
          <div className="flex flex-col items-end gap-1.5 mb-6">
            <div className="flex justify-between w-56 text-sm text-[#1A1A1A]/50">
              <span>Subtotal</span>
              <span className="font-medium">&#8377;{subtotal}</span>
            </div>
            <div className="flex justify-between w-56 text-sm text-[#1A1A1A]/50">
              <span>Delivery</span>
              <span className="text-green-600 font-bold">{delivery === 0 ? 'FREE' : `₹${delivery}`}</span>
            </div>
            <div className="flex justify-between w-56 pt-2 mt-1 border-t-2 border-[#1A1A1A]">
              <span className="font-bold uppercase tracking-widest text-xs">Total</span>
              <span className="font-serif text-2xl font-bold">&#8377;{total}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-[#1A1A1A]/5 pt-4">
            <p className="text-[10px] text-[#1A1A1A]/30">Thank you for shopping with HyperMart!</p>
            <p className="text-[9px] text-[#1A1A1A]/20 mt-1">This is a computer-generated invoice.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
