/**
 * Function Router
 * 
 * Routes OpenAI function calls to appropriate service functions.
 * Executes cart manipulation, shop search, and order placement actions.
 */

import { searchItemsInShop } from './inventorySearchRAG';
import { intelligentSearch, formatIntelligentSearchResultsForLLM, type SearchProgress } from './intelligentSearchService';
import { validateItemsStock, validateItemStock } from '../consumer/stockValidationService';
import { placeOrder } from '../consumer/orderService';
import type { ShopCart } from '../../context/CartContext';
import type { ShopItem } from '../consumer/shopService';

import { calculateDistance, calculateTotalDeliveryFee, fetchDeliveryLogic } from '../merchant/deliveryLogicService';
import type { ConsumerAddress } from '../consumer/addressService';
import { createAddress } from '../consumer/addressService';
import { validateCartOrderValue, validateDeliveryAddress, fetchShopDetails } from '../consumer/shopService';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';

/**
 * Logging utilities for function calls
 */
function logFunctionCall(functionName: string, args: any): void {
  console.log(`[FunctionRouter] 🔵 Calling: ${functionName}`);

  switch (functionName) {
    case 'intelligentSearch':
    case 'searchItemsInShop':
      if (args.query) {
        console.log(`  📝 Query: "${args.query}"`);
      }
      break;

    case 'addItemsToCart':
      if (Array.isArray(args.items)) {
        console.log(`  🛒 Adding ${args.items.length} item(s) to cart:`);
        args.items.forEach((item: any, idx: number) => {
          console.log(`    ${idx + 1}. Item ID: ${item.itemId}, Quantity: ${item.quantity || 1}`);
        });
      }
      break;
    case 'addItemToCart':
      if (args.itemId) {
        console.log(`  🛒 Adding item to cart: ${args.itemId}, Quantity: ${args.quantity || 1}`);
      }
      break;

    case 'removeItemFromCart':
      console.log(`  🗑️  Removing item: ${args.itemId}${args.quantity ? ` (Quantity: ${args.quantity})` : ''}`);
      break;

    case 'updateItemQuantity':
      console.log(`  🔢 Updating quantity: Item ${args.itemId} → ${args.quantity}`);
      break;

    case 'placeOrder':
      console.log(`  📦 Placing order for shop: ${args.shopId}`);
      if (args.specialInstructions) {
        console.log(`  📝 Special instructions: ${args.specialInstructions}`);
      }
      break;

    case 'getCart':
    case 'getAllCarts':
      console.log(`  🛒 Retrieving cart(s)`);
      break;
  }
}

function logFunctionResult(functionName: string, result: FunctionCallResult, args?: any): void {
  if (!result.success) {
    console.log(`[FunctionRouter] ❌ ${functionName} failed: ${result.error}`);
    return;
  }

  console.log(`[FunctionRouter] ✅ ${functionName} succeeded`);

  switch (functionName) {
    case 'intelligentSearch':
    case 'searchItemsInShop':
      if (result.result?.items) {
        const items = Array.isArray(result.result.items) ? result.result.items : [];
        console.log(`  📊 Found ${items.length} item(s)`);
        if (items.length > 0) {
          console.log(`  🔍 Top results:`);
          items.slice(0, 5).forEach((item: any, idx: number) => {
            console.log(`    ${idx + 1}. ${item.name || item.itemName || 'Unknown'} (${item.shopName || 'Shop'})`);
          });
        }
      }
      break;

    case 'addItemsToCart':
    case 'addItemToCart':
      if (result.result?.added) {
        const added = Array.isArray(result.result.added) ? result.result.added : [];
        console.log(`  ✅ Added ${added.length} item(s) to cart:`);
        added.forEach((item: any, idx: number) => {
          console.log(`    ${idx + 1}. ${item.name || 'Unknown'} × ${item.quantity} (Shop: ${item.shopName || 'Unknown'})`);
        });
      }
      if (result.result?.carts) {
        const carts = Array.isArray(result.result.carts) ? result.result.carts : [];
        carts.forEach((cart: any) => {
          console.log(`  🛒 Cart total: ${cart.totalPrice / 100} PKR (${cart.totalItems} items)`);
        });
      }
      break;

    case 'removeItemFromCart':
      if (result.result?.cart) {
        const cart = result.result.cart;
        console.log(`  ✅ Removed item. Cart now has ${cart.totalItems} item(s), Total: ${cart.totalPrice / 100} PKR`);
      }
      break;

    case 'updateItemQuantity':
      if (result.result?.quantity) {
        console.log(`  ✅ Updated quantity to ${result.result.quantity}`);
      }
      if (result.result?.cart) {
        const cart = result.result.cart;
        console.log(`  🛒 Cart total: ${cart.totalPrice / 100} PKR (${cart.totalItems} items)`);
      }
      break;

    case 'placeOrder':
      if (result.result?.order) {
        const order = result.result.order;
        console.log(`  ✅ Order placed! Order #${order.order_number || order.id}`);
      }
      break;

    case 'getCart':
    case 'getAllCarts':
      if (result.result?.carts) {
        const carts = Array.isArray(result.result.carts) ? result.result.carts : [];
        console.log(`  🛒 Retrieved ${carts.length} cart(s)`);
        carts.forEach((cart: any) => {
          console.log(`    - ${cart.shopName}: ${cart.totalItems} items, ${cart.totalPrice / 100} PKR`);
        });
      }
      break;
  }
}

