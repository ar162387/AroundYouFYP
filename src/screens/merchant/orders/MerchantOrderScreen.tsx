import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '../../../navigation/types';
import {
  useShopOrders,
  useConfirmOrder,
  useAssignRunnerAndDispatch,
  useMarkOrderDelivered,
  useCancelOrder as useMerchantCancelOrder,
  useDeliveryRunners,
} from '../../../hooks/merchant/useOrders';
import {
  OrderWithAll,
  getOrderStatusDisplay,
  formatPrice,
} from '../../../types/orders';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MerchantOrder'>;

export default function MerchantOrderScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ur';
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { shopId, orderId } = route.params;

  const {
    data: orders,
    isLoading,
    refetch,
    isFetching,
  } = useShopOrders(shopId);
  const typedOrders = orders as OrderWithAll[] | undefined;
  const order = useMemo(
    () => typedOrders?.find((o) => o.id === orderId) || null,
    [typedOrders, orderId],
  );

  const confirmMutation = useConfirmOrder();
  const assignRunnerMutation = useAssignRunnerAndDispatch();
  const deliveredMutation = useMarkOrderDelivered();
  const cancelMutation = useMerchantCancelOrder();

  const [isRunnerModalVisible, setIsRunnerModalVisible] = useState(false);
  const isProcessingMutationRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const statusDisplay = useMemo(() => {
    return order ? getOrderStatusDisplay(order.status) : null;
  }, [order]);

  const isLoadingOrder = isLoading && !order;

  const blockIfProcessing = useCallback(() => {
    if (isProcessingMutationRef.current) {
      return true;
    }
    isProcessingMutationRef.current = true;
    return false;
  }, []);

  const releaseProcessing = useCallback(() => {
    isProcessingMutationRef.current = false;
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!order) return;
    if (confirmMutation.isLoading || blockIfProcessing()) return;

    try {
      const result = await (confirmMutation.mutateAsync as unknown as (
        orderId: string,
      ) => Promise<{ success: boolean; message?: string }>)(order.id);

      if (result?.success) {
        await refetch();
        Alert.alert(t('merchant.orders.success'), t('merchant.orders.confirmSuccess'));
      } else {
        Alert.alert(t('merchant.orders.error'), result?.message || t('merchant.orders.confirmError'));
      }
    } catch (error: any) {
      console.error('Error confirming order:', error);
      Alert.alert(t('merchant.orders.error'), error?.message || t('merchant.orders.confirmError'));
    } finally {
      releaseProcessing();
    }
  }, [order, confirmMutation, blockIfProcessing, releaseProcessing, refetch]);

  const handleMarkDelivered = useCallback(() => {
    if (!order) return;
    if (deliveredMutation.isLoading || isProcessingMutationRef.current) return;

    Alert.alert(
      t('merchant.orders.markDeliveredTitle'),
      t('merchant.orders.markDeliveredMessage'),
      [
        { text: t('merchant.orders.cancel'), style: 'cancel' },
        {
          text: t('merchant.orders.yesDelivered'),
          onPress: async () => {
            if (blockIfProcessing()) return;
            try {
              const result = await (deliveredMutation.mutateAsync as unknown as (
                orderId: string,
              ) => Promise<{ success: boolean; message?: string }>)(order.id);
              if (result?.success) {
                await refetch();
                Alert.alert(t('merchant.orders.success'), t('merchant.orders.deliveredSuccess'));
                navigation.goBack();
              } else {
                Alert.alert(
                  t('merchant.orders.error'),
                  result?.message || t('merchant.orders.deliveredError'),
                );
              }
            } catch (error: any) {
              console.error('Error marking order as delivered:', error);
              Alert.alert(t('merchant.orders.error'), error?.message || t('merchant.orders.deliveredError'));
            } finally {
              releaseProcessing();
            }
          },
        },
      ],
    );
  }, [
    order,
    deliveredMutation,
    blockIfProcessing,
    releaseProcessing,
    refetch,
    navigation,
    t,
  ]);

  const handleCancel = useCallback(() => {
    if (!order) return;
    if (cancelMutation.isLoading || isProcessingMutationRef.current) return;

    const handleCancelWithReason = async (reason: string) => {
      if (blockIfProcessing()) return;
      try {
        const result = await (cancelMutation.mutateAsync as unknown as (params: {
          orderId: string;
          reason: string;
        }) => Promise<{ success: boolean; message?: string }>)({
          orderId: order.id,
          reason,
        });
        if (result?.success) {
          await refetch();
          Alert.alert(t('merchant.orders.success'), t('merchant.orders.cancelSuccess'));
          navigation.goBack();
        } else {
          Alert.alert(t('merchant.orders.error'), result?.message || t('merchant.orders.cancelError'));
        }
      } catch (error: any) {
        console.error('Error cancelling order:', error);
        Alert.alert(t('merchant.orders.error'), error?.message || t('merchant.orders.cancelError'));
      } finally {
        releaseProcessing();
      }
    };

    Alert.alert(t('merchant.orders.cancelOrderTitle'), t('merchant.orders.cancelReason'), [
      { text: t('merchant.orders.dismiss'), style: 'cancel' },
      {
        text: t('merchant.orders.outOfStock'),
        onPress: () => handleCancelWithReason('Items out of stock'),
      },
      {
        text: t('merchant.orders.otherReason'),
        onPress: () => handleCancelWithReason('Cancelled by shop'),
      },
    ]);
  }, [
    order,
    cancelMutation,
    blockIfProcessing,
    releaseProcessing,
    refetch,
    navigation,
  ]);

  const handleAssignRunner = useCallback(() => {
    if (!order) return;
    setIsRunnerModalVisible(true);
  }, [order]);

  const handleGetDirections = useCallback(() => {
    if (!order) return;
    const { latitude, longitude } = order.delivery_address;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  }, [order]);

  const actionContent = useMemo(() => {
    if (!order) return null;

    switch (order.status) {
      case 'pending':
        return (
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={confirmMutation.isLoading}
              className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
              activeOpacity={0.7}
            >
              {confirmMutation.isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold">{t('merchant.orders.confirmOrder')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelMutation.isLoading}
              className="bg-red-100 rounded-xl py-3 px-4"
              activeOpacity={0.7}
            >
              <Text className="text-red-600 font-semibold">{t('merchant.orders.cancel')}</Text>
            </TouchableOpacity>
          </View >
        );
      case 'confirmed':
        return (
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={handleAssignRunner}
              className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-white font-bold">{t('merchant.orders.assignRunner')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelMutation.isLoading}
              className="bg-red-100 rounded-xl py-3 px-4"
              activeOpacity={0.7}
            >
              <Text className="text-red-600 font-semibold">{t('merchant.orders.cancel')}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'out_for_delivery':
        return (
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={handleMarkDelivered}
              disabled={deliveredMutation.isLoading}
              className="flex-1 bg-green-600 rounded-xl py-3 items-center"
              activeOpacity={0.7}
            >
              {deliveredMutation.isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold">{t('merchant.orders.markDelivered')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelMutation.isLoading}
              className="bg-red-100 rounded-xl py-3 px-4"
              activeOpacity={0.7}
            >
              <Text className="text-red-600 font-semibold">{t('merchant.orders.cancel')}</Text>
            </TouchableOpacity>
          </View >
        );
      default:
        return (
          <View className="py-3">
            <Text className="text-gray-500 text-sm text-center">
              {t('merchant.orders.noActions')}
            </Text>
          </View>
        );
    }
  }, [
    order,
    handleConfirm,
    confirmMutation.isLoading,
    handleCancel,
    cancelMutation.isLoading,
    handleAssignRunner,
    handleMarkDelivered,
    deliveredMutation.isLoading,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
          >
            <Text className="text-gray-700 text-lg">{isRTL ? '→' : '←'}</Text>
          </TouchableOpacity>
          <View className="flex-1 ml-3">
            <Text className="text-gray-900 text-lg font-bold">
              {order?.order_number ?? 'Order'}
            </Text>
            {statusDisplay && (
              <View
                className="px-2 py-1 rounded-full mt-2 self-start"
                style={{ backgroundColor: `${statusDisplay.color}20` }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: statusDisplay.color }}
                >
                  {statusDisplay.title}
                </Text>
              </View>
            )}
          </View>
          <View className="w-9 h-9" />
        </View>
      </View>

      {isLoadingOrder ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-600 mt-4">Loading order...</Text>
        </View>
      ) : !order ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">🧐</Text>
          <Text className="text-gray-900 text-lg font-semibold text-center mb-2">
            {t('merchant.orders.notFound')}
          </Text>
          <Text className="text-gray-500 text-center mb-6">
            {t('merchant.orders.notFoundDesc')}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="px-6 py-3 rounded-xl bg-blue-600"
          >
            <Text className="text-white font-semibold">{t('merchant.orders.backToOrders')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
            }
          >
            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                {t('merchant.orders.customer')}
              </Text>
              {order.customer_name && (
                <Text className="text-gray-900 text-base font-semibold">
                  {order.customer_name}
                </Text>
              )}
              {order.customer_email && (
                <Text className="text-gray-600 text-sm mt-1">
                  {order.customer_email}
                </Text>
              )}
            </View>

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                {t('merchant.orders.deliveryAddress')}
              </Text>
              <Text className="text-gray-900 text-base">
                {order.delivery_address.street_address}
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                {order.delivery_address.city}
                {order.delivery_address.region &&
                  `, ${order.delivery_address.region}`}
              </Text>
              {order.delivery_address.landmark && (
                <View className="mt-2">
                  <Text className="text-xs text-gray-500">{t('merchant.orders.landmark')}</Text>
                  <Text className="text-gray-700 text-sm">
                    {order.delivery_address.landmark}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleGetDirections}
                className="mt-3 bg-blue-50 px-4 py-2 rounded-lg self-start"
              >
                <Text className="text-blue-600 font-semibold">{t('merchant.orders.getDirections')}</Text>
              </TouchableOpacity>
            </View>

            {order.special_instructions && (
              <View className="bg-white rounded-xl p-4 mb-4">
                <Text className="text-lg font-bold text-gray-900 mb-2">
                  {t('merchant.orders.specialInstructions')}
                </Text>
                <Text className="text-gray-700 text-sm">
                  {order.special_instructions}
                </Text>
              </View>
            )}

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                {t('merchant.orders.orderItems')}
              </Text>
              {order.order_items.map((item, index) => (
                <View
                  key={item.id}
                  className={`flex-row justify-between py-2 ${index < order.order_items.length - 1
                    ? 'border-b border-gray-100'
                    : ''
                    }`}
                >
                  <View className="flex-1">
                    <Text className="text-gray-900 text-base font-medium">
                      {item.quantity} × {item.item_name}
                    </Text>
                    {item.item_description && (
                      <Text className="text-gray-500 text-xs mt-0.5">
                        {item.item_description}
                      </Text>
                    )}
                  </View>
                  <Text className="text-gray-900 text-base font-semibold ml-2">
                    {formatPrice(item.subtotal_cents)}
                  </Text>
                </View>
              ))}
            </View>

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                {t('merchant.orders.paymentSummary')}
              </Text>
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">{t('merchant.orders.subtotal')}</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  {formatPrice(order.subtotal_cents)}
                </Text>
              </View>
              {order.surcharge_cents > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-600 text-base">{t('merchant.orders.surcharge')}</Text>
                  <Text className="text-gray-900 text-base font-semibold">
                    {formatPrice(order.surcharge_cents)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">{t('merchant.orders.delivery')}</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  {formatPrice(order.delivery_fee_cents)}
                </Text>
              </View>
              <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
                <Text className="text-gray-900 text-lg font-bold">{t('merchant.orders.total')}</Text>
                <Text className="text-gray-900 text-lg font-bold">
                  {formatPrice(order.total_cents)}
                </Text>
              </View>
              <View className="mt-3 pt-3 border-t border-gray-200">
                <View className="flex-row justify-between">
                  <Text className="text-gray-600 text-base">{t('merchant.orders.payment')}</Text>
                  <Text className="text-gray-900 text-base font-semibold capitalize">
                    {order.payment_method}
                  </Text>
                </View>
              </View>
            </View>

            {order.delivery_runner && (
              <View className="bg-white rounded-xl p-4 mb-4">
                <Text className="text-lg font-bold text-gray-900 mb-3">
                  {t('merchant.orders.deliveryRunner')}
                </Text>
                <Text className="text-gray-900 text-base font-semibold">
                  {order.delivery_runner.name}
                </Text>
                <Text className="text-gray-600 text-sm">
                  {order.delivery_runner.phone_number}
                </Text>
              </View>
            )}
          </ScrollView>

          <View
            className="bg-white border-t border-gray-200 px-4 py-4"
            style={{ paddingBottom: 20 }}
          >
            {actionContent}
          </View>
        </>
      )}

      {order && (
        <RunnerSelectionModal
          visible={isRunnerModalVisible}
          shopId={shopId}
          onClose={() => setIsRunnerModalVisible(false)}
          onSelect={async (runnerId: string) => {
            if (assignRunnerMutation.isLoading || blockIfProcessing()) return;
            try {
              const result = await (assignRunnerMutation.mutateAsync as unknown as (
                params: {
                  orderId: string;
                  runnerId: string;
                  shopId?: string;
                },
              ) => Promise<{ success: boolean; message?: string }>)({
                orderId: order.id,
                runnerId,
                shopId,
              });
              if (result?.success) {
                await refetch();
                Alert.alert(t('merchant.orders.success'), t('merchant.orders.assignSuccess'));
                setIsRunnerModalVisible(false);
                navigation.goBack();
              } else {
                Alert.alert(
                  t('merchant.orders.error'),
                  result?.message || t('merchant.orders.assignError'),
                );
              }
            } catch (error: any) {
              console.error('Error assigning runner:', error);
              Alert.alert(t('merchant.orders.error'), error?.message || t('merchant.orders.assignError'));
            } finally {
              releaseProcessing();
            }
          }}
          isAssigning={assignRunnerMutation.isLoading}
        />
      )}
    </SafeAreaView>
  );
}

interface RunnerSelectionModalProps {
  visible: boolean;
  shopId: string;
  onClose: () => void;
  onSelect: (runnerId: string) => void;
  isAssigning: boolean;
}

function RunnerSelectionModal({
  visible,
  shopId,
  onClose,
  onSelect,
  isAssigning,
}: RunnerSelectionModalProps) {
  const { t } = useTranslation();
  const { data: runners, isLoading } = useDeliveryRunners(shopId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        <View className="bg-white border-b border-gray-200 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 text-lg font-bold">{t('merchant.orders.selectRunner')}</Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-gray-600 text-lg">✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : !runners || runners.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-gray-600 text-center">
              {t('merchant.orders.noRunners')}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
            {runners.map((runner) => (
              <TouchableOpacity
                key={runner.id}
                onPress={() => onSelect(runner.id)}
                disabled={isAssigning}
                className="bg-white rounded-xl p-4 mb-3 border border-gray-200"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-gray-900 text-base font-semibold">
                      {runner.name}
                    </Text>
                    <Text className="text-gray-600 text-sm mt-0.5">
                      {runner.phone_number}
                    </Text>
                    <View className="mt-2">
                      {runner.is_available ? (
                        <View className="px-2 py-1 bg-green-100 rounded-full self-start">
                          <Text className="text-green-700 text-xs font-semibold">
                            ✓ {t('merchant.orders.free')}
                          </Text>
                        </View>
                      ) : (
                        <View className="px-2 py-1 bg-orange-100 rounded-full self-start">
                          <Text className="text-orange-700 text-xs font-semibold">
                            🚚 {t('merchant.orders.delivering', { orderNumber: runner.current_order_number })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center ml-3">
                    <Text className="text-blue-600 text-lg">→</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {isAssigning && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <View className="bg-white rounded-xl p-6">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-900 mt-4 font-semibold">
                {t('merchant.orders.assigning')}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

