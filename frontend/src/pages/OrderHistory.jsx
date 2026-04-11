// src/pages/OrderHistory.jsx — Customer order history with filtering and details

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, Calendar, MapPin, Package, ChevronRight, Search, Filter, Eye, Clock, CheckCircle2, AlertCircle, ShoppingBag, Truck, DollarSign, XCircle, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getMyOrders, cancelOrder } from '../api/client';
import InvoiceModal from '../components/InvoiceModal';

export default function OrderHistory() {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [cancellingId, setCancellingId] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await getMyOrders();
        setOrders(res.data?.items || []);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const handleCancel = async (orderId) => {
    if (!confirm('Cancel this order? Stock will be restored.')) return;
    setCancellingId(orderId);
    try {
      await cancelOrder(orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'rejected' } : o));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id?.toString().includes(searchTerm) ||
      order.shop_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':          return <Clock size={16} className="text-yellow-600" />;
      case 'accepted':         return <CheckCircle2 size={16} className="text-blue-600" />;
      case 'ready':            return <Package size={16} className="text-indigo-600" />;
      case 'out_for_delivery': return <Truck size={16} className="text-orange-600" />;
      case 'delivered':        return <CheckCircle2 size={16} className="text-emerald-600" />;
      case 'rejected':         return <AlertCircle size={16} className="text-red-600" />;
      default:                 return <Package size={16} className="text-[#5A5A40]" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':          return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'accepted':         return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ready':            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'out_for_delivery': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'delivered':        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'rejected':         return 'bg-red-50 text-red-700 border-red-200';
      default:                 return 'bg-[#F5F5F0] text-[#5A5A40] border-[#5A5A40]/10';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#5A5A40]" />
          <p className="mt-4 text-[#5A5A40]">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Header */}
      <div className="bg-white border-b border-[#1A1A1A]/5 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/marketplace')}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-[#5A5A40]" />
            </motion.button>
            <h1 className="text-xl font-bold text-[#1A1A1A]">Order History</h1>
          </div>
          <span className="text-sm text-[#5A5A40]/60 font-medium">{filteredOrders.length} orders</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col sm:flex-row gap-3"
        >
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-3 text-[#5A5A40]/40" />
            <input
              type="text"
              placeholder="Search order ID or shop name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 border border-[#1A1A1A]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent bg-white font-medium text-[#1A1A1A]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="rejected">Rejected</option>
          </select>
        </motion.div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <ShoppingBag size={48} className="mx-auto text-[#5A5A40]/20 mb-4" />
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No orders found</h3>
            <p className="text-[#5A5A40]/60 mb-6">
              {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Start shopping to see your orders here'}
            </p>
            {orders.length === 0 && (
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/marketplace')}
                className="inline-block px-6 py-2 bg-[#5A5A40] text-white font-semibold rounded-lg hover:bg-[#3A3A2A] transition-colors"
              >
                Start Shopping
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-xl border border-[#1A1A1A]/5 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Order Header */}
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#F5F5F0] transition-colors" onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-[#1A1A1A]">Order #{order.id}</h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#5A5A40]/60">
                        <div className="flex items-center gap-1">
                          <ShoppingBag size={14} />
                          <span>{order.shop_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#1A1A1A] text-lg">₹{order.total}</div>
                      <p className="text-xs text-[#5A5A40]/60">{order.items?.length || 0} items</p>
                    </div>
                    <ChevronRight size={20} className={`ml-4 text-[#5A5A40]/40 transition-transform ${selectedOrder === order.id ? 'rotate-90' : ''}`} />
                  </div>

                  {/* Order Details - Expandable */}
                  <AnimatePresence>
                    {selectedOrder === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-[#1A1A1A]/5 bg-[#F5F5F0]/50"
                      >
                        <div className="p-4 space-y-4">
                          {/* Items */}
                          <div>
                            <h4 className="font-semibold text-[#1A1A1A] mb-3">Items</h4>
                            <div className="space-y-2">
                              {order.items?.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-[#1A1A1A]/5">
                                  <span className="flex-1 text-[#1A1A1A]">{item.name}</span>
                                  <span className="text-[#5A5A40]/60">x{item.quantity}</span>
                                  <span className="font-semibold text-[#1A1A1A] min-w-fit ml-2">₹{item.line_total}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Delivery Address */}
                          {order.delivery_address && (
                            <div>
                              <h4 className="font-semibold text-[#1A1A1A] mb-2 flex items-center gap-2">
                                <MapPin size={16} /> Delivery Address
                              </h4>
                              <p className="text-sm text-[#5A5A40] bg-white rounded p-3 border border-[#1A1A1A]/5">
                                {order.delivery_address}
                              </p>
                            </div>
                          )}

                          {/* Summary */}
                          <div className="pt-2 border-t border-[#1A1A1A]/5">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-[#5A5A40]">Subtotal</span>
                              <span className="text-[#1A1A1A] font-semibold">₹{(order.total * 0.95).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-lg font-bold text-[#1A1A1A]">
                              <span>Total</span>
                              <span className="text-[#5A5A40] text-2xl">₹{order.total}</span>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="pt-3 flex gap-2">
                            {order.status === 'pending' && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleCancel(order.id)}
                                disabled={cancellingId === order.id}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {cancellingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                Cancel Order
                              </motion.button>
                            )}
                            {order.status === 'delivered' && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setInvoiceOrder(order)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-[#5A5A40]/20 text-[#5A5A40] font-semibold rounded-lg hover:bg-[#F5F5F0] transition-colors"
                              >
                                <Printer size={16} />
                                Print Invoice
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
}