export interface FunctionExecutionContext {
  // Cart operations
  addItemToCartFn: (shopId: string, item: ShopItem, shopDetails: any) => Promise<void>;
  addItemToCartWithQuantityFn: (shopId: string, item: ShopItem, quantity: number, shopDetails: any) => Promise<void>;
  removeItemFromCartFn: (shopId: string, itemId: string) => Promise<void>;
  updateItemQuantityFn: (shopId: string, itemId: string, quantity: number) => Promise<void>;
  getShopCartFn: (shopId: string) => ShopCart | null;
  getAllCartsFn: () => ShopCart[];
  deleteShopCartFn?: (shopId: string) => Promise<void>;

  // Location & Address
  getCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>;
  getDefaultAddressId: () => Promise<string | null>;
  currentAddress?: ConsumerAddress; // Inject current selected address

  // Shop/Item lookup
  getShopDetailsFn?: (shopId: string) => Promise<any>;
  getItemDetailsFn?: (itemId: string, shopId: string) => Promise<ShopItem | null>;

  // Progress callbacks
  onProgress?: (progress: SearchProgress) => void;
}
export interface FunctionCallResult {
  success: boolean;
  result?: any;
  error?: string;
  // Additional fields for error handling (e.g., to show cart again)
  cart?: CartResultPayload | null;
  carts?: CartResultPayload[];
  address?: any;
}

export type CartResultPayload = {
  shopId: string;
  shopName: string;
  shopImage?: string;
  shopAddress?: string;
  shopLatitude?: number | null;
  shopLongitude?: number | null;
  totalItems: number;
  totalPrice: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price_cents: number;
  }>;
  deliveryLogic?: any;
};

function mapCartToResult(cart: ShopCart | null): CartResultPayload | null {
  if (!cart) return null;

  return {
    shopId: cart.shopId,
    shopName: cart.shopName,
    shopImage: cart.shopImage,
    shopAddress: cart.shopAddress,
    shopLatitude: cart.shopLatitude ?? null,
    shopLongitude: cart.shopLongitude ?? null,
    deliveryLogic: cart.deliveryLogic,
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice,
    items: cart.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price_cents: item.price_cents,
    })),
  };
}

/**
 * Route and execute a function call
 */
