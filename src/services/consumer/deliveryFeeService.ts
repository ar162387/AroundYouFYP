import type { ConsumerShop } from './shopService';
import type { DeliveryLogic } from '../merchant/deliveryLogicService';
import { 
  fetchDeliveryLogic, 
  calculateDistance, 
  calculateDeliveryFee 
} from '../merchant/deliveryLogicService';

/**
 * Calculate delivery fee for a single shop based on consumer location
 * Uses the shop's delivery logic (auto or custom tiers) to determine the fee
 */
export async function calculateShopDeliveryFee(
  shop: ConsumerShop,
  consumerLatitude: number,
  consumerLongitude: number
): Promise<number> {
  // If shop doesn't have coordinates, return 0
  if (!shop.latitude || !shop.longitude) {
    return 0;
  }

  // Fetch delivery logic for the shop
  const { data: deliveryLogic, error } = await fetchDeliveryLogic(shop.id);
  
  if (error || !deliveryLogic) {
    // If no delivery logic exists, return 0 (or could return a default fee)
    return 0;
  }

  // Calculate distance from consumer to shop
  const distanceInMeters = calculateDistance(
    consumerLatitude,
    consumerLongitude,
    shop.latitude,
    shop.longitude
  );

  // Calculate delivery fee based on distance and delivery logic
  // For display purposes, we use orderValue = 0 (base fee only, no surcharge)
  // The actual order value surcharge will be calculated at checkout
  const baseFee = calculateDeliveryFee(distanceInMeters, deliveryLogic);

  return baseFee;
}

/**
 * Calculate delivery fees for multiple shops in batch
 * This is more efficient than calling calculateShopDeliveryFee for each shop individually
 * Returns shops with delivery_fee and distanceInMeters
 */
export async function calculateShopsDeliveryFees(
  shops: ConsumerShop[],
  consumerLatitude: number,
  consumerLongitude: number
): Promise<(ConsumerShop & { distanceInMeters?: number })[]> {
  // Fetch all delivery logic records in parallel
  const deliveryLogicPromises = shops.map(shop => fetchDeliveryLogic(shop.id));
  const deliveryLogicResults = await Promise.all(deliveryLogicPromises);

  // Calculate fees for each shop
  return shops.map((shop, index) => {
    const { data: deliveryLogic, error } = deliveryLogicResults[index];

    // Log for debugging
    if (!shop.latitude || !shop.longitude) {
      console.warn(`Shop ${shop.id} (${shop.name}) missing coordinates`);
    }
    if (error) {
      console.warn(`Error fetching delivery logic for shop ${shop.id} (${shop.name}):`, error.message);
    }
    if (!deliveryLogic) {
      console.warn(`No delivery logic found for shop ${shop.id} (${shop.name})`);
    }

    // If shop doesn't have coordinates or delivery logic, keep fee as 0
    if (!shop.latitude || !shop.longitude || !deliveryLogic) {
      return shop;
    }

    // Calculate distance
    const distanceInMeters = calculateDistance(
      consumerLatitude,
      consumerLongitude,
      shop.latitude,
      shop.longitude
    );

    // Calculate base delivery fee (without order value surcharge)
    const baseFee = calculateDeliveryFee(distanceInMeters, deliveryLogic);

    console.log(`Shop ${shop.id} (${shop.name}): distance=${distanceInMeters.toFixed(0)}m, fee=Rs ${baseFee.toFixed(0)}`);

    return {
      ...shop,
      delivery_fee: baseFee,
      distanceInMeters,
    };
  });
}

