import React from 'react';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import OrdersSectionComponent from '../../../../components/merchant/OrdersSection';

type OrdersSectionProps = {
  shop: MerchantShop;
};

export default function OrdersSection({ shop }: OrdersSectionProps) {
  return <OrdersSectionComponent shopId={shop.id} />;
}

