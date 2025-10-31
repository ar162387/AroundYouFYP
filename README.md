# Around You 🌍

A React Native mobile app for discovering and ordering from local shops around you.

## Features

- 🎨 Beautiful blue gradient theme
- 🛍️ Browse nearby shops
- 📍 Location-based delivery
- 🔍 Search functionality
- 🛒 Shopping cart
- ⭐ Shop ratings and reviews
- 🏪 Multiple categories (Grocery, Meat & Vegetables, Stationery)

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Supabase
- **Navigation**: React Navigation
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- Bun package manager installed
- Expo CLI
- iOS Simulator (for Mac) or Android Emulator

### Installation

1. Install dependencies:
```bash
bun install
```

2. Start the development server:
```bash
bun run start
```

3. Run on your platform:
- Press `i` for iOS
- Press `a` for Android
- Scan QR code with Expo Go app for physical device

## Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Header.tsx
│   ├── ShopCard.tsx
│   └── CategoryIcon.tsx
├── screens/         # App screens
│   ├── SplashScreen.tsx
│   └── HomeScreen.tsx
├── navigation/      # Navigation configuration
│   ├── AppNavigator.tsx
│   └── types.ts
└── services/        # API and external services
    └── supabase.ts
```

## Supabase Database Schema (Recommended)

### Shops Table
```sql
create table shops (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  image_url text,
  rating numeric(2,1) default 0,
  delivery_fee numeric(10,2) default 0,
  tags text[],
  address text,
  is_open boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

### Categories Table
```sql
create table categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  icon text,
  order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## Customization

### Theme Colors

The app uses a blue gradient theme. You can customize colors in `tailwind.config.js`:

```javascript
colors: {
  primary: {
    // Customize blue shades
  }
}
```

### Adding More Categories

Edit the `CATEGORIES` array in `src/screens/HomeScreen.tsx`:

```typescript
const CATEGORIES = [
  { name: 'Your Category', emoji: '🎯' },
  // Add more categories
];
```

## Contributing

This is a production-grade starter template. Feel free to extend it with:
- User authentication
- Real-time shop data from Supabase
- Order placement and tracking
- Payment integration
- Push notifications
- User reviews and ratings

## License

MIT

