import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShopItem } from '../services/consumer/shopService';

const CART_STORAGE_KEY = 'aroundyou_carts';

export interface CartItem extends ShopItem {
  quantity: number;
}

export interface ShopCart {
  shopId: string;
  shopName: string;
  shopImage?: string;
  shopAddress?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  deliveryLogic?: any;
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
}

export interface CartsState {
  [shopId: string]: ShopCart;
}

interface CartContextType {
  carts: CartsState;
  loading: boolean;
  addItemToCart: (shopId: string, item: ShopItem, shopDetails: { name: string; image_url?: string; address?: string; latitude?: number; longitude?: number; deliveryLogic?: any }) => Promise<void>;
  addItemToCartWithQuantity: (shopId: string, item: ShopItem, quantity: number, shopDetails: { name: string; image_url?: string; address?: string; latitude?: number; longitude?: number; deliveryLogic?: any }) => Promise<void>;
  removeItemFromCart: (shopId: string, itemId: string) => Promise<void>;
  updateItemQuantity: (shopId: string, itemId: string, quantity: number) => Promise<void>;
  deleteShopCart: (shopId: string) => Promise<void>;
  getShopCart: (shopId: string) => ShopCart | null;
  getAllCarts: () => ShopCart[];
  clearAllCarts: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<CartsState>({});
  const [loading, setLoading] = useState(true);

  // Load carts from AsyncStorage on mount
  useEffect(() => {
    loadCarts();
  }, []);

  const loadCarts = async () => {
    try {
      const storedCarts = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (storedCarts) {
        setCarts(JSON.parse(storedCarts));
      }
    } catch (error) {
      console.error('Error loading carts:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCarts = async (newCarts: CartsState) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCarts));
      setCarts(newCarts);
    } catch (error) {
      console.error('Error saving carts:', error);
    }
  };

  const calculateCartTotals = (items: CartItem[]) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    return { totalItems, totalPrice };
  };

  const addItemToCart = async (
    shopId: string,
    item: ShopItem,
    shopDetails: { name: string; image_url?: string; address?: string; latitude?: number; longitude?: number; deliveryLogic?: any }
  ) => {
    console.log('[CartContext] 🛒 addItemToCart called:', { 
      shopId, 
      itemId: item.id, 
      itemName: item.name,
      shopName: shopDetails.name 
    });
    
    const newCarts = { ...carts };
    
    if (!newCarts[shopId]) {
      // Create new cart for this shop
      console.log('[CartContext] ➕ Creating new cart for shop:', shopDetails.name);
      newCarts[shopId] = {
        shopId,
        shopName: shopDetails.name,
        shopImage: shopDetails.image_url,
        shopAddress: shopDetails.address,
        shopLatitude: shopDetails.latitude,
        shopLongitude: shopDetails.longitude,
        deliveryLogic: shopDetails.deliveryLogic,
        items: [],
        totalPrice: 0,
        totalItems: 0,
      };
    }

    const existingItemIndex = newCarts[shopId].items.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      // Increment quantity of existing item
      newCarts[shopId].items[existingItemIndex].quantity += 1;
      console.log('[CartContext] 📈 Incremented quantity for:', item.name, 'new qty:', newCarts[shopId].items[existingItemIndex].quantity);
    } else {
      // Add new item to cart
      newCarts[shopId].items.push({ ...item, quantity: 1 });
      console.log('[CartContext] ✅ Added new item to cart:', item.name);
    }

    // Recalculate totals
    const { totalItems, totalPrice } = calculateCartTotals(newCarts[shopId].items);
    newCarts[shopId].totalItems = totalItems;
    newCarts[shopId].totalPrice = totalPrice;
    
    console.log('[CartContext] 💰 Cart totals:', { totalItems, totalPrice: totalPrice / 100 });

