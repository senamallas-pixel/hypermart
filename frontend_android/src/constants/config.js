// Change this to your backend URL
// For local development with Android emulator, use 10.0.2.2 instead of localhost
export const API_URL = 'http://10.0.2.2:8000';

export const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'ravi@example.com', password: 'Customer@123', role: 'customer' },
  { label: 'Shop Owner', email: 'anand@example.com', password: 'Owner@123', role: 'owner' },
  { label: 'Admin', email: 'senamallas@gmail.com', password: 'Admin@123', role: 'admin' },
];

export const LOCATIONS = ['All', 'Green Valley', 'Central Market', 'Food Plaza', 'Milk Lane', 'Old Town'];

export const CATEGORIES = [
  'Grocery', 'Dairy', 'Vegetables & Fruits', 'Meat',
  'Bakery & Snacks', 'Beverages', 'Household', 'Personal Care',
];

export const ORDER_STATUSES = ['pending', 'accepted', 'ready', 'out_for_delivery', 'delivered', 'rejected'];
