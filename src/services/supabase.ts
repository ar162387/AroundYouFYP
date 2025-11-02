import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = Constants.expoConfig?.extra?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
  is_open: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  order: number;
};

