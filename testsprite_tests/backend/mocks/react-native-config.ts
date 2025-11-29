/**
 * Mock for react-native-config
 * This allows tests to run in Node.js environment
 */

// Mock the react-native-config module
const mockConfig: Record<string, string> = {};

// Load environment variables from .env
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Map environment variables to mock config
mockConfig.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
mockConfig.SUPABASE_URL = process.env.SUPABASE_URL || '';
mockConfig.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
mockConfig.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
mockConfig.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
mockConfig.GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '';

const Config = {
  get: (key: string, defaultValue?: string): string => {
    return mockConfig[key] || defaultValue || '';
  },
};

// Export as default to match react-native-config structure
export default Config;

// Also export individual values for direct access
Object.keys(mockConfig).forEach((key) => {
  (Config as any)[key] = mockConfig[key];
});

