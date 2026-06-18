// Dedicated payment page. Reached from the cart's "Continue" with the delivery
// address in navigation state. Offers Cash on Delivery, Card (Razorpay), and
// UPI apps (GPay / PhonePe / Paytm). Reads the cart from context.
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowLeft, Loader2, Store, Banknote, CreditCard, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import { placeOrder, createRazorpayOrder, verifyRazorpayPayment, getShopUPI } from '../api/client';
import { rememberAddress } from '../components/AddressPicker';
import InvoiceModal from '../components/InvoiceModal';

const METHODS = [
  { key: 'cash', label: 'Cash on Delivery', sub: 'Pay when it arrives', Icon: Banknote },
  { key: 'card', label: 'Debit / Credit Card', sub: 'Visa, Mastercard, RuPay', Icon: CreditCard },
  { key: 'upi',  label: 'UPI — GPay / PhonePe / Paytm', sub: 'Scan QR or open your UPI app', Icon: Smartphone },
];

export default function Payment() {
  const { cart, cartTotal, clearCart, currentUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const address = location.state?.address || '';

  const [method, setMethod] = useState('cash');
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [shopUPI, setShopUPI] = useState(null);

  useEffect(() => {
    if (cart.shopId) getShopUPI(cart.shopId).then(r => setShopUPI(r.data)).catch(() => {});
  }, [cart.shopId]);

  const total = cartTotal;
  const upiLink = shopUPI?.upi_id
    ? `upi://pay?pa=${encodeURIComponent(shopUPI.upi_id)}&pn=${encodeURIComponent(cart.shopName || 'HyperShopIndia')}&am=${total}&cu=INR`
    : null;

  // Nothing to pay for → go back.
  if (!placedOrder && (!cart.items?.length || !address)) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-10 text-center">
        <p className="text-[#1A1A1A]/40 text-sm mb-5">Your cart or delivery address is missing.</p>
        <button onClick={() => navigate('/marketplace')}
          className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30]">
          Back to shops
        </button>
      </div>
    );
  }

  const basePayload = () => ({
    shop_id: cart.shopId,
    items: cart.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
    delivery_address: address,
  });

  const finish = (order) => { rememberAddress(address); clearCart(); setPlacedOrder(order); };

  const handlePay = async () => {
    if (!currentUser) { navigate('/login'); return; }
    setPlacing(true);
    try {
      if (method === 'cash') {
        const res = await placeOrder({ ...basePayload(), payment_method: 'cash' });
        finish(res.data);
      } else if (method === 'upi') {
        if (!shopUPI?.upi_id) { alert('This shop has not set up UPI yet. Please choose another method.'); setPlacing(false); return; }
        const res = await placeOrder({ ...basePayload(), payment_method: 'upi' });
        finish(res.data);
      } else if (method === 'card') {
        const res = await placeOrder({ ...basePayload(), payment_method: 'razorpay' });
        try {
          const rz = (await createRazorpayOrder(res.data.id)).data;
          const options = {
            key: rz.key_id, amount: rz.amount, currency: rz.currency,
            name: 'HyperShopIndia', description: `Order #${res.data.id}`, order_id: rz.razorpay_order_id,
            handler: async (resp) => {
              try {
                await verifyRazorpayPayment({
                  order_id: res.data.id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                });
              } catch { /* verification failed — order stays */ }
              finish({ ...res.data, payment_status: 'paid', payment_method: 'razorpay' });
            },
            modal: { ondismiss: () => { finish(res.data); } },
            prefill: { email: currentUser.email, contact: currentUser.phone || '' },
          };
          if (window.Razorpay) { new window.Razorpay(options).open(); setPlacing(false); return; }
          alert('Card gateway not available. Order placed — you can pay on delivery.');
          finish(res.data);
        } catch {
          alert('Could not start card payment. Order placed — you can pay on delivery.');
          finish(res.data);
        }
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to place order.');
    } finally {
      setPlacing(false);
    }
  };

  if (placedOrder) return (
    <>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="font-serif text-2xl font-bold mb-2">Order Placed!</h2>
        <p className="text-[#1A1A1A]/40 text-sm mb-6">Your order #{placedOrder.id} has been confirmed.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowInvoice(true)}
            className="bg-[#5A5A40] text-white px-6 py-3 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-sm">
            View Invoice
          </button>
          <button onClick={() => navigate('/orders')}
            className="px-6 py-3 rounded-2xl border border-[#1A1A1A]/10 text-sm font-bold text-[#1A1A1A]/60 hover:bg-[#F5F5F0] transition-all">
            My Orders
          </button>
        </div>
      </motion.div>
      {showInvoice && <InvoiceModal order={placedOrder} onClose={() => setShowInvoice(false)} />}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto px-4 pb-32 pt-4 sm:pt-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[11px] font-bold text-[#1A1A1A]/55 hover:text-[#5A5A40] mb-4">
        <ArrowLeft size={14} /> Back to cart
      </button>

      <h2 className="font-serif text-2xl font-bold mb-5">Payment</h2>

      {/* Order summary */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl px-5 py-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Store size={14} className="text-[#5A5A40]" />
          <p className="font-bold text-sm">{cart.shopName}</p>
        </div>
        {cart.items.map(i => (
          <div key={i.productId} className="flex justify-between text-sm py-0.5">
            <span className="text-[#1A1A1A]/70">{i.name} × {i.quantity}</span>
            <span className="text-[#1A1A1A]/60">&#8377;{i.price * i.quantity}</span>
          </div>
        ))}
        <div className="flex justify-between items-center border-t border-[#1A1A1A]/6 mt-3 pt-3">
          <span className="text-[#1A1A1A]/40 font-bold uppercase tracking-widest text-xs">Total</span>
          <span className="font-serif text-2xl font-bold">&#8377;{total}</span>
        </div>
      </div>

      {/* Delivery address (from previous step) */}
      <div className="bg-white border border-[#1A1A1A]/5 rounded-2xl px-5 py-3 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/35">Deliver to</p>
          <button onClick={() => navigate(-1)} className="text-[10px] font-bold text-[#5A5A40] hover:underline">Change</button>
        </div>
        <p className="text-sm text-[#1A1A1A]/75 mt-1 leading-snug">{address}</p>
      </div>

      {/* Payment methods */}
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#1A1A1A]/40 mb-2">Payment Method</p>
      <div className="space-y-2">
        {METHODS.map(({ key, label, sub, Icon }) => (
          <button key={key} onClick={() => setMethod(key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
              method === key ? 'border-[#5A5A40] bg-[#5A5A40]/8' : 'border-[#1A1A1A]/10 hover:border-[#5A5A40]/30'
            }`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${method === key ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] text-[#5A5A40]'}`}>
              <Icon size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-[#1A1A1A]">{label}</span>
              <span className="block text-[11px] text-[#1A1A1A]/45">{sub}</span>
            </span>
            <span className={`w-4 h-4 rounded-full border-2 ${method === key ? 'border-[#5A5A40] bg-[#5A5A40]' : 'border-[#1A1A1A]/20'}`} />
          </button>
        ))}
      </div>

      {/* UPI details when UPI chosen */}
      {method === 'upi' && (
        <div className="mt-3 bg-white border border-[#1A1A1A]/5 rounded-2xl p-4 text-center">
          {upiLink ? (
            <>
              <div className="inline-block bg-white p-2 rounded-xl border border-[#1A1A1A]/8">
                <QRCodeSVG value={upiLink} size={132} />
              </div>
              <p className="text-[11px] text-[#1A1A1A]/45 mt-2">Scan with any UPI app, or open one:</p>
              <div className="flex justify-center gap-2 mt-2">
                {['GPay', 'PhonePe', 'Paytm'].map(app => (
                  <a key={app} href={upiLink}
                    className="px-3 py-1.5 rounded-lg bg-[#F5F5F0] text-[11px] font-bold text-[#5A5A40] hover:bg-[#EBEBDB]">
                    {app}
                  </a>
                ))}
              </div>
              <p className="text-[10px] text-[#1A1A1A]/35 mt-2">Paying ₹{total} to {shopUPI.upi_id}. After paying, tap Place Order below.</p>
            </>
          ) : (
            <p className="text-[12px] text-[#1A1A1A]/45">This shop hasn't set up UPI yet — please choose Cash or Card.</p>
          )}
        </div>
      )}

      <button onClick={handlePay} disabled={placing}
        className="mt-5 w-full bg-[#5A5A40] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-[#4A4A30] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#5A5A40]/20">
        {placing ? <><Loader2 size={16} className="animate-spin" /> Placing…</>
          : method === 'card' ? <>Pay &#8377;{total}</>
          : method === 'upi' ? <>I've paid — Place Order</>
          : <>Place Order &#8377;{total}</>}
      </button>
    </motion.div>
  );
}
