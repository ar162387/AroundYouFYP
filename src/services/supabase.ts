import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

const supabaseUrl = Config.SUPABASE_URL || '';
const supabaseAnonKey = Config.SUPABASE_ANON_KEY || '';
const serviceRoleKey = Config.SUPABASE_SERVICE_ROLE_KEY || null;

// Don't throw - just log warning and create a placeholder client to prevent crashes
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials. Some features may not work. Please check your .env file.');
}

// Create Supabase client with fallback to prevent crashes
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Admin client for server-side operations (using service_role key)
// Note: In production, this should be used only in backend/serverless functions
// For now, using it in client for development convenience
export const supabaseAdmin = serviceRoleKey && supabaseUrl
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

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
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  order: number;
};