export async function executeFunctionCall(
  functionName: string,
  args: Record<string, any>,
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  // Log function call
  logFunctionCall(functionName, args);

  try {
    let result: FunctionCallResult;

    switch (functionName) {
      case 'intelligentSearch':
        result = await executeIntelligentSearch(args as { query: string; maxShops?: number; itemsPerShop?: number }, context);
        break;

      case 'searchItemsInShop':
        result = await executeSearchItemsInShop(args as { shopId: string; query: string; limit?: number }, context);
        break;

      case 'addItemsToCart':
        result = await executeAddItemsToCart(args as { items: Array<{ shopId: string; itemId: string; quantity?: number }> }, context);
        break;

      case 'addItemToCart':
        result = await executeAddItemToCart(args as { shopId: string; itemId: string; quantity?: number }, context);
        break;

      case 'removeItemFromCart':
        result = await executeRemoveItemFromCart(args as { shopId: string; itemId: string; quantity?: number }, context);
        break;

      case 'updateItemQuantity':
        result = await executeUpdateItemQuantity(args as { shopId: string; itemId: string; quantity: number }, context);
        break;

      case 'getCart':
        result = await executeGetCart(args as { shopId: string }, context);
        break;

      case 'getAllCarts':
        result = await executeGetAllCarts(args, context);
        break;

      case 'placeOrder':
        result = await executePlaceOrder(args as { shopId: string; addressId?: string; specialInstructions?: string }, context);
        break;

      default:
        result = {
          success: false,
          error: `Unknown function: ${functionName}`,
        };
        break;
    }

    // Log function result
    logFunctionResult(functionName, result, args);

    return result;
  } catch (error: any) {
    console.error(`[FunctionRouter] ❌ Error executing ${functionName}:`, error);
    const errorResult: FunctionCallResult = {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };
    logFunctionResult(functionName, errorResult, args);
    return errorResult;
  }
}

/**
 * Execute intelligentSearch function
 */
