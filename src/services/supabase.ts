import 'react-native-url-polyfill/auto';
import { getSupabaseClient, getSupabaseAdminClient } from '../utils/connectionManager';

// Use the connection manager to get clients
// This ensures we have timeout handling and connection recovery
export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();

// Re-export connection management utilities for use in services
export {
  resetSupabaseConnection,
  executeWithRetry,
  checkConnectionHealth,
  isTimeoutOrConnectionError,
  getConnectionResetCount,
} from '../utils/connectionManager';

// Database types (you can expand these as you develop your schema)
export type Shop = {
  id: string;
  name: string;
  image_url: string;
  rating: number;
  orders?: number; // number of orders completed
  delivery_fee: number;
  delivery_time?: string; // e.g. "10-15 mins"
  tags: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  is_open: boolean;
  created_at: string;
  shop_type?: string; // e.g. "Grocery", "Meat", "Vegetable", "Stationery", "Dairy"
  minimumOrderValue?: number; // minimum order value in PKR
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  order: number;
};

