# Persistent Cart System Implementation

This document describes the complete implementation of the persistent cart system for the AroundYou app.

## Overview

The cart system allows users to:
- Add items to per-shop carts
- View and manage carts for multiple shops
- Persist carts across app restarts
- Validate delivery zones when accessing carts

## Components Implemented

### 1. CartContext (`src/context/CartContext.tsx`)

A React Context provider that manages all cart state and operations.

**Features:**
- Per-shop cart management
- AsyncStorage persistence (survives app restarts)
- Automatic total calculations (items count and price)
- Cart operations: add, remove, update quantity, delete shop cart

**Key Functions:**
- `addItemToCart()` - Adds item or increments quantity
- `removeItemFromCart()` - Removes item or decrements quantity
- `updateItemQuantity()` - Updates item quantity directly
- `deleteShopCart()` - Removes entire shop cart
- `getShopCart()` - Retrieves specific shop's cart

### 2. ShopScreen Updates (`src/screens/consumer/ShopScreen.tsx`)

Enhanced shop screen with cart functionality.

**Features:**
- Add/Remove controls on product cards
  - Shows `+` button when item not in cart
  - Shows `-`, quantity, `+` controls when item in cart
- Instant quantity updates (no loading states)
- Sticky footer that appears when cart has items
  - Shows "View your cart" CTA
  - Displays item count
  - Shows total price
- Cart controls in both:
  - Main product grid
  - Search results

### 3. CartsManagementScreen (`src/screens/consumer/CartsManagementScreen.tsx`)

New screen for managing all shop carts.

**Features:**
- Lists all shops with items in cart
- Each cart banner shows:
  - **Upper section**: Shop image, name, and address (clickable)
  - **Lower section**: 
    - Comma-separated item list with quantities (e.g., "Milk x 2, Bread x 1")
    - Cart total (bold)
    - "Add more items" link
  - **Bin icon**: Delete cart (with confirmation)

**Delivery Zone Validation:**
- On screen open, validates user location against each shop's delivery zones
- If inside zone: banner fully clickable
- If outside zone: 
  - Banner becomes unclickable (except bin)
  - Shows "Unavailable in your location" text
  - Tapping shows toast: "Shop unavailable in your location."
- Uses PostGIS-based polygon containment check

**UI Chrome:**
- Back button (SVG)
- User's current address (matches Home header)

### 4. Header Updates (`src/components/consumer/Header.tsx`)

**Features:**
- Cart icon now navigates to CartsManagementScreen
- Badge showing number of shops with items (shows "9+" when > 9)
- Red badge appears only when carts exist

### 5. Navigation Updates

**Files Modified:**
- `src/navigation/types.ts` - Added `CartsManagement` route
- `src/navigation/AppNavigator.tsx` - Added screen registration
- `src/screens/consumer/HomeScreen.tsx` - Connected cart icon to navigation

### 6. Type Definitions

**Updated:**
- `src/types/react-query.d.ts` - Added QueryClient and QueryClientProvider types

## Data Model

### CartItem
```typescript
interface CartItem extends ShopItem {
  quantity: number;
}
```

### ShopCart
```typescript
interface ShopCart {
  shopId: string;
  shopName: string;
  shopImage?: string;
  shopAddress?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  deliveryLogic?: any;
  items: CartItem[];
  totalPrice: number;  // in cents
  totalItems: number;
}
```

### CartsState
```typescript
interface CartsState {
  [shopId: string]: ShopCart;
}
```

## User Flow

### Adding Items to Cart

1. User navigates to a shop
2. Taps `+` button on product card
3. Item added to shop's cart (quantity = 1)
4. Button changes to show `-`, quantity, `+` controls
5. Sticky footer appears at bottom showing cart summary
6. User can continue adding items or tap footer to view cart

### Managing Carts

1. User taps cart icon in Home header
2. CartsManagementScreen opens
3. Shows all shops with items in cart
4. For each shop:
   - Validates delivery zone
   - If available: clickable to navigate to shop
   - If unavailable: shows warning, prevents navigation
5. User can:
   - Delete individual carts (with confirmation)
   - Tap "Add more items" to go to shop
   - Tap shop info to open shop (if available)

### Delivery Zone Validation

The system uses PostGIS polygon containment to check if user's location is within shop's delivery zones:

```typescript
// Client-side validation using polygon utilities
const isInside = isPointInsidePolygon(userPoint, shopPolygon);
```

This prevents users from:
- Ordering from shops outside their delivery zone
- Circumventing delivery restrictions via cart access

## Persistence

Carts are automatically saved to AsyncStorage whenever modified:
- Key: `aroundyou_carts`
- Format: JSON stringified CartsState
- Loaded on app startup
- Survives app restarts and reinstalls (if device allows)

## UI/UX Considerations

### Consistency
- Uses existing design patterns (gradients, shadows, colors)
- Matches existing button styles and interactions
- Follows established navigation patterns

### Responsiveness
- No loading states for cart operations (instant feedback)
- Optimistic updates with error handling
- Smooth animations and transitions

### Robustness
- Handles missing shop data gracefully
- Validates coordinates before calculations
- Checks delivery zones asynchronously
- Shows appropriate error messages

## Testing Considerations

When testing the cart system:

1. **Add/Remove Items**
   - Add item → verify quantity increases
   - Remove item → verify quantity decreases
   - Remove last item → verify cart deleted

2. **Persistence**
   - Add items to cart
   - Close and reopen app
   - Verify carts still exist

3. **Delivery Zone Validation**
   - Add items from shop
   - Change location to outside delivery zone
   - Open carts screen → verify shop marked unavailable

4. **Multiple Shops**
   - Add items from multiple shops
   - Verify each shop maintains separate cart
   - Verify badge shows correct count

5. **Footer Behavior**
   - Add item → footer appears
   - Remove all items → footer disappears
   - Verify footer shows correct totals

## Future Enhancements

Possible improvements:
1. Add "Proceed to Checkout" from cart footer
2. Implement cart expiration (e.g., 24 hours)
3. Add item notes/special instructions
4. Show delivery fee in cart summary
5. Implement cart sharing
6. Add recommended items based on cart contents
7. Show minimum order value warnings
8. Implement cart syncing across devices (when user logged in)

## Files Created/Modified

### Created:
- `src/context/CartContext.tsx`
- `src/screens/consumer/CartsManagementScreen.tsx`
- `docs/CART_SYSTEM_IMPLEMENTATION.md`

### Modified:
- `App.tsx` - Added CartProvider
- `src/navigation/types.ts` - Added CartsManagement route
- `src/navigation/AppNavigator.tsx` - Added screen registration
- `src/screens/consumer/ShopScreen.tsx` - Added cart controls and footer
- `src/components/consumer/Header.tsx` - Added cart badge and navigation
- `src/screens/consumer/HomeScreen.tsx` - Connected cart icon
- `src/types/react-query.d.ts` - Added QueryClient types

