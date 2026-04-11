export type UserRole = 'admin' | 'owner' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoURL?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  multiLocationEnabled?: boolean;
  multiLocationRequestStatus?: 'none' | 'pending' | 'approved';
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  category: string;
  status: 'pending' | 'approved' | 'suspended';
  logo?: string;
  timings?: string;
  locationName: string;
  location?: {
    lat: number;
    lng: number;
  };
  deliveryRadius?: number; // in km
  rating?: number;
  reviewCount?: number;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  price: number;
  mrp: number;
  unit: string;
  category: string;
  stock: number;
  image?: string;
  status: 'active' | 'out_of_stock' | 'deleted';
  createdAt: string;
  expiryDate?: string;
  lowStockThreshold?: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  mrp: number;
  quantity: number;
  unit: string;
}

export interface Order {
  id: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  itemDiscounts: number;
  billDiscount: number;
  totalDiscount: number;
  total: number;
  status: 'pending' | 'accepted' | 'ready' | 'out_for_delivery' | 'delivered' | 'rejected';
  paymentStatus: 'pending' | 'paid';
  deliveryAddress: string;
  type: 'online' | 'walk-in';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  image?: string;
}

export interface Review {
  id: string;
  shopId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  shopId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  shopId: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'draft' | 'sent' | 'received' | 'cancelled';
  createdAt: string;
}

export interface ProductDiscount {
  id: string;
  shopId: string;
  productId: string;
  productName: string;
  type: 'bogo' | 'buy_x_get_y' | 'bulk_price' | 'individual';
  buyQty: number;
  getQty: number;
  bulkPrice?: number; // e.g., Buy 3 for ₹100
  discountType?: 'percentage' | 'flat'; // For individual item discount
  discountValue?: number; // For individual item discount
  status: 'active' | 'inactive';
  validTill?: string; // ISO date string
  createdAt: string;
}

export interface OrderDiscount {
  id: string;
  shopId: string;
  minBillValue: number;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  status: 'active' | 'inactive';
  validTill?: string; // ISO date string
  createdAt: string;
}
