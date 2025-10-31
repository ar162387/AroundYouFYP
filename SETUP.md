# Setup Guide for Around You App

## Quick Start

Follow these steps to get your app running:

### 1. Install Dependencies

```bash
bun install
```

This will install all the required packages including:
- React Native & Expo
- TypeScript
- NativeWind (Tailwind CSS for React Native)
- Supabase Client
- React Navigation

### 2. Environment Configuration

Your `.env` file is already configured with Supabase credentials. Make sure it contains:

```env
EXPO_PUBLIC_SUPABASE_URL=https://fdsvxpzyswcodrivezbz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Start the Development Server

```bash
bun run start
```

Then:
- Press `i` to open iOS Simulator (Mac only)
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on your phone

## Supabase Setup

### Option 1: Use Dummy Data (Current)
The app currently uses dummy data in `HomeScreen.tsx`. No additional setup needed!

### Option 2: Connect to Real Supabase Database

1. Go to your Supabase project dashboard
2. Run these SQL queries in the SQL Editor:

#### Create Shops Table
```sql
create table shops (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  image_url text,
  rating numeric(2,1) default 0 check (rating >= 0 and rating <= 5),
  delivery_fee numeric(10,2) default 0,
  tags text[],
  address text,
  is_open boolean default true,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security
alter table shops enable row level security;

-- Create policy to allow reading all shops
create policy "Allow public read access to shops"
  on shops for select
  using (true);
```

#### Create Categories Table
```sql
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  icon text,
  order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security
alter table categories enable row level security;

-- Create policy to allow reading all categories
create policy "Allow public read access to categories"
  on categories for select
  using (true);
```

#### Insert Sample Data
```sql
-- Insert sample categories
insert into categories (name, icon, "order") values
  ('Grocery', '🛒', 1),
  ('Meat & Vegetables', '🥩', 2),
  ('Stationery', '📚', 3);

-- Insert sample shops
insert into shops (name, image_url, rating, delivery_fee, tags, address, is_open) values
  ('Fresh Mart Grocery', 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800', 4.5, 2.99, ARRAY['Grocery', 'Fresh Produce', 'Organic'], '123 Main St, 2 km away', true),
  ('Meat & Veggie Palace', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800', 4.8, 1.99, ARRAY['Meat', 'Vegetables', 'Halal'], '456 Oak Ave, 1.5 km away', true),
  ('Office Supplies Plus', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800', 4.3, 3.49, ARRAY['Stationery', 'Office', 'School Supplies'], '789 Pine Rd, 3 km away', false);
```

3. Update your `HomeScreen.tsx` to fetch from Supabase:

```typescript
// Add this import
import { supabase } from '../services/supabase';

// Replace the DUMMY_SHOPS with real data fetching:
const [shops, setShops] = useState<Shop[]>([]);

useEffect(() => {
  fetchShops();
}, []);

async function fetchShops() {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('rating', { ascending: false });
  
  if (data) setShops(data);
}
```

## NativeWind UI Components

This project is set up to use NativeWind UI components from https://nativewindui.com

### Installing Additional Components

```bash
bun add @nativewind/ui
```

Then use components like:
```tsx
import { Button, Card, Input } from '@nativewind/ui';
```

## Project Structure

```
around-you/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.tsx      # App header with profile & cart
│   │   ├── ShopCard.tsx    # Shop display card
│   │   └── CategoryIcon.tsx # Category icon button
│   ├── screens/           # App screens
│   │   ├── SplashScreen.tsx # Animated splash screen
│   │   └── HomeScreen.tsx   # Main home screen
│   ├── navigation/        # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   └── types.ts
│   └── services/          # External services
│       └── supabase.ts    # Supabase client config
├── assets/               # Images and icons
├── App.tsx              # Root component
├── index.js             # Entry point
├── global.css           # Tailwind styles
└── tailwind.config.js   # Tailwind configuration
```

## Customization

### Changing Theme Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        // Change these values
        500: '#3b82f6',
        600: '#2563eb',
      },
    },
  },
}
```

### Adding More Categories

Edit `src/screens/HomeScreen.tsx`:

```typescript
const CATEGORIES = [
  { name: 'Your Category', emoji: '🎯' },
  // Add more here
];
```

## Troubleshooting

### Metro Bundler Issues
```bash
bun run start --clear
```

### NativeWind Not Working
```bash
rm -rf node_modules
bun install
```

### Expo Go Connection Issues
Make sure your phone and computer are on the same WiFi network.

## Next Steps

1. ✅ App is set up with Splash and Home screens
2. ✅ Supabase is configured
3. 🔄 Add authentication (use Supabase Auth)
4. 🔄 Add shop detail page
5. 🔄 Implement cart functionality
6. 🔄 Add order placement
7. 🔄 Add user profile management

## Support

For issues with:
- **React Native**: https://reactnative.dev/docs/getting-started
- **Expo**: https://docs.expo.dev
- **NativeWind**: https://www.nativewind.dev
- **Supabase**: https://supabase.com/docs

Happy coding! 🚀

