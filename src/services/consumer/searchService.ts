import { calculateShopsDeliveryFees } from './deliveryFeeService';
import type { ConsumerShop } from './shopService';
import { findShopsByLocation } from './shopService';
import { apiClient } from '../apiClient';

export type SearchItem = {
	id: string;
	name: string;
	image_url: string | null;
	price_cents: number | null;
	currency: string | null;
	shop_id: string;
};

export type ShopSearchResult = {
	shop: ConsumerShop;
	matchedItems: SearchItem[];
	shopNameMatched: boolean;
};

function normalizeQuery(q: string): string {
	return q.trim().toLowerCase().replace(/['’`]/g, '').replace(/\s+/g, ' ');
}

/**
 * Search shops and items available to the user (within delivery zones).
 * - Respects delivery zones via existing RPC find_shops_by_location
 * - Fuzzy matching by handling apostrophes and case-insensitive ILIKE
 * - Returns shops with matched items; if no items match, still returns shop (with sample items later)
 * - Results are post-processed with delivery fee calculation and sorted by:
 *   1) shop name match or any item match
 *   2) minimum delivery fee (ascending)
 */
export async function searchShopsAndItems(
	latitude: number,
	longitude: number,
	rawQuery: string
): Promise<{ results: ShopSearchResult[]; error: { message: string } | null }> {
	try {
		const query = rawQuery.trim();
		if (!query) {
			return { results: [], error: null };
		}

		const normalized = normalizeQuery(query);
		// Build fuzzy patterns for ilike OR:
		// - raw: %lays%
		// - normalized: %lays%
		// - common apostrophe variants: lay's, lays'
		const ilikePatterns = new Set<string>();
		ilikePatterns.add(`%${query}%`);
		ilikePatterns.add(`%${normalized}%`);
		if (normalized.length >= 3) {
			// insert apostrophe near the end and before last char
			const apostrophe1 = normalized.slice(0, normalized.length - 1) + `'` + normalized.slice(normalized.length - 1);
			const apostrophe2 = normalized + `'`;
			ilikePatterns.add(`%${apostrophe1}%`);
			ilikePatterns.add(`%${apostrophe2}%`);
		}

		console.log('[search] using coords:', { latitude, longitude }, 'query:', query, 'normalized:', normalized);
		const shopsResponse = await findShopsByLocation(latitude, longitude);
		if (shopsResponse.error) {
			return { results: [], error: { message: shopsResponse.error.message } };
		}
		const visibleShops: ConsumerShop[] = shopsResponse.data || [];
		if (visibleShops.length === 0) {
			return { results: [], error: null };
		}

		// Step 2: calculate delivery fees so we can sort later
		const shopsWithFees = await calculateShopsDeliveryFees(visibleShops, latitude, longitude);
		const shopIdSet = new Set(shopsWithFees.map((s) => s.id));
		const shopIds = shopsWithFees.map((s) => s.id);

		const matchedItemsByShop = new Map<string, SearchItem[]>();
		const ratingMap = new Map<string, { sum: number; count: number }>();
		for (const shopId of shopIds) {
			const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`);
			if (detail) {
				const categories: any[] = detail.categories || [];
				categories.forEach((category) => {
					(category.items || []).forEach((item: any) => {
						const itemName = (item.name || '').toLowerCase();
						const matches = Array.from(ilikePatterns).some((pattern) =>
							itemName.includes(pattern.replace(/%/g, '').toLowerCase())
						);
						if (!matches) return;
						const arr = matchedItemsByShop.get(shopId) || [];
						arr.push({
							id: item.id,
							name: item.name,
							image_url: item.image_url || null,
							price_cents: item.price_cents ?? null,
							currency: item.currency ?? null,
							shop_id: shopId,
						});
						matchedItemsByShop.set(shopId, arr);
					});
				});
				const rating = Number(detail.rating || 0);
				const count = Number(detail.review_count || 0);
				ratingMap.set(shopId, { sum: rating * Math.max(count, 1), count });
			}
		}

		// Step 5: determine shop name matches (fuzzy using normalized compare) and attach ratings
		const results: ShopSearchResult[] = shopsWithFees.filter((shop) => shopIdSet.has(shop.id)).map((shop) => {
			const nameNorm = normalizeQuery(shop.name);
			const nameMatched =
				shop.name.toLowerCase().includes(query.toLowerCase()) ||
				nameNorm.includes(normalized);
			const items = matchedItemsByShop.get(shop.id) || [];
			// Attach rating to shop object for UI
			const r = ratingMap.get(shop.id);
			if (r && r.count > 0) {
				(shop as any).rating = Number((r.sum / r.count).toFixed(1));
				(shop as any).ratingCount = r.count;
			} else {
				(shop as any).rating = 0;
				(shop as any).ratingCount = 0;
			}
			return { shop, matchedItems: items, shopNameMatched: nameMatched };
		});

		// Step 6: If a shop has no matched items, we will later fetch a few sample items in the UI layer if needed.
		// Sorting: prioritize shops with name match or any item match, then by delivery fee ascending.
		results.sort((a, b) => {
			const aMatched = (a.shopNameMatched ? 2 : 0) + (a.matchedItems.length > 0 ? 1 : 0);
			const bMatched = (b.shopNameMatched ? 2 : 0) + (b.matchedItems.length > 0 ? 1 : 0);
			if (aMatched !== bMatched) return bMatched - aMatched;
			const aFee = (a.shop as any).delivery_fee ?? 0;
			const bFee = (b.shop as any).delivery_fee ?? 0;
			return aFee - bFee;
		});

		console.log('[search] results:', { shopCount: results.length });
		return { results, error: null };
	} catch (error: any) {
		return { results: [], error: { message: error.message || 'Search failed' } };
	}
}

/**
 * Fetch a few sample items for a shop to display when no items matched.
 */
export async function fetchSampleItemsForShop(
	shopId: string,
	limit = 6
): Promise<{ items: SearchItem[]; error: { message: string } | null }> {
	try {
		const detail = await apiClient.get<any>(`/api/v1/consumer/shops/${shopId}`);
		const items: SearchItem[] = [];
		(detail.categories || []).forEach((category: any) => {
			(category.items || []).forEach((item: any) => {
				if (items.length < limit) {
					items.push({
						id: item.id,
						name: item.name,
						image_url: item.image_url || null,
						price_cents: item.price_cents ?? null,
						currency: item.currency ?? null,
						shop_id: shopId,
					});
				}
			});
		});
		return { items, error: null };
	} catch (error: any) {
		return { items: [], error: { message: error.message || 'Failed to fetch items' } };
	}
}