async function executeIntelligentSearch(
  args: { query: string; maxShops?: number; itemsPerShop?: number },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const location = await context.getCurrentLocation();

    if (!location) {
      return {
        success: false,
        error: 'User location not available. Please enable location services.',
      };
    }

    const result = await intelligentSearch(
      args.query,
      location.latitude,
      location.longitude,
      {
        maxShops: args.maxShops || 10,
        itemsPerShop: args.itemsPerShop || 10,
        onProgress: context.onProgress,
      }
    );

    if (result.error) {
      const rawError = result.error;
      const errorMessage =
        typeof rawError === 'string'
          ? rawError
          : (rawError as any)?.message || 'Failed to perform intelligent search';
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Format results for LLM
    const formattedResults = result.data
      ? formatIntelligentSearchResultsForLLM(result.data)
      : 'No results found';

    return {
      success: true,
      result: {
        shops: result.data?.results.map((r) => ({
          shop: {
            id: r.shop.id,
            name: r.shop.name,
            address: r.shop.address,
            delivery_fee: r.shop.delivery_fee,
          },
          items: r.matchingItems.map((item) => ({
            id: item.merchant_item_id,
            shopId: r.shop.id,
            name: item.item_name,
            price_cents: item.price_cents,
            similarity: item.similarity,
            image_url: item.item_image_url,
          })),
          categoryMatches: r.categoryMatches,
          relevanceScore: r.relevanceScore,
        })) || [],
        formattedText: formattedResults,
        reasoning: result.data?.reasoning || '',
        intent: result.data?.intent,
        // Include extracted items with quantities for LLM to use when adding to cart
        extractedItems: result.data?.intent?.extractedItems || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to perform intelligent search',
    };
  }
}

/**
 * Execute searchItemsInShop function
 */
async function executeSearchItemsInShop(
  args: { shopId: string; query: string; limit?: number },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const result = await searchItemsInShop(args.shopId, args.query, {
      limit: args.limit || 5,
    });

    if (result.error) {
      const rawError = result.error;
      const errorMessage =
        typeof rawError === 'string'
          ? rawError
          : (rawError as any)?.message || 'Failed to search items';
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      result: {
        items: result.data?.map((item) => ({
          id: item.merchant_item_id,
          name: item.item_name,
          description: item.item_description,
          price_cents: item.price_cents,
          similarity: item.similarity,
          image_url: item.item_image_url,
        })) || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to search items',
    };
  }
}

/**
 * Execute addItemsToCart function (batch add) - Parallelized Version
 */
async function executeAddItemsToCart(
  args: { items: Array<{ shopId: string; itemId: string; quantity?: number }> },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    // Cache to prevent fetching the same shop details multiple times
    const shopDetailsCache = new Map<string, any>();

    // Define the unit of work (The "Worker")
    const processItem = async (item: { shopId: string; itemId: string; quantity?: number }): Promise<{
      success: boolean;
      itemId: string;
      error?: string;
      reason?: string;
      data?: {
        itemId: string;
        name: string;
        quantity: number;
        shopId: string;
        shopName: string;
        price_cents: number;
        image_url?: string;
      };
    }> => {
      try {
        // A. Fetch Item Data
        let shopItem: ShopItem | null = null;

        if (context.getItemDetailsFn) {
          shopItem = await context.getItemDetailsFn(item.itemId, item.shopId);
        }

        if (!shopItem) {
          console.log(`  ❌ Item ${item.itemId} not found - skipping`);
          return {
            success: false,
            itemId: item.itemId,
            error: `Item with ID ${item.itemId} not found`,
            reason: 'not_found',
          };
        }

        // B. Validate Stock
        const stockValidation = await validateItemStock(item.itemId);
        if (stockValidation.error || !stockValidation.data?.isValid) {
          console.log(`  ❌ Item ${item.itemId} not available - skipping`);
          return {
            success: false,
            itemId: item.itemId,
            error: stockValidation.data?.reason || 'Item is not available',
            reason: 'out_of_stock',
          };
        }

        // C. Fetch Shop Details (With Caching)
        let shopDetails: any = {};
        if (context.getShopDetailsFn) {
          if (shopDetailsCache.has(item.shopId)) {
            shopDetails = shopDetailsCache.get(item.shopId);
          } else {
            // Fetch and cache shop details
            shopDetails = await context.getShopDetailsFn(item.shopId);
            shopDetailsCache.set(item.shopId, shopDetails);
          }
        }

        // D. Perform the Action
        const quantity = item.quantity || 1;
        console.log(`  ➕ Adding: "${shopItem.name}" × ${quantity}`);
        await context.addItemToCartWithQuantityFn(item.shopId, shopItem, quantity, shopDetails);

        return {
          success: true,
          itemId: item.itemId,
          data: {
            itemId: item.itemId,
            name: shopItem.name,
            quantity,
            shopId: item.shopId,
            shopName: shopDetails.name || 'Shop',
            price_cents: shopItem.price_cents,
            image_url: shopItem.image_url || undefined,
          },
        };
      } catch (e: any) {
        return {
          success: false,
          itemId: item.itemId,
          error: e.message || 'Failed to add item',
          reason: 'error',
        };
      }
    };

    console.log(`[FunctionRouter] 🚀 Launching parallel add for ${args.items.length} items`);

    // SCATTER: Fire all requests in parallel
    const operations = args.items.map(item => processItem(item));

    // GATHER: Wait for all to finish
    const results = await Promise.all(operations);

    // Process Results (Filter successes vs failures)
    const successfulAdds = results
      .filter(r => r.success && r.data)
      .map(r => r.data!);

    const failures = results.filter(r => !r.success);

    const successCount = successfulAdds.length;
    const failCount = failures.length;

    console.log(`[FunctionRouter] ✅ Finished: ${successCount} added, ${failCount} failed`);

    // Build addedItems array and track shop IDs
    const addedItems: Array<{ itemId: string; name: string; quantity: number; shopId: string; shopName: string; price_cents: number; image_url?: string }> = successfulAdds;
    const shopIds = new Set<string>(successfulAdds.map(item => item.shopId));
    const addedTotalsByShop: Record<string, number> = {};
    successfulAdds.forEach(item => {
      addedTotalsByShop[item.shopId] = (addedTotalsByShop[item.shopId] || 0) + (item.price_cents * item.quantity);
    });

    // Build cart summaries - ALWAYS build from added items as source of truth
    // The UI component will sync with live cart context for real-time updates
    const cartSummaries: CartResultPayload[] = [];
    
    // Group added items by shop
    const itemsByShop = new Map<string, typeof addedItems>();
    addedItems.forEach(item => {
      if (!itemsByShop.has(item.shopId)) {
        itemsByShop.set(item.shopId, []);
      }
      itemsByShop.get(item.shopId)!.push(item);
    });

    for (const shopId of Array.from(shopIds)) {
      const shopAddedItems = itemsByShop.get(shopId) || [];
      
      // Try to get shop details from cart context first
      const cart = context.getShopCartFn(shopId);
      
      if (cart) {
        const cartPayload = mapCartToResult(cart);
        if (cartPayload) {
          cartSummaries.push(cartPayload);
        }
      } else if (shopAddedItems.length > 0) {
        // Build from added items - this ensures UI shows something even if context hasn't updated
        // Get shop details from cache first, then fallback to fetching
        let shopDetails: any = {
          name: shopAddedItems[0].shopName,
        };
        
        // Try to use cached shop details first
        if (shopDetailsCache.has(shopId)) {
          const cachedDetails = shopDetailsCache.get(shopId);
          shopDetails = {
            name: cachedDetails.name || shopAddedItems[0].shopName,
            image: cachedDetails.image_url,
            address: cachedDetails.address,
            latitude: cachedDetails.latitude,
            longitude: cachedDetails.longitude,
            deliveryLogic: cachedDetails.deliveryLogic,
          };
        } else if (context.getShopDetailsFn) {
          // Fallback to fetching if not in cache
          try {
            const details = await context.getShopDetailsFn(shopId);
            if (details) {
              shopDetails = {
                name: details.name || shopAddedItems[0].shopName,
                image: details.image_url,
                address: details.address,
                latitude: details.latitude,
                longitude: details.longitude,
                deliveryLogic: details.deliveryLogic,
              };
              // Cache for potential future use
              shopDetailsCache.set(shopId, details);
            }
          } catch (e) {
            console.warn(`[FunctionRouter] Failed to fetch shop details for ${shopId}:`, e);
          }
        }
        
        const fallbackCart: CartResultPayload = {
          shopId: shopId,
          shopName: shopDetails.name,
          shopImage: shopDetails.image,
          shopAddress: shopDetails.address,
          shopLatitude: shopDetails.latitude ?? null,
          shopLongitude: shopDetails.longitude ?? null,
          deliveryLogic: shopDetails.deliveryLogic,
          totalItems: shopAddedItems.reduce((sum, item) => sum + item.quantity, 0),
          totalPrice: shopAddedItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0),
          items: shopAddedItems.map(item => ({
            id: item.itemId,
            name: item.name,
            quantity: item.quantity,
            price_cents: item.price_cents,
            image_url: item.image_url,
          })),
        };
        
        cartSummaries.push(fallbackCart);
      }
    }

    // Calculate delivery info for each shop
    const deliveryInfos: Record<string, any> = {};

    if (context.currentAddress) {
      for (const cartSummary of cartSummaries) {
        try {
          const { data: deliveryLogic } = await fetchDeliveryLogic(cartSummary.shopId);

          if (deliveryLogic && cartSummary.shopLatitude && cartSummary.shopLongitude) {
            // Calculate distance
            const distanceInMeters = calculateDistance(
              context.currentAddress.latitude,
              context.currentAddress.longitude,
              cartSummary.shopLatitude,
              cartSummary.shopLongitude
            );

            const orderValue = cartSummary.totalPrice / 100;
            const deliveryCalculation = calculateTotalDeliveryFee(
              orderValue,
              distanceInMeters,
              deliveryLogic
            );

            deliveryInfos[cartSummary.shopId] = {
              // Store all monetary values in cents so UI components can
              // consistently divide by 100 for display.
              deliveryFee: Math.round(deliveryCalculation.baseFee * 100),
              surcharge: Math.round(deliveryCalculation.surcharge * 100),
              freeDeliveryApplied: deliveryCalculation.freeDeliveryApplied,
              total: cartSummary.totalPrice + Math.round(deliveryCalculation.finalFee * 100),
              cartSubtotal: cartSummary.totalPrice,
              addedSubtotal: addedTotalsByShop[cartSummary.shopId] || 0,
            };
          }
        } catch (e) {
          console.error(`[FunctionRouter] ❌ Error calculating delivery for shop ${cartSummary.shopId}:`, e);
        }
      }
    }

    // Build failed items array with detailed error information
    const failedItems = failures.map(f => ({
      itemId: f.itemId,
      error: f.error || 'Unknown error',
      reason: f.reason || 'error',
    }));

    // Multi-shop delivery warning
    const multiShopWarning = shopIds.size > 1 ? {
      shopCount: shopIds.size,
      shopIds: Array.from(shopIds),
      message: `These items are from ${shopIds.size} different shops, so there will be separate delivery fees for each.`,
    } : undefined;

    return {
      success: successCount > 0,
      result: {
        added: addedItems,
        failed: failedItems,
        summary: failCount > 0
          ? `Successfully added ${successCount} item(s), ${failCount} failed`
          : `Successfully added ${successCount} item(s)`,
        details: results.map(r => ({
          success: r.success,
          itemId: r.itemId,
          error: r.error,
        })),
        deliveryInfos,
        address: context.currentAddress,
        carts: cartSummaries,
        cart: cartSummaries[0] || null,
        multiShopWarning,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to add items to cart',
    };
  }
}

