/**
 * Function Router
 * 
 * Routes OpenAI function calls to appropriate service functions.
 * Executes cart manipulation, shop search, and order placement actions.
 */

import { searchItemsInShop } from './inventorySearchRAG';
import { intelligentSearch, formatIntelligentSearchResultsForLLM } from './intelligentSearchService';
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
 * Execute addItemsToCart function (batch add)
 */
async function executeAddItemsToCart(
  args: { items: Array<{ shopId: string; itemId: string; quantity?: number }> },
  context: FunctionExecutionContext
): Promise<FunctionCallResult> {
  try {
    const results: Array<{ success: boolean; itemId: string; error?: string }> = [];
    const addedItems: Array<{ itemId: string; name: string; quantity: number; shopId: string; shopName: string; price_cents: number; image_url?: string }> = [];
    const shopIds = new Set<string>();
    const addedTotalsByShop: Record<string, number> = {};

    for (const item of args.items) {
      try {
        // Get item details first
        let shopItem: ShopItem | null = null;

        if (context.getItemDetailsFn) {
          shopItem = await context.getItemDetailsFn(item.itemId, item.shopId);
        }

        if (!shopItem) {
          console.log(`  ❌ Item ${item.itemId} not found - skipping`);
          results.push({
            success: false,
            itemId: item.itemId,
            error: `Item with ID ${item.itemId} not found`,
          });
          continue;
        }
        
        // Log which item is being added (with name)
        console.log(`  ➕ Adding: "${shopItem.name}" (ID: ${item.itemId}) × ${item.quantity || 1}`);

        // Validate stock
        const stockValidation = await validateItemStock(item.itemId);
        if (stockValidation.error || !stockValidation.data?.isValid) {
          results.push({
            success: false,
            itemId: item.itemId,
            error: stockValidation.data?.reason || 'Item is not available',
          });
          continue;
        }

        // Get shop details
        let shopDetails: any = {};
        if (context.getShopDetailsFn) {
          shopDetails = await context.getShopDetailsFn(item.shopId);
        }

        // Add to cart
        await context.addItemToCartFn(item.shopId, shopItem, shopDetails);

        // Update quantity if needed
        const quantity = item.quantity || 1;
        if (quantity > 1) {
          await context.updateItemQuantityFn(item.shopId, item.itemId, quantity);
        }

        addedItems.push({
          itemId: item.itemId,
          name: shopItem.name,
          quantity,
          shopId: item.shopId,
          shopName: shopDetails.name || 'Shop',
          price_cents: shopItem.price_cents,
          image_url: shopItem.image_url || undefined,
        });

        shopIds.add(item.shopId);
        addedTotalsByShop[item.shopId] = (addedTotalsByShop[item.shopId] || 0) + (shopItem.price_cents * quantity);

        results.push({
          success: true,
          itemId: item.itemId,
        });
      } catch (error: any) {
        results.push({
          success: false,
          itemId: item.itemId,
          error: error?.message || 'Failed to add item',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    // Calculate delivery info for the first shop (assuming single shop for now or primary shop)
    // If multiple shops, we might need a more complex structure, but AddedToCartSummary handles multiple shops.
    // We'll calculate delivery for each shop involved.
    const deliveryInfos: Record<string, any> = {};

    if (context.currentAddress) {
      for (const shopId of Array.from(shopIds)) {
        try {
          const { data: deliveryLogic } = await fetchDeliveryLogic(shopId);
          const cart = context.getShopCartFn(shopId);

          if (deliveryLogic && cart) {
            // Calculate distance
            let distanceInMeters = 0;
            if (cart.shopLatitude && cart.shopLongitude) {
              distanceInMeters = calculateDistance(
                context.currentAddress.latitude,
                context.currentAddress.longitude,
                cart.shopLatitude,
                cart.shopLongitude
              );
            }

            const orderValue = cart.totalPrice / 100;
            const deliveryCalculation = calculateTotalDeliveryFee(
              orderValue,
              distanceInMeters,
              deliveryLogic
            );

            deliveryInfos[shopId] = {
              // Store all monetary values in cents so UI components can
              // consistently divide by 100 for display.
              deliveryFee: Math.round(deliveryCalculation.baseFee * 100),
              surcharge: Math.round(deliveryCalculation.surcharge * 100),
              freeDeliveryApplied: deliveryCalculation.freeDeliveryApplied,
              total: cart.totalPrice + Math.round(deliveryCalculation.finalFee * 100),
              cartSubtotal: cart.totalPrice,
              addedSubtotal: addedTotalsByShop[shopId] || 0,
            };
          }
        } catch (e) {
          console.error('Error calculating delivery for shop', shopId, e);
        }
      }
    }

    // Small delay to ensure cart context is updated
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Fetch carts again to ensure we have the latest state
    const cartSummaries = Array.from(shopIds)
      .map((shopId) => {
        const cart = context.getShopCartFn(shopId);
        console.log(`[FunctionRouter] Getting cart for shop ${shopId}:`, cart ? `${cart.totalItems} items, ${cart.totalPrice} cents` : 'null');
        return mapCartToResult(cart);
      })
      .filter((cart): cart is CartResultPayload => Boolean(cart));

    console.log(`[FunctionRouter] Returning ${cartSummaries.length} cart(s) in response`);

    // Always return carts if we have added items, even if cartSummaries is empty initially
    // The UI will show the cart banner with added items
    return {
      success: successCount > 0,
      result: {
        added: addedItems,
        summary: `Successfully added ${successCount} item(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
        details: results,
        deliveryInfos,
        address: context.currentAddress,
        carts: cartSummaries.length > 0 ? cartSummaries : undefined,
        cart: cartSummaries[0] || null,
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

    // Get address ID
    let addressId = args.addressId;

    // If LLM passed an obviously invalid ID (e.g. "temp"), ignore it
    // and fall back to the user's saved default address.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (addressId && !uuidRegex.test(addressId)) {
      addressId = undefined;
    }

    if (!addressId) {
      const defaultAddressId = await context.getDefaultAddressId();
      addressId = defaultAddressId || undefined;
    }

    // Validate landmark - check both address and specialInstructions
    let landmark = context.currentAddress?.landmark?.trim();
    
    // If landmark is in specialInstructions, extract it
    if (!landmark && args.specialInstructions) {
      const landmarkMatch = args.specialInstructions.match(/(?:landmark|near|nearby)[:\s]+([^,\.]+)/i);
      if (landmarkMatch && landmarkMatch[1]) {
        landmark = landmarkMatch[1].trim();
      } else if (args.specialInstructions.length < 100) {
        // If specialInstructions is short, treat it as landmark
        landmark = args.specialInstructions.trim();
      }
    }
    
    if (!addressId && context.currentAddress && context.currentAddress.latitude && context.currentAddress.longitude) {
      try {
        const creation = await createAddress({
          street_address: context.currentAddress.street_address || context.currentAddress.formatted_address || 'Current Location',
          city: context.currentAddress.city || 'Unknown',
          region: context.currentAddress.region || undefined,
          latitude: context.currentAddress.latitude,
          longitude: context.currentAddress.longitude,
          landmark: landmark || context.currentAddress.landmark || undefined,
          formatted_address: context.currentAddress.formatted_address || context.currentAddress.street_address,
        });

        if (creation.data) {
          addressId = creation.data.id;
        } else if (creation.error) {
          console.error('[FunctionRouter] Failed to create address from current location:', creation.error.message);
        }
      } catch (addressError) {
        console.error('[FunctionRouter] Exception while creating address:', addressError);
      }
    }

    if (!addressId) {
      return {
        success: false,
        error: 'No delivery address found. Please add an address first.',
      };
    }
    
    // Validate landmark is present (either in address or extracted from specialInstructions)
    if (context.currentAddress && !landmark) {
      // Return cart data so UI can show it again with landmark input
      const cartSummary = mapCartToResult(cart);
      return {
        success: false,
        error: 'Please provide a nearby landmark so the rider can easily find you.',
        cart: cartSummary,
        carts: cartSummary ? [cartSummary] : [],
        address: context.currentAddress,
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

    // Validate delivery address
    if (context.currentAddress?.latitude && context.currentAddress?.longitude) {
      const deliveryValidation = await validateDeliveryAddress(
        args.shopId,
        context.currentAddress.latitude,
        context.currentAddress.longitude
      );
      if (deliveryValidation.error) {
        console.warn('[FunctionRouter] Delivery validation error:', deliveryValidation.error);
      } else if (deliveryValidation.data && !deliveryValidation.data.isWithinDeliveryZone) {
        return {
          success: false,
          error: 'Your selected address is outside this shop\'s delivery area. Please choose a different address or shop.',
        };
      }
    }

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

    const orderResult = await placeOrder({
      shop_id: args.shopId,
      consumer_address_id: addressId,
      items: orderItems,
      payment_method: 'cash',
      special_instructions: args.specialInstructions,
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

