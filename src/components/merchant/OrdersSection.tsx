import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  useShopOrders,
  useGroupedOrders,
  useConfirmOrder,
  useAssignRunnerAndDispatch,
  useMarkOrderDelivered,
  useCancelOrder as useMerchantCancelOrder,
  useDeliveryRunners,
} from '../../hooks/merchant/useOrders';
import {
  OrderWithAll,
  OrderTimeFilter,
  getOrderStatusDisplay,
  formatPrice,
  formatDuration,
  OrderStatus,
} from '../../types/orders';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface OrdersSectionProps {
  shopId: string;
}

export default function OrdersSection({ shopId }: OrdersSectionProps) {
  const navigation = useNavigation<Nav>();
  const { data: orders, isLoading, refetch, isFetching } = useShopOrders(shopId);
  const typedOrders = orders as OrderWithAll[] | undefined;
  const groupedOrders = useGroupedOrders(typedOrders);
  
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<OrderTimeFilter>('today');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithAll | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showRunnerSelection, setShowRunnerSelection] = useState(false);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  
  // Track if we're processing a mutation to prevent race conditions
  const isProcessingMutationRef = useRef(false);
  const selectedOrderIdRef = useRef<string | null>(null);

  const confirmMutation = useConfirmOrder();
  const assignRunnerMutation = useAssignRunnerAndDispatch();
  const deliveredMutation = useMarkOrderDelivered();
  const cancelMutation = useMerchantCancelOrder();

  // Update selectedOrder when orders data changes (after mutations or real-time updates)
  // Only update if we're not currently processing a mutation to avoid race conditions
  React.useEffect(() => {
    if (!selectedOrderIdRef.current || !typedOrders || !Array.isArray(typedOrders)) return;
    
    const updatedOrder = typedOrders.find((o) => o.id === selectedOrderIdRef.current);
    if (!updatedOrder) return;
    
    // Only update if order actually changed and we're not processing a mutation
    if (!isProcessingMutationRef.current) {
      setSelectedOrder((current) => {
        if (!current || current.id !== updatedOrder.id) return current;
        
        const orderChanged = 
          updatedOrder.status !== current.status ||
          updatedOrder.updated_at !== current.updated_at ||
          updatedOrder.delivery_runner_id !== current.delivery_runner_id;
        
        return orderChanged ? updatedOrder : current;
      });
    }
  }, [typedOrders]);

  const handleRefresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Get the latest order from the orders list
  const getLatestOrder = useCallback((orderId: string): OrderWithAll | null => {
    if (!typedOrders || !Array.isArray(typedOrders)) return null;
    return typedOrders.find((o) => o.id === orderId) || null;
  }, [typedOrders]);

  // Handle opening order detail modal with fresh data
  const handleOpenOrderDetail = useCallback(async (order: OrderWithAll) => {
    setIsOpeningModal(true);
    try {
      // Refetch to ensure we have latest data
      await refetch();
      // Get the latest order data
      const latest = getLatestOrder(order.id) || order;
      selectedOrderIdRef.current = latest.id;
      setSelectedOrder(latest);
      setShowOrderDetail(true);
    } finally {
      setIsOpeningModal(false);
    }
  }, [refetch, getLatestOrder]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 mt-4">Loading orders...</Text>
      </View>
    );
  }

  if (!typedOrders || !Array.isArray(typedOrders) || typedOrders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-6xl mb-4">📦</Text>
        <Text className="text-gray-900 text-lg font-semibold mb-2 text-center">
          No orders yet
        </Text>
        <Text className="text-gray-500 text-center">
          Your orders will appear here when customers place them
        </Text>
      </View>
    );
  }

  // Filter orders based on selected time filter
  const filteredOrders = Array.isArray(typedOrders) ? getFilteredOrdersByTime(typedOrders, selectedTimeFilter) : [];
  const groupedFilteredOrders = useGroupedOrders(filteredOrders);

  return (
    <View className="flex-1">
      {/* Time Filter Tabs */}
      <View className="bg-white border-b border-gray-200">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          {(['today', 'yesterday', '7days', '30days', 'all'] as OrderTimeFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => setSelectedTimeFilter(filter)}
              className={`mr-3 px-4 py-2 rounded-full ${
                selectedTimeFilter === filter
                  ? 'bg-blue-600'
                  : 'bg-gray-100'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedTimeFilter === filter
                    ? 'text-white'
                    : 'text-gray-700'
                }`}
              >
                {getFilterLabel(filter)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={handleRefresh} />
        }
      >
        {filteredOrders.length === 0 ? (
          <View className="py-8 items-center">
            <Text className="text-gray-500 text-center">
              No orders for this period
            </Text>
          </View>
        ) : selectedTimeFilter === 'today' && groupedFilteredOrders ? (
          // For today, show grouped and prioritized
          <>
            {groupedFilteredOrders.today.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => handleOpenOrderDetail(order)}
                shopId={shopId}
              />
            ))}
          </>
        ) : (
          // For other filters, show chronologically
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => handleOpenOrderDetail(order)}
              shopId={shopId}
            />
          ))
        )}
      </ScrollView>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          visible={showOrderDetail}
          order={selectedOrder}
          onClose={() => {
            setShowOrderDetail(false);
            setSelectedOrder(null);
            selectedOrderIdRef.current = null;
          }}
          onConfirm={async () => {
            if (isProcessingMutationRef.current) return;
            
            isProcessingMutationRef.current = true;
            try {
              const result = await (confirmMutation.mutateAsync as unknown as (orderId: string) => Promise<{ success: boolean; message?: string }>)(selectedOrder.id);
              if (result?.success) {
                // Wait briefly for real-time subscription to update cache (max 2 seconds)
                let attempts = 0;
                let updated = getLatestOrder(selectedOrder.id);
                while (!updated || updated.status !== 'confirmed') {
                  await new Promise(resolve => setTimeout(resolve, 200));
                  updated = getLatestOrder(selectedOrder.id);
                  attempts++;
                  if (attempts >= 10) break; // Max 2 seconds wait
                }
                
                if (updated && updated.status === 'confirmed') {
                  setSelectedOrder(updated);
                }
                Alert.alert('Success', 'Order confirmed. You can now assign a runner.');
              } else {
                Alert.alert('Error', result?.message || 'Failed to confirm order');
              }
            } catch (error: any) {
              console.error('Error confirming order:', error);
              Alert.alert('Error', error?.message || 'Failed to confirm order');
            } finally {
              isProcessingMutationRef.current = false;
            }
          }}
          onAssignRunner={() => {
            setShowOrderDetail(false);
            setShowRunnerSelection(true);
          }}
          onMarkDelivered={async () => {
            if (isProcessingMutationRef.current) return;
            
            Alert.alert(
              'Mark as Delivered',
              'Confirm that this order has been delivered?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delivered',
                  onPress: async () => {
                    isProcessingMutationRef.current = true;
                    try {
                      const result = await (deliveredMutation.mutateAsync as unknown as (orderId: string) => Promise<{ success: boolean; message?: string }>)(selectedOrder.id);
                      if (result?.success) {
                        // Wait briefly for real-time subscription to update cache
                        let attempts = 0;
                        let updated = getLatestOrder(selectedOrder.id);
                        while (!updated || updated.status !== 'delivered') {
                          await new Promise(resolve => setTimeout(resolve, 200));
                          updated = getLatestOrder(selectedOrder.id);
                          attempts++;
                          if (attempts >= 10) break; // Max 2 seconds wait
                        }
                        
                        Alert.alert('Success', 'Order marked as delivered');
                        setShowOrderDetail(false);
                        setSelectedOrder(null);
                        selectedOrderIdRef.current = null;
                      } else {
                        Alert.alert('Error', result?.message || 'Failed to mark as delivered');
                      }
                    } catch (error: any) {
                      console.error('Error marking order as delivered:', error);
                      Alert.alert('Error', error?.message || 'Failed to mark as delivered');
                    } finally {
                      isProcessingMutationRef.current = false;
                    }
                  },
                },
              ]
            );
          }}
          onCancel={async () => {
            if (isProcessingMutationRef.current) return;
            
            Alert.alert(
              'Cancel Order',
              'Select cancellation reason',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Out of Stock',
                  onPress: async () => {
                    isProcessingMutationRef.current = true;
                    try {
                      const result = await (cancelMutation.mutateAsync as unknown as (params: { orderId: string; reason: string }) => Promise<{ success: boolean; message?: string }>)({
                        orderId: selectedOrder.id,
                        reason: 'Items out of stock',
                      });
                      if (result?.success) {
                        // Wait briefly for real-time subscription to update cache
                        let attempts = 0;
                        let updated = getLatestOrder(selectedOrder.id);
                        while (!updated || updated.status !== 'cancelled') {
                          await new Promise(resolve => setTimeout(resolve, 200));
                          updated = getLatestOrder(selectedOrder.id);
                          attempts++;
                          if (attempts >= 10) break; // Max 2 seconds wait
                        }
                        
                        Alert.alert('Success', 'Order cancelled');
                        setShowOrderDetail(false);
                        setSelectedOrder(null);
                        selectedOrderIdRef.current = null;
                      } else {
                        Alert.alert('Error', result?.message || 'Failed to cancel order');
                      }
                    } catch (error: any) {
                      console.error('Error cancelling order:', error);
                      Alert.alert('Error', error?.message || 'Failed to cancel order');
                    } finally {
                      isProcessingMutationRef.current = false;
                    }
                  },
                },
                {
                  text: 'Other Reason',
                  onPress: async () => {
                    isProcessingMutationRef.current = true;
                    try {
                      const result = await (cancelMutation.mutateAsync as unknown as (params: { orderId: string; reason: string }) => Promise<{ success: boolean; message?: string }>)({
                        orderId: selectedOrder.id,
                        reason: 'Cancelled by shop',
                      });
                      if (result?.success) {
                        // Wait briefly for real-time subscription to update cache
                        let attempts = 0;
                        let updated = getLatestOrder(selectedOrder.id);
                        while (!updated || updated.status !== 'cancelled') {
                          await new Promise(resolve => setTimeout(resolve, 200));
                          updated = getLatestOrder(selectedOrder.id);
                          attempts++;
                          if (attempts >= 10) break; // Max 2 seconds wait
                        }
                        
                        Alert.alert('Success', 'Order cancelled');
                        setShowOrderDetail(false);
                        setSelectedOrder(null);
                        selectedOrderIdRef.current = null;
                      } else {
                        Alert.alert('Error', result?.message || 'Failed to cancel order');
                      }
                    } catch (error: any) {
                      console.error('Error cancelling order:', error);
                      Alert.alert('Error', error?.message || 'Failed to cancel order');
                    } finally {
                      isProcessingMutationRef.current = false;
                    }
                  },
                },
              ]
            );
          }}
          isConfirming={confirmMutation.isLoading}
          isMarkingDelivered={deliveredMutation.isLoading}
          isCancelling={cancelMutation.isLoading}
        />
      )}

      {/* Loading overlay when opening modal */}
      {isOpeningModal && (
        <View className="absolute inset-0 bg-black/20 items-center justify-center z-50">
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      )}

      {/* Runner Selection Modal */}
      {selectedOrder && (
        <RunnerSelectionModal
          visible={showRunnerSelection}
          shopId={shopId}
          order={selectedOrder}
          onClose={() => {
            setShowRunnerSelection(false);
            setShowOrderDetail(true);
          }}
          onSelect={async (runnerId: string) => {
            if (isProcessingMutationRef.current) return;
            
            isProcessingMutationRef.current = true;
            try {
              const result = await (assignRunnerMutation.mutateAsync as unknown as (params: { orderId: string; runnerId: string; shopId?: string }) => Promise<{ success: boolean; message?: string }>)({
                orderId: selectedOrder.id,
                runnerId,
                shopId,
              });
              if (result?.success) {
                // Wait briefly for real-time subscription to update cache
                let attempts = 0;
                let updated = getLatestOrder(selectedOrder.id);
                while (!updated || updated.status !== 'out_for_delivery') {
                  await new Promise(resolve => setTimeout(resolve, 200));
                  updated = getLatestOrder(selectedOrder.id);
                  attempts++;
                  if (attempts >= 10) break; // Max 2 seconds wait
                }
                
                if (updated && updated.status === 'out_for_delivery') {
                  setSelectedOrder(updated);
                }
                Alert.alert('Success', 'Runner assigned and order dispatched');
                setShowRunnerSelection(false);
                setShowOrderDetail(false);
                setSelectedOrder(null);
                selectedOrderIdRef.current = null;
              } else {
                Alert.alert('Error', result?.message || 'Failed to assign runner');
              }
            } catch (error: any) {
              console.error('Error assigning runner:', error);
              Alert.alert('Error', error?.message || 'Failed to assign runner');
            } finally {
              isProcessingMutationRef.current = false;
            }
          }}
          isAssigning={assignRunnerMutation.isLoading}
        />
      )}
    </View>
  );
}