    await saveCarts(newCarts);
    console.log('[CartContext] ✅ Cart saved to storage. Current state:', {
      shopId,
      itemCount: newCarts[shopId].items.length,
      items: newCarts[shopId].items.map(i => ({ name: i.name, qty: i.quantity }))
    });
  };

  const addItemToCartWithQuantity = async (
    shopId: string,
    item: ShopItem,
    quantity: number,
    shopDetails: { name: string; image_url?: string; address?: string; latitude?: number; longitude?: number; deliveryLogic?: any }
  ) => {
    console.log('[CartContext] 🛒 addItemToCartWithQuantity called:', { 
      shopId, 
      itemId: item.id, 
      itemName: item.name,
      quantity,
      shopName: shopDetails.name 
    });
    
    const newCarts = { ...carts };
    
    if (!newCarts[shopId]) {
      // Create new cart for this shop
      newCarts[shopId] = {
        shopId,
        shopName: shopDetails.name,
        shopImage: shopDetails.image_url,
        shopAddress: shopDetails.address,
        shopLatitude: shopDetails.latitude,
        shopLongitude: shopDetails.longitude,
        deliveryLogic: shopDetails.deliveryLogic,
        items: [],
        totalPrice: 0,
        totalItems: 0,
      };
    }

    const existingItemIndex = newCarts[shopId].items.findIndex(i => i.id === item.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item quantity
      newCarts[shopId].items[existingItemIndex].quantity = quantity;
    } else {
      // Add new item with specified quantity
      newCarts[shopId].items.push({ ...item, quantity });
    }

    // Recalculate totals
    const { totalItems, totalPrice } = calculateCartTotals(newCarts[shopId].items);
    newCarts[shopId].totalItems = totalItems;
    newCarts[shopId].totalPrice = totalPrice;

    await saveCarts(newCarts);
    console.log('[CartContext] ✅ Cart saved to storage:', {
      shopId,
      itemCount: newCarts[shopId].items.length,
      totalItems,
      totalPrice: totalPrice / 100,
      items: newCarts[shopId].items.map(i => `${i.name} (${i.quantity})`)
    });
  };

  const removeItemFromCart = async (shopId: string, itemId: string) => {
    const newCarts = { ...carts };
    
    if (!newCarts[shopId]) return;

    const itemIndex = newCarts[shopId].items.findIndex(i => i.id === itemId);
    
    if (itemIndex >= 0) {
      if (newCarts[shopId].items[itemIndex].quantity > 1) {
        // Decrement quantity
        newCarts[shopId].items[itemIndex].quantity -= 1;
      } else {
        // Remove item completely
        newCarts[shopId].items.splice(itemIndex, 1);
      }

      // Recalculate totals
      if (newCarts[shopId].items.length > 0) {
        const { totalItems, totalPrice } = calculateCartTotals(newCarts[shopId].items);
        newCarts[shopId].totalItems = totalItems;
        newCarts[shopId].totalPrice = totalPrice;
      } else {
        // Delete shop cart if no items left
        delete newCarts[shopId];
      }

      await saveCarts(newCarts);
    }
  };

  const updateItemQuantity = async (shopId: string, itemId: string, quantity: number) => {
    console.log('[CartContext] 🔢 updateItemQuantity called:', { shopId, itemId, quantity });
    
    const newCarts = { ...carts };
    
    if (!newCarts[shopId]) {
      console.log('[CartContext] ⚠️ Shop cart not found:', shopId);
      return;
    }

    const itemIndex = newCarts[shopId].items.findIndex(i => i.id === itemId);
    
    if (itemIndex >= 0) {
      const itemName = newCarts[shopId].items[itemIndex].name;
      
      if (quantity <= 0) {
        // Remove item
        console.log('[CartContext] 🗑️ Removing item:', itemName);
        newCarts[shopId].items.splice(itemIndex, 1);
        
        if (newCarts[shopId].items.length === 0) {
          console.log('[CartContext] 🧹 Deleting empty cart for shop:', shopId);
          delete newCarts[shopId];
        } else {
          const { totalItems, totalPrice } = calculateCartTotals(newCarts[shopId].items);
          newCarts[shopId].totalItems = totalItems;
          newCarts[shopId].totalPrice = totalPrice;
        }
      } else {
        // Update quantity
        console.log('[CartContext] ✏️ Updating quantity for:', itemName, 'to:', quantity);
        newCarts[shopId].items[itemIndex].quantity = quantity;
        const { totalItems, totalPrice } = calculateCartTotals(newCarts[shopId].items);
        newCarts[shopId].totalItems = totalItems;
        newCarts[shopId].totalPrice = totalPrice;
        console.log('[CartContext] 💰 New totals:', { totalItems, totalPrice: totalPrice / 100 });
      }

      await saveCarts(newCarts);
      console.log('[CartContext] ✅ Cart updated and saved');
    } else {
      console.log('[CartContext] ⚠️ Item not found in cart:', itemId);
    }
  };

  const deleteShopCart = async (shopId: string) => {
    const newCarts = { ...carts };
    delete newCarts[shopId];
    await saveCarts(newCarts);
  };

  const getShopCart = (shopId: string): ShopCart | null => {
    return carts[shopId] || null;
  };

  const getAllCarts = (): ShopCart[] => {
    return Object.values(carts);
  };

  const clearAllCarts = async () => {
    await saveCarts({});
  };

  const value: CartContextType = {
    carts,
    loading,
    addItemToCart,
    addItemToCartWithQuantity,
    removeItemFromCart,
    updateItemQuantity,
    deleteShopCart,
    getShopCart,
    getAllCarts,
    clearAllCarts,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

