import { supabase, executeWithRetry } from '../supabase';
import { calculateShopsDeliveryFees } from './deliveryFeeService';
import type { ConsumerShop } from './shopService';

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

		// Step 1: fetch visible shops via RPC
		const pointWkt = `POINT(${longitude} ${latitude})`;
		console.log('[search] using coords:', { latitude, longitude }, 'query:', query, 'normalized:', normalized);
		const { data: shopsData, error: shopsError } = await executeWithRetry(async (client) =>
			client.rpc('find_shops_by_location', { point_wkt: pointWkt })
		);
		if (shopsError) {
			return { results: [], error: { message: shopsError.message } };
		}
		const visibleShops: ConsumerShop[] = (shopsData || []).map((row: any) => ({
			id: row.id,
			name: row.name,
			image_url: row.image_url || '',
			rating: 0,
			orders: row.delivered_orders_count !== undefined ? Number(row.delivered_orders_count) : 0,
			delivery_fee: 0,
			delivery_time: undefined,
			tags: row.tags || [],
			address: row.address,
			latitude: row.latitude,
			longitude: row.longitude,
			is_open: row.is_open,
			created_at: row.created_at,
			shop_type: row.shop_type || undefined,
			minimumOrderValue: undefined,
		}));
		if (visibleShops.length === 0) {
			return { results: [], error: null };
		}

		// Step 2: calculate delivery fees so we can sort later
		const shopsWithFees = await calculateShopsDeliveryFees(visibleShops, latitude, longitude);
		const shopIdSet = new Set(shopsWithFees.map((s) => s.id));
		const shopIds = shopsWithFees.map((s) => s.id);

		// Step 3: fetch matched items across visible shops, with template image fallback
		// Fuzzy: ILIKE on raw query and also on normalized (name with apostrophes removed)
		// We'll use Supabase SQL functions to replace apostrophes on the fly
		let itemsQuery = supabase
			.from('merchant_items')
			.select(`
        id,
        name,
        image_url,
        price_cents,
        currency,
        shop_id,
        item_templates!left(image_url)
      `)
			.in('shop_id', shopIds)
			.eq('is_active', true)
			// Build OR chain like: name.ilike.%a%,name.ilike.%b%,...
			.or(Array.from(ilikePatterns).map((p) => `name.ilike.${p}`).join(','))
			.order('name', { ascending: true })
			.limit(200);

		const { data: itemsData, error: itemsError } = await itemsQuery;
		if (itemsError) {
			return { results: [], error: { message: itemsError.message } };
		}

		const matchedItemsByShop = new Map<string, SearchItem[]>();
		(itemsData || []).forEach((row: any) => {
			if (!shopIdSet.has(row.shop_id)) return;
			// Handle item_templates as object or array (Supabase can return either)
			const templateData = row.item_templates;
			const templateImageUrl = Array.isArray(templateData)
				? templateData[0]?.image_url
				: templateData?.image_url;
			const finalImageUrl = row.image_url || templateImageUrl || null;
			const arr = matchedItemsByShop.get(row.shop_id) || [];
			arr.push({
				id: row.id,
				name: row.name,
				image_url: finalImageUrl,
				price_cents: row.price_cents ?? null,
				currency: row.currency ?? null,
				shop_id: row.shop_id,
			});
			matchedItemsByShop.set(row.shop_id, arr);
		});

		// Step 4: fetch reviews to compute ratings (avg per shop)
		const { data: reviewsData, error: reviewsError } = await supabase
			.from('reviews')
			.select('shop_id, rating')
			.in('shop_id', shopIds);
		const ratingMap = new Map<string, { sum: number; count: number }>();
		if (!reviewsError && reviewsData) {
			reviewsData.forEach((r: any) => {
				const key = r.shop_id;
				const current = ratingMap.get(key) || { sum: 0, count: 0 };
				current.sum += Number(r.rating || 0);
				current.count += 1;
				ratingMap.set(key, current);
			});
		}

		// Step 5: determine shop name matches (fuzzy using normalized compare) and attach ratings
		const results: ShopSearchResult[] = shopsWithFees.map((shop) => {
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
		const { data, error } = await supabase
			.from('merchant_items')
			.select(`
        id,
        name,
        image_url,
        price_cents,
        currency,
        shop_id,
        item_templates!left(image_url)
      `)
			.eq('shop_id', shopId)
			.eq('is_active', true)
			.order('name', { ascending: true })
			.limit(limit);
		if (error) return { items: [], error: { message: error.message } };
		const items: SearchItem[] = (data || []).map((row: any) => {
			const templateData = row.item_templates;
			const templateImageUrl = Array.isArray(templateData)
				? templateData[0]?.image_url
				: templateData?.image_url;
			const finalImageUrl = row.image_url || templateImageUrl || null;
			return {
				id: row.id,
				name: row.name,
				image_url: finalImageUrl,
				price_cents: row.price_cents ?? null,
				currency: row.currency ?? null,
				shop_id: row.shop_id,
			};
		});
		return { items, error: null };
	} catch (error: any) {
		return { items: [], error: { message: error.message || 'Failed to fetch items' } };
	}
}