// ============================================================================
// ORDER CARD COMPONENT
// ============================================================================

interface OrderCardProps {
  order: OrderWithAll;
  onPress: () => void | Promise<void>;
  shopId: string;
}

function OrderCard({ order, onPress }: OrderCardProps) {
  const statusDisplay = getOrderStatusDisplay(order.status);
  const placedDate = new Date(order.placed_at);
  const timeLabel = placedDate.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate elapsed time for active orders
  const elapsedSeconds = React.useMemo(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return 0;
    
    let startTime: Date;
    if (order.status === 'pending') {
      startTime = new Date(order.placed_at);
    } else if (order.status === 'confirmed') {
      startTime = new Date(order.confirmed_at!);
    } else if (order.status === 'out_for_delivery') {
      startTime = new Date(order.out_for_delivery_at!);
    } else {
      return 0;
    }

    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }, [order, Date.now()]);

  // Use timer to update every second
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (order.status !== 'delivered' && order.status !== 'cancelled') {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [order.status]);

  const itemsPreview = order.order_items.slice(0, 5);
  const remainingCount = order.order_items.length - 5;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-4 border border-gray-200"
      activeOpacity={0.7}
    >
      {/* Order Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-gray-900 text-base font-bold mb-1">
            {order.order_number}
          </Text>
          <Text className="text-gray-500 text-xs">{timeLabel}</Text>
        </View>
        <View
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: `${statusDisplay.color}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: statusDisplay.color }}
          >
            {statusDisplay.title}
          </Text>
        </View>
      </View>

      {/* Timer for active orders */}
      {elapsedSeconds > 0 && (
        <View className="mb-3">
          <Text className="text-gray-700 text-sm font-semibold">
            ⏱️ {formatDuration(elapsedSeconds)}
          </Text>
        </View>
      )}

      {/* Customer Info */}
      {order.customer_name && (
        <View className="mb-2">
          <Text className="text-gray-900 text-sm font-medium">
            {order.customer_name}
          </Text>
          {order.customer_email && (
            <Text className="text-gray-500 text-xs">{order.customer_email}</Text>
          )}
        </View>
      )}

      {/* Delivery Address Preview */}
      <View className="mb-3">
        <Text className="text-gray-700 text-sm">
          📍 {order.delivery_address.street_address.split(',').slice(0, 2).join(',')}
          {order.delivery_address.landmark && ` (${order.delivery_address.landmark})`}
        </Text>
      </View>

      {/* Items Preview */}
      <View className="mb-3">
        {itemsPreview.map((item) => (
          <Text key={item.id} className="text-gray-500 text-xs">
            {item.quantity} × {item.item_name}
          </Text>
        ))}
        {remainingCount > 0 && (
          <Text className="text-gray-400 text-xs">+{remainingCount} more</Text>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
        <Text className="text-gray-900 text-base font-bold">
          {formatPrice(order.total_cents)}
        </Text>
        <Text className="text-blue-600 text-sm font-semibold">View Details →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// ORDER DETAIL MODAL
// ============================================================================

interface OrderDetailModalProps {
  visible: boolean;
  order: OrderWithAll;
  onClose: () => void;
  onConfirm: () => void;
  onAssignRunner: () => void;
  onMarkDelivered: () => void;
  onCancel: () => void;
  isConfirming: boolean;
  isMarkingDelivered: boolean;
  isCancelling: boolean;
}

function OrderDetailModal({
  visible,
  order,
  onClose,
  onConfirm,
  onAssignRunner,
  onMarkDelivered,
  onCancel,
  isConfirming,
  isMarkingDelivered,
  isCancelling,
}: OrderDetailModalProps) {
  const statusDisplay = useMemo(() => getOrderStatusDisplay(order.status), [order.status]);

  const handleGetDirections = useCallback(() => {
    const { latitude, longitude } = order.delivery_address;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  }, [order.delivery_address]);

  // Memoize button handlers to prevent unnecessary re-renders
  const handleConfirm = useCallback(() => {
    if (!isConfirming) {
      onConfirm();
    }
  }, [onConfirm, isConfirming]);

  const handleAssignRunner = useCallback(() => {
    onAssignRunner();
  }, [onAssignRunner]);

  const handleMarkDelivered = useCallback(() => {
    if (!isMarkingDelivered) {
      onMarkDelivered();
    }
  }, [onMarkDelivered, isMarkingDelivered]);

  const handleCancel = useCallback(() => {
    if (!isCancelling) {
      onCancel();
    }
  }, [onCancel, isCancelling]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-gray-900 text-lg font-bold">
                {order.order_number}
              </Text>
              <View
                className="px-2 py-1 rounded-full mt-1 self-start"
                style={{ backgroundColor: `${statusDisplay.color}20` }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: statusDisplay.color }}
                >
                  {statusDisplay.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-gray-600 text-lg">✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          {/* Customer Details */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">Customer</Text>
            {order.customer_name && (
              <Text className="text-gray-900 text-base font-semibold">
                {order.customer_name}
              </Text>
            )}
            {order.customer_email && (
              <Text className="text-gray-600 text-sm mt-1">{order.customer_email}</Text>
            )}
          </View>

          {/* Delivery Address */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">
              Delivery Address
            </Text>
            <Text className="text-gray-900 text-base">
              {order.delivery_address.street_address}
            </Text>
            <Text className="text-gray-600 text-sm mt-1">
              {order.delivery_address.city}
              {order.delivery_address.region && `, ${order.delivery_address.region}`}
            </Text>
            {order.delivery_address.landmark && (
              <View className="mt-2">
                <Text className="text-xs text-gray-500">Landmark</Text>
                <Text className="text-gray-700 text-sm">
                  {order.delivery_address.landmark}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleGetDirections}
              className="mt-3 bg-blue-50 px-4 py-2 rounded-lg self-start"
            >
              <Text className="text-blue-600 font-semibold">Get Directions</Text>
            </TouchableOpacity>
          </View>

          {/* Special Instructions */}
          {order.special_instructions && (
            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-2">
                Special Instructions
              </Text>
              <Text className="text-gray-700 text-sm">{order.special_instructions}</Text>
            </View>
          )}

          {/* Order Items */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">Order Items</Text>
            {order.order_items.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row justify-between py-2 ${
                  index < order.order_items.length - 1 ? 'border-b border-gray-100' : ''
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

          {/* Payment Summary */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold text-gray-900 mb-3">Payment Summary</Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">Subtotal</Text>
              <Text className="text-gray-900 text-base font-semibold">
                {formatPrice(order.subtotal_cents)}
              </Text>
            </View>
            {order.surcharge_cents > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-gray-600 text-base">Surcharge</Text>
                <Text className="text-gray-900 text-base font-semibold">
                  {formatPrice(order.surcharge_cents)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between mb-2">
              <Text className="text-gray-600 text-base">Delivery</Text>
              <Text className="text-gray-900 text-base font-semibold">
                {formatPrice(order.delivery_fee_cents)}
              </Text>
            </View>
            <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
              <Text className="text-gray-900 text-lg font-bold">Total</Text>
              <Text className="text-gray-900 text-lg font-bold">
                {formatPrice(order.total_cents)}
              </Text>
            </View>
            <View className="mt-3 pt-3 border-t border-gray-200">
              <View className="flex-row justify-between">
                <Text className="text-gray-600 text-base">Payment</Text>
                <Text className="text-gray-900 text-base font-semibold capitalize">
                  {order.payment_method}
                </Text>
              </View>
            </View>
          </View>

          {/* Runner Info (if assigned) */}
          {order.delivery_runner && (
            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                Delivery Runner
              </Text>
              <Text className="text-gray-900 text-base font-semibold">
                {order.delivery_runner.name}
              </Text>
              <Text className="text-gray-600 text-sm">{order.delivery_runner.phone_number}</Text>
            </View>
          )}
        </ScrollView>

          {/* Action Buttons */}
        <View className="bg-white border-t border-gray-200 px-4 py-4" style={{ paddingBottom: 20 }}>
          {order.status === 'pending' && (
            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={isConfirming}
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                {isConfirming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold">Confirm Order</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={isCancelling}
                className="bg-red-100 rounded-xl py-3 px-4"
                activeOpacity={0.7}
              >
                <Text className="text-red-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'confirmed' && (
            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={handleAssignRunner}
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                <Text className="text-white font-bold">Assign Runner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={isCancelling}
                className="bg-red-100 rounded-xl py-3 px-4"
                activeOpacity={0.7}
              >
                <Text className="text-red-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'out_for_delivery' && (
            <View className="flex-row space-x-2">
              <TouchableOpacity
                onPress={handleMarkDelivered}
                disabled={isMarkingDelivered}
                className="flex-1 bg-green-600 rounded-xl py-3 items-center"
                activeOpacity={0.7}
              >
                {isMarkingDelivered ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold">Mark as Delivered</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={isCancelling}
                className="bg-red-100 rounded-xl py-3 px-4"
                activeOpacity={0.7}
              >
                <Text className="text-red-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// RUNNER SELECTION MODAL
// ============================================================================

interface RunnerSelectionModalProps {
  visible: boolean;
  shopId: string;
  order: OrderWithAll;
  onClose: () => void;
  onSelect: (runnerId: string) => void;
  isAssigning: boolean;
}

function RunnerSelectionModal({
  visible,
  shopId,
  order,
  onClose,
  onSelect,
  isAssigning,
}: RunnerSelectionModalProps) {
  const { data: runners, isLoading } = useDeliveryRunners(shopId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 text-lg font-bold">Select Runner</Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-gray-600 text-lg">✕</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-gray-500 text-sm mt-1">{order.order_number}</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : !runners || runners.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text className="text-gray-600 text-center">
              No delivery runners available. Add runners in shop settings.
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
                            ✓ Free
                          </Text>
                        </View>
                      ) : (
                        <View className="px-2 py-1 bg-orange-100 rounded-full self-start">
                          <Text className="text-orange-700 text-xs font-semibold">
                            🚚 Delivering: {runner.current_order_number}
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
              <Text className="text-gray-900 mt-4 font-semibold">Assigning runner...</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFilterLabel(filter: OrderTimeFilter): string {
  switch (filter) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case '7days':
      return 'Last 7 Days';
    case '30days':
      return 'Last 30 Days';
    case 'all':
      return 'All Time';
    default:
      return filter;
  }
}

function getFilteredOrdersByTime(
  orders: OrderWithAll[],
  filter: OrderTimeFilter
): OrderWithAll[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return orders.filter((o) => new Date(o.placed_at) >= todayStart);
    case 'yesterday':
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return orders.filter(
        (o) =>
          new Date(o.placed_at) >= yesterdayStart &&
          new Date(o.placed_at) < todayStart
      );
    case '7days':
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return orders.filter((o) => new Date(o.placed_at) >= sevenDaysAgo);
    case '30days':
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orders.filter((o) => new Date(o.placed_at) >= thirtyDaysAgo);
    case 'all':
    default:
      return orders;
  }
}

