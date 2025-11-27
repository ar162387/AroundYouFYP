import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import type { Shop } from '../../services/supabase';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import MoneyIcon from '../../icons/MoneyIcon';
import { getShopReviewStats } from '../../services/consumer/reviewService';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getCurrentOpeningStatus } from '../../utils/shopOpeningHours';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_IMAGE_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 9 / 16 * 0.85); // Slightly taller for better impact

interface ShopCardProps {
  shop: Shop;
  onPress?: () => void;
}

export default function ShopCard({ shop, onPress }: ShopCardProps) {
  const { t } = useTranslation();
  const [averageRating, setAverageRating] = useState<number | null>(null);

  // Compute real-time opening status
  const openingStatus = useMemo(() => {
    return getCurrentOpeningStatus({
      opening_hours: shop.opening_hours ?? null,
      holidays: shop.holidays ?? null,
      open_status_mode: shop.open_status_mode ?? undefined,
    });
  }, [shop.opening_hours, shop.holidays, shop.open_status_mode]);

  const isClosed = !openingStatus.isOpen;

  useEffect(() => {
    const fetchRating = async () => {
      const { data } = await getShopReviewStats(shop.id);
      if (data) {
        setAverageRating(data.average_rating);
      }
    };
    fetchRating();
  }, [shop.id]);

  // Use fetched rating or fall back to shop.rating (which might be 0)
  const displayRating = averageRating !== null ? averageRating : (shop.rating > 0 ? shop.rating : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-2xl mb-4 bg-white ${isClosed ? '' : 'shadow-sm'}`}
      style={{
        opacity: isClosed ? 0.6 : 1,
        elevation: isClosed ? 0 : 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      }}
      activeOpacity={0.9}
    >
      {/* Shop Image Container */}
      <View className="w-full relative bg-gray-100 rounded-t-2xl" style={{ height: CARD_IMAGE_HEIGHT, overflow: 'hidden' }}>
        {shop.image_url ? (
          <Image
            source={{ uri: shop.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-gray-200">
            <Text className="text-gray-400 text-sm font-medium">{t('shopCard.noImage')}</Text>
          </View>
        )}

        {/* Gradient Overlay for better text readability if we had text over image, 
            but here it adds a subtle depth */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.05)']}
          className="absolute inset-0"
        />

        {/* Delivery Time / Fee Badge (Top Right) - Optional, can be added if data exists */}
        {/* 
        <View className="absolute top-3 right-3 bg-white px-2 py-1 rounded-lg shadow-sm">
          <Text className="text-xs font-bold text-gray-800">20-30 min</Text>
        </View> 
        */}
      </View>

      {/* Diagonal Closed Banner - positioned at boundary between image and info */}
      {isClosed && (
        <View
          style={{
            position: 'absolute',
            top: CARD_IMAGE_HEIGHT - 20,
            left: -60,
            right: -60,
            height: 40,
            backgroundColor: '#dc2626',
            transform: [{ rotate: '-45deg' }],
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 'bold',
              letterSpacing: 1,
            }}
          >
            {t('shopCard.closed').toUpperCase()}
          </Text>
        </View>
      )}

      {/* Shop Info */}
      <View className="p-4">
        {/* Header Row: Name & Rating */}
        <View className="flex-row items-start justify-between mb-1">
          <Text className="text-lg font-bold text-gray-900 flex-1 mr-2 leading-6" numberOfLines={1}>
            {shop.name}
          </Text>
          <View className="items-end">
            <View className="flex-row items-center bg-green-50 px-1.5 py-0.5 rounded-md">
              <Text className="text-green-700 text-xs font-bold mr-1">
                {displayRating !== null ? displayRating.toFixed(1) : t('shopCard.new')}
              </Text>
              <Text className="text-green-600 text-[10px]">★</Text>
            </View>
            {(shop.orders || 0) > 0 && (
              <Text className="text-gray-400 text-[10px] font-medium mt-0.5">
                {t('shopCard.orders', { count: shop.orders })}
              </Text>
            )}
          </View>
        </View>

        {/* Metadata Row: Type • Fee • Min Order */}
        <View className="flex-row items-center flex-wrap mb-3">
          {shop.shop_type && (
            <>
              <Text className="text-gray-500 text-sm font-medium">{t(`shopTypes.${shop.shop_type}`)}</Text>
              <Text className="text-gray-300 mx-1.5">•</Text>
            </>
          )}

          <Text className="text-gray-500 text-sm">
            {shop.delivery_fee > 0 ? t('shopCard.deliveryFee', { amount: Math.round(shop.delivery_fee) }) : t('shopCard.freeDelivery')}
          </Text>

          {shop.minimumOrderValue !== undefined && shop.minimumOrderValue > 0 && (
            <>
              <Text className="text-gray-300 mx-1.5">•</Text>
              <Text className="text-gray-500 text-sm">
                {t('shopCard.minOrder', { amount: Math.round(shop.minimumOrderValue) })}
              </Text>
            </>
          )}
        </View>

        {/* Show holiday description or closed status if closed */}
        {isClosed && openingStatus.reason === 'holiday' && openingStatus.holidayDescription && (
          <View className="mb-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
            <Text className="text-amber-800 text-xs font-medium">
              {openingStatus.holidayDescription}
            </Text>
          </View>
        )}

        {/* Tags Row - Cleaner look */}
        {shop.tags && shop.tags.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {shop.tags.slice(0, 3).map((tag, index) => (
              <View
                key={index}
                className="bg-gray-100 px-2.5 py-1 rounded-md"
              >
                <Text className="text-gray-600 text-xs font-medium">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

