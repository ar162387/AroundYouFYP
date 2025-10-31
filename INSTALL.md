# 🚀 Quick Installation Guide

## Prerequisites

Make sure you have these installed:
- ✅ **Bun** (v1.0.0 or higher) - [Install Bun](https://bun.sh)
- ✅ **Node.js** (v18 or higher)
- ✅ **Expo Go** app on your phone (optional, for testing)

## Installation Steps

### Step 1: Install Dependencies

```bash
bun install
```

This will install all packages (should take 1-2 minutes).

### Step 2: Verify Environment Variables

Your `.env` file is already set up! It should contain:
```
EXPO_PUBLIC_SUPABASE_URL=https://fdsvxpzyswcodrivezbz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
```

### Step 3: Start the App

```bash
bun run start
```

This will start the Expo development server.

### Step 4: Open the App

You have several options:

#### Option A: iOS Simulator (Mac only)
- Press `i` in the terminal

#### Option B: Android Emulator
- Make sure Android Studio is installed
- Press `a` in the terminal

#### Option C: Physical Device
- Install **Expo Go** from App Store/Play Store
- Scan the QR code shown in the terminal

## What You'll See

1. **Splash Screen** (2.5 seconds)
   - Beautiful blue gradient background
   - "Around You" branding with animation
   - Automatic transition to home

2. **Home Screen**
   - Header with profile, app name, and cart
   - Current delivery address
   - Search bar with filter
   - Categories (Grocery, Meat & Veg, Stationery)
   - Nearby shops with cards showing:
     - Shop image
     - Name and rating
     - Delivery fee
     - Tags
     - Open/Closed status

## Troubleshooting

### Error: "Cannot find module"
```bash
rm -rf node_modules
bun install
```

### Error: "Metro bundler failed to start"
```bash
bun run start --clear
```

### Error: "NativeWind styles not applying"
1. Stop the server (Ctrl+C)
2. Clear cache: `bun run start --clear`
3. Reload the app (shake device → Reload)

### Error: "Supabase connection failed"
Check your `.env` file has the correct credentials.

## Project Features

✅ **TypeScript** - Full type safety  
✅ **NativeWind** - Tailwind CSS for React Native  
✅ **Supabase** - Backend configured  
✅ **React Navigation** - Screen navigation  
✅ **Beautiful UI** - Blue gradient theme  
✅ **Production Ready** - Optimized structure  

## Next Commands

```bash
# Start development server
bun run start

# Start with cache cleared
bun run start --clear

# Open on iOS
bun run ios

# Open on Android
bun run android
```

## Development Tips

1. **Hot Reload**: Changes auto-reload (no restart needed)
2. **Debug Menu**: Shake device or Cmd+D (iOS) / Cmd+M (Android)
3. **Console Logs**: Use Expo DevTools in browser
4. **Live Preview**: Changes appear instantly

## File Structure

```
src/
├── components/          # UI components
│   ├── Header.tsx
│   ├── ShopCard.tsx
│   └── CategoryIcon.tsx
├── screens/            # App screens
│   ├── SplashScreen.tsx
│   └── HomeScreen.tsx
├── navigation/         # Navigation
│   ├── AppNavigator.tsx
│   └── types.ts
└── services/          # Backend
    └── supabase.ts
```

## Need Help?

Check these docs:
- [React Native](https://reactnative.dev)
- [Expo](https://docs.expo.dev)
- [NativeWind](https://www.nativewind.dev)
- [Supabase](https://supabase.com/docs)

---

**Ready to start?** Run `bun install` then `bun run start` 🎉