/**
 * Execute addItemToCart function
 */
async function executeAddItemToCart(
  args: { shopId: string; itemId: string; quantity?: number },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  // Redirect to batch add for consistency
  return executeAddItemsToCart({
    items: [{ shopId: args.shopId, itemId: args.itemId, quantity: args.quantity }]
  }, context);
}

/**
 * Execute removeItemFromCart function
 */
async function executeRemoveItemFromCart(
  args: { shopId: string; itemId: string; quantity?: number },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const cart = context.getShopCartFn(args.shopId);

    if (!cart) {
      return {
        success: false,
        error: 'Cart not found for this shop',
      };
    }

    const item = cart.items.find((i) => i.id === args.itemId);

    if (!item) {
      return {
        success: false,
        error: 'Item not found in cart',
      };
    }

    // Log which item is being removed
    console.log(`  ➖ Removing: "${item.name}" (ID: ${args.itemId})${args.quantity ? ` × ${args.quantity}` : ' (all)'}`);

    if (args.quantity && args.quantity < item.quantity) {
      // Reduce quantity
      await context.updateItemQuantityFn(args.shopId, args.itemId, item.quantity - args.quantity);
    } else {
      // Remove completely
      await context.removeItemFromCartFn(args.shopId, args.itemId);
    }

    const updatedCart = mapCartToResult(context.getShopCartFn(args.shopId));

    return {
      success: true,
      result: {
        message: `Removed ${args.itemId} from cart`,
        cart: updatedCart,
        carts: updatedCart ? [updatedCart] : [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to remove item from cart',
    };
  }
}

/**
 * Execute updateItemQuantity function
 */
async function executeUpdateItemQuantity(
  args: { shopId: string; itemId: string; quantity: number },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    if (args.quantity < 1) {
      return {
        success: false,
        error: 'Quantity must be at least 1',
      };
    }

    // Get current item to log name
    const cart = context.getShopCartFn(args.shopId);
    const item = cart?.items.find((i) => i.id === args.itemId);
    if (item) {
      console.log(`  🔢 Updating: "${item.name}" (ID: ${args.itemId}) → Quantity: ${args.quantity}`);
    }

    await context.updateItemQuantityFn(args.shopId, args.itemId, args.quantity);

    const updatedCart = mapCartToResult(context.getShopCartFn(args.shopId));

    return {
      success: true,
      result: {
        message: `Updated quantity to ${args.quantity}`,
        quantity: args.quantity,
        cart: updatedCart,
        carts: updatedCart ? [updatedCart] : [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to update item quantity',
    };
  }
}

/**
 * Execute getCart function
 */
async function executeGetCart(
  args: { shopId: string },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const cart = context.getShopCartFn(args.shopId);

    const formattedCart = mapCartToResult(cart);

    if (!formattedCart) {
      return {
        success: true,
        result: {
          cart: null,
          carts: [],
          message: 'Cart is empty',
        },
      };
    }

    return {
      success: true,
      result: {
        cart: formattedCart,
        carts: [formattedCart],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to get cart',
    };
  }
}

/**
 * Execute getAllCarts function
 */
async function executeGetAllCarts(
  args: {},
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const carts = context.getAllCartsFn();

    return {
      success: true,
      result: {
        carts: carts.map((cart) => ({
          shopId: cart.shopId,
          shopName: cart.shopName,
          itemCount: cart.totalItems,
          totalPrice: cart.totalPrice,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to get all carts',
    };
  }
}

/**
 * Execute placeOrder function
 */
async function executePlaceOrder(
  args: { shopId: string; addressId?: string; specialInstructions?: string },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const cart = context.getShopCartFn(args.shopId);

    if (!cart || cart.items.length === 0) {
      return {
        success: false,
        error: 'Cart is empty',
      };
    }

    // ALWAYS use the address from AddedToCartSummary (context.currentAddress)
    // This includes coordinates, georeversed address, and landmark entered by user
    if (!context.currentAddress) {
      return {
        success: false,
        error: 'No delivery address selected. Please select an address first.',
      };
    }

    // Validate we have coordinates
    if (!context.currentAddress.latitude || !context.currentAddress.longitude) {
      return {
        success: false,
        error: 'Address coordinates are missing. Please select a valid address.',
      };
    }

    // Get landmark from currentAddress (entered by user in AddedToCartSummary)
    const landmark = context.currentAddress.landmark?.trim();

    // Validate landmark is present BEFORE creating address
    if (!landmark || landmark.length < 3) {
      // Return cart data so UI can show it again with landmark input
      const cartSummary = mapCartToResult(cart);
      return {
        success: false,
        error: 'Please provide a nearby landmark so the rider can easily find you. You can add it in the cart summary above.',
        cart: cartSummary,
        carts: cartSummary ? [cartSummary] : [],
        address: context.currentAddress,
      };
    }

    // Validate delivery zone BEFORE creating address
    const deliveryValidation = await validateDeliveryAddress(
      args.shopId,
      context.currentAddress.latitude,
      context.currentAddress.longitude
    );
    
    if (deliveryValidation.error) {
      console.warn('[FunctionRouter] Delivery validation error:', deliveryValidation.error);
      return {
        success: false,
        error: 'Unable to validate delivery address. Please try again.',
      };
    }
    
    if (deliveryValidation.data && !deliveryValidation.data.isWithinDeliveryZone) {
      return {
        success: false,
        error: 'Your selected address is outside this shop\'s delivery area. Please choose a different address or shop.',
      };
    }

    // Create a new address from the current address (coordinates, georeversed address, and landmark)
    // This is a temporary address for ordering, not saved to user's address book
    let addressId: string | undefined;
    try {
      const creation = await createAddress({
        street_address: context.currentAddress.street_address || 'Current Location',
        city: context.currentAddress.city || 'Unknown',
        region: context.currentAddress.region || undefined,
        latitude: context.currentAddress.latitude,
        longitude: context.currentAddress.longitude,
        landmark: landmark, // Landmark entered by user in AddedToCartSummary
        formatted_address: context.currentAddress.formatted_address || context.currentAddress.street_address,
      });

      if (creation.data) {
        addressId = creation.data.id;
      } else if (creation.error) {
        console.error('[FunctionRouter] Failed to create address from current location:', creation.error.message);
        return {
          success: false,
          error: `Failed to create delivery address: ${creation.error.message}`,
        };
      }
    } catch (addressError: any) {
      console.error('[FunctionRouter] Exception while creating address:', addressError);
      return {
        success: false,
        error: `Failed to create delivery address: ${addressError?.message || 'Unknown error'}`,
      };
    }

    if (!addressId) {
      return {
        success: false,
        error: 'Failed to create delivery address. Please try again.',
      };
    }

    // Validate item availability
    const itemIds = cart.items.map(item => item.id);
    const stockValidation = await validateItemsStock(itemIds);
    if (stockValidation.error) {
      return {
        success: false,
        error: 'Unable to verify item availability. Please try again.',
      };
    }
    if (stockValidation.data) {
      const invalidItems = stockValidation.data.filter(item => !item.isValid);
      if (invalidItems.length > 0) {
        const itemNames = invalidItems.map(item => item.itemName).join(', ');
        return {
          success: false,
          error: `Some items are no longer available: ${itemNames}. Please remove them from your cart.`,
        };
      }
    }

    // Delivery zone validation already done above before creating address

    // Validate shop open status
    const shopDetailsResult = await fetchShopDetails(args.shopId);
    if (shopDetailsResult.error) {
      console.warn('[FunctionRouter] Failed to fetch shop details:', shopDetailsResult.error);
    } else if (shopDetailsResult.data) {
      const openingStatus = getCurrentOpeningStatus({
        opening_hours: shopDetailsResult.data.opening_hours,
        holidays: shopDetailsResult.data.holidays,
        open_status_mode: shopDetailsResult.data.open_status_mode,
      });
      if (!openingStatus.isOpen) {
        let errorMessage = 'This shop is currently closed.';
        if (openingStatus.reason === 'holiday' && openingStatus.holidayDescription) {
          errorMessage = `This shop is closed: ${openingStatus.holidayDescription}`;
        } else if (openingStatus.reason === 'outside_hours') {
          errorMessage = 'This shop is currently closed. Please check the opening hours.';
        } else if (openingStatus.reason === 'manual_closed') {
          errorMessage = 'This shop is temporarily closed.';
        }
        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    // Validate minimum order value
    const validationResult = await validateCartOrderValue(args.shopId, cart.totalPrice);
    if (validationResult.error) {
      console.warn('[FunctionRouter] Cart validation error:', validationResult.error);
    } else if (validationResult.data && !validationResult.data.meetsMinimumOrder) {
      return {
        success: false,
        error: validationResult.data.message || 'Order value is below the shop minimum. Please add more items.',
      };
    }

    // Validate and recalculate totals to ensure accuracy
    if (context.currentAddress?.latitude && context.currentAddress?.longitude && shopDetailsResult.data) {
      try {
        const deliveryLogic = shopDetailsResult.data.deliveryLogic || await fetchDeliveryLogic(args.shopId).then(r => r.data);
        if (deliveryLogic && shopDetailsResult.data.latitude && shopDetailsResult.data.longitude) {
          const distance = calculateDistance(
            context.currentAddress.latitude,
            context.currentAddress.longitude,
            shopDetailsResult.data.latitude,
            shopDetailsResult.data.longitude
          );
          const orderValue = cart.totalPrice / 100;
          const calculation = calculateTotalDeliveryFee(orderValue, distance, deliveryLogic);
          const expectedTotal = cart.totalPrice + Math.round(calculation.baseFee * 100) + Math.round(calculation.surcharge * 100);

          // Note: We don't block the order if totals don't match exactly, but we log it
          console.log('[FunctionRouter] Order totals validation:', {
            cartTotal: cart.totalPrice,
            expectedTotal,
            deliveryFee: calculation.baseFee,
            surcharge: calculation.surcharge,
          });
        }
      } catch (calcError) {
        console.warn('[FunctionRouter] Failed to validate totals:', calcError);
        // Don't block order placement if calculation fails
      }
    }

    // Place order
    const orderItems = cart.items.map((item) => ({
      merchant_item_id: item.id,
      quantity: item.quantity,
    }));

    // Don't use specialInstructions - landmark is already in the address
    const orderResult = await placeOrder({
      shop_id: args.shopId,
      consumer_address_id: addressId,
      items: orderItems,
      payment_method: 'cash',
      special_instructions: undefined, // Landmark is in address, no need for special instructions
    });

    if (!orderResult.success || !orderResult.order) {
      return {
        success: false,
        error: orderResult.message || 'Failed to place order',
      };
    }

    if (context.deleteShopCartFn) {
      try {
        await context.deleteShopCartFn(args.shopId);
      } catch (cleanupError) {
        console.warn('[FunctionRouter] Failed to clear cart after order placement:', cleanupError);
      }
    }

    return {
      success: true,
      result: {
        order: {
          id: orderResult.order.id,
          order_number: orderResult.order.order_number,
          status: orderResult.order.status,
        },
        message: `Order placed successfully! Order #${orderResult.order.order_number}`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Failed to place order',
    };
  }
}

