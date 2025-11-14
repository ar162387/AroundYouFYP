import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { MerchantShop } from '../../services/merchant/shopService';
import OrdersTrendIcon from '../../icons/OrdersTrendIcon';
import CancelledOrderIcon from '../../icons/CancelledOrderIcon';
import RevenueFlowIcon from '../../icons/RevenueFlowIcon';

interface MerchantShopCardProps {
  shop: MerchantShop;
  onPress?: () => void;
}

const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <View className="w-7 h-7 items-center justify-center">
    {children}
  </View>
);

// Custom icons for stats
const OrdersIcon = () => (
  <IconWrapper>
    <OrdersTrendIcon size={24} />
  </IconWrapper>
);

const CancelledIcon = () => (
  <IconWrapper>
    <CancelledOrderIcon size={22} />
  </IconWrapper>
);

const RevenueIcon = () => (
  <IconWrapper>
    <RevenueFlowIcon size={22} />
  </IconWrapper>
);

const StatItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <View className="flex-1 basis-0">
    <View className="flex-row items-center">
      {icon}
      <Text className="ml-2 text-[11px] font-medium text-gray-500">{label}</Text>
    </View>
    <Text className="mt-1 text-lg font-semibold text-gray-900">{value}</Text>
  </View>
);

export default function MerchantShopCard({ shop, onPress }: MerchantShopCardProps) {
  const revenueValue = Number(shop.revenue_today || 0);
  let formattedRevenue = `Rs ${Math.round(revenueValue).toLocaleString('en-PK')}`;
  try {
    formattedRevenue = `Rs ${revenueValue.toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  } catch {
    // Fallback already assigned above
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl mb-4 overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
      activeOpacity={0.7}
    >
      {/* Shop Image and Name */}
      <View className="flex-row">
        <View className="w-[132px] h-24 overflow-hidden">
          {shop.image_url ? (
            <Image
              source={{ uri: shop.image_url }}
              className="w-full h-full"
              resizeMode="contain"
            />
          ) : (
            <View className="w-full h-full bg-gray-200 items-center justify-center">
              <Text className="text-4xl">🏪</Text>
            </View>
          )}
        </View>

        <View className="flex-1 p-4 justify-center">
          <Text className="text-lg font-bold text-gray-900 mb-1" numberOfLines={2}>
            {shop.name}
          </Text>
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            {shop.shop_type}
          </Text>
        </View>
      </View>

      {/* Stats Section */}
      <View className="px-4 pb-4 pt-2 border-t border-gray-100">
        <View className="flex-row justify-between gap-4">
          <StatItem icon={<OrdersIcon />} label="Orders" value={`${shop.orders_today}`} />
          <StatItem icon={<CancelledIcon />} label="Cancelled" value={`${shop.orders_cancelled_today}`} />
          <StatItem icon={<RevenueIcon />} label="Revenue" value={formattedRevenue} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

