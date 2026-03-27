export type UserRole = 'admin' | 'owner' | 'customer';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoURL?: string;
  phone?: string;
  createdAt: string;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  category: string;
  status: 'pending' | 'approved' | 'suspended';
  logo?: string;
  timings?: string;
  locationName: string;
  location?: {
    lat: number;
    lng: number;
  };
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
  status: 'active' | 'out_of_stock';
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  shopId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'accepted' | 'ready' | 'out_for_delivery' | 'delivered' | 'rejected';
  paymentStatus: 'pending' | 'paid';
  deliveryAddress: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  image?: string;
}
