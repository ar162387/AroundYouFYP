import React from 'react';
import { Image, View } from 'react-native';
import type { ShopType } from '../services/merchant/shopService';

const SHOP_TYPE_IMAGE_MAP: Record<ShopType, string> = {
	// Note: These are realistic-looking icons hosted on a public CDN.
	// You can replace these URLs with Supabase Storage URLs later.
	Grocery: 'https://img.icons8.com/color/96/grocery-bag.png',
	Meat: 'https://img.icons8.com/color/96/steak.png',
	Vegetable: 'https://img.icons8.com/color/96/vegetarian-food.png',
	Stationery: 'https://img.icons8.com/color/96/stationery.png',
	Dairy: 'https://img.icons8.com/color/96/milk-bottle.png',
	Pharmacy: 'https://img.icons8.com/color/96/clinic.png',
};

export function getShopTypeImageUrl(type: ShopType): string {
	return SHOP_TYPE_IMAGE_MAP[type] || SHOP_TYPE_IMAGE_MAP.Grocery;
}

type ShopTypeImageProps = {
	type: ShopType;
	size?: number;
	borderColor?: string;
	backgroundColor?: string;
};

export default function ShopTypeImage({
	type,
	size = 28,
	borderColor = '#E5E7EB',
	backgroundColor = '#F3F4F6',
}: ShopTypeImageProps) {
	const uri = getShopTypeImageUrl(type);
	const radius = Math.round(size);
	return (
		<View
			style={{
				width: size + 12,
				height: size + 12,
				borderRadius: radius,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor,
				borderWidth: 2,
				borderColor,
				overflow: 'hidden',
			}}
		>
			<Image
				source={{ uri }}
				style={{ width: size, height: size, borderRadius: Math.round(size / 3) }}
				resizeMode="contain"
			/>
		</View>
	);
}


