import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MerchantShop } from '../../../../services/merchant/shopService';
import type { RootStackParamList } from '../../../../navigation/types';
import { useDeliveryAreas } from '../../../../hooks/merchant/useDeliveryAreas';
import {
  useDeliveryRunners,
  useCreateDeliveryRunner,
  useUpdateDeliveryRunner,
  useDeleteDeliveryRunner,
} from '../../../../hooks/merchant/useDeliveryRunners';
import { useDeliveryLogic, useSaveDeliveryLogic } from '../../../../hooks/merchant/useDeliveryLogic';
import type { DeliveryRunner } from '../../../../services/merchant/deliveryRunnerService';
import { DeliveryRunnerFormSheet } from '../../../../components/merchant/delivery/DeliveryRunnerFormSheet';
import { DeliveryLogicFormSheet } from '../../../../components/merchant/delivery/DeliveryLogicFormSheet';
import { DistanceLayerFormSheet } from '../../../../components/merchant/delivery/DistanceLayerFormSheet';
import EditIcon from '../../../../icons/EditIcon';
import DeleteIcon from '../../../../icons/DeleteIcon';

type DeliverySectionProps = {
  shop: MerchantShop;
};

export default function DeliverySection({ shop }: DeliverySectionProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: areas, isLoading } = useDeliveryAreas(shop.id);
  const { data: runners, isLoading: isLoadingRunners } = useDeliveryRunners(shop.id);
  const { data: deliveryLogic, isLoading: isLoadingLogic } = useDeliveryLogic(shop.id);

  const [isFormOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedRunner, setSelectedRunner] = useState<DeliveryRunner | null>(null);
  const [isLogicFormOpen, setLogicFormOpen] = useState(false);
  const [isDistanceFormOpen, setDistanceFormOpen] = useState(false);

  const createMutation = useCreateDeliveryRunner(shop.id);
  const updateMutation = useUpdateDeliveryRunner(shop.id);
  const deleteMutation = useDeleteDeliveryRunner(shop.id);
  const saveLogicMutation = useSaveDeliveryLogic(shop.id);

  const areaSummary = useMemo(() => {
    if (!areas || areas.length === 0) {
      return {
        title: 'No zones set',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-600',
      };
    }

    return {
      title: `${areas.length} ${areas.length === 1 ? 'zone' : 'zones'}`,
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-600',
    };
  }, [areas]);

  const handleAddRunner = () => {
    setFormMode('create');
    setSelectedRunner(null);
    setFormOpen(true);
  };

  const handleEditRunner = (runner: DeliveryRunner) => {
    setFormMode('edit');
    setSelectedRunner(runner);
    setFormOpen(true);
  };

  const handleDeleteRunner = (runner: DeliveryRunner) => {
    Alert.alert(
      'Delete Runner',
      `Are you sure you want to delete ${runner.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(runner.id);
          },
        },
      ]
    );
  };

  const handleSubmitForm = async (values: { name: string; phoneNumber: string }) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync({ name: values.name, phoneNumber: values.phoneNumber });
        setFormOpen(false);
        setSelectedRunner(null);
      } else if (selectedRunner) {
        await updateMutation.mutateAsync({
          runnerId: selectedRunner.id,
          payload: { name: values.name, phoneNumber: values.phoneNumber },
        });
        setFormOpen(false);
        setSelectedRunner(null);
      }
    } catch (error) {
      // Error handling is done by react-query
      console.error('Failed to save delivery runner', error);
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedRunner(null);
  };

  const confirmDeleteRunner = () => {
    if (!selectedRunner) return;
    handleDeleteRunner(selectedRunner);
    setFormOpen(false);
    setSelectedRunner(null);
  };

  const handleOpenLogicForm = () => {
    setLogicFormOpen(true);
  };

  const handleCloseLogicForm = () => {
    setLogicFormOpen(false);
  };

  const handleSubmitLogicForm = async (values: {
    minimumOrderValue: number;
    smallOrderSurcharge: number;
    leastOrderValue: number;
    freeDeliveryThreshold: number;
    freeDeliveryRadius: number;
  }) => {
    try {
      await saveLogicMutation.mutateAsync(values);
      setLogicFormOpen(false);
    } catch (error) {
      console.error('Failed to save delivery logic', error);
    }
  };

  const handleOpenDistanceForm = () => {
    setDistanceFormOpen(true);
  };

  const handleCloseDistanceForm = () => {
    setDistanceFormOpen(false);
  };

  const handleSubmitDistanceForm = async (values: {
    distanceMode: 'auto' | 'custom';
    maxDeliveryFee: number;
    distanceTiers?: any[];
    beyondTierFeePerUnit: number;
    beyondTierDistanceUnit: number;
  }) => {
    try {
      // Merge with existing logic values
      await saveLogicMutation.mutateAsync({
        minimumOrderValue: deliveryLogic?.minimumOrderValue || 200,
        smallOrderSurcharge: deliveryLogic?.smallOrderSurcharge || 40,
        leastOrderValue: deliveryLogic?.leastOrderValue || 100,
        freeDeliveryThreshold: deliveryLogic?.freeDeliveryThreshold || 800,
        freeDeliveryRadius: deliveryLogic?.freeDeliveryRadius || 1000,
        ...values,
      });
      setDistanceFormOpen(false);
    } catch (error) {
      console.error('Failed to save distance layer settings', error);
    }
  };

  return (
    <>
      <View className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-base font-semibold text-gray-900">Delivery Areas</Text>
            <Text className="text-xs text-gray-500 mt-1">
              Draw zones on the map to define where you deliver. Customers only see your shop if their location is within these zones.
            </Text>
          </View>
          <TouchableOpacity
            className="rounded-full bg-blue-600 px-4 py-2"
            onPress={() => navigation.navigate('ManageDeliveryAreas', { shop })}
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-white">Manage</Text>
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color="#2563eb" />
            <Text className="ml-2 text-xs text-gray-500">Loading zones...</Text>
          </View>
        ) : (
          <View className={`inline-flex self-start rounded-full px-3 py-1 ${areaSummary.badgeBg}`}>
            <Text className={`text-xs font-semibold ${areaSummary.badgeText}`}>
              {areaSummary.title}
            </Text>
          </View>
        )}

        {/* Delivery Runners Section */}
        <View className="mt-6 pt-6 border-t border-gray-100">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base font-semibold text-gray-900">Delivery Runners</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Manage delivery runners who handle orders for this shop.
              </Text>
            </View>
            <TouchableOpacity
              className="rounded-full bg-blue-600 px-4 py-2"
              onPress={handleAddRunner}
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-white">Add</Text>
            </TouchableOpacity>
          </View>

          {isLoadingRunners ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="ml-2 text-xs text-gray-500">Loading runners...</Text>
            </View>
          ) : runners && runners.length > 0 ? (
            <View className="space-y-2">
              {runners.map((runner) => (
                <View
                  key={runner.id}
                  className="flex-row items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100"
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-semibold text-gray-900">{runner.name}</Text>
                    <Text className="text-xs text-gray-500 mt-1">{runner.phoneNumber}</Text>
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                      onPress={() => handleEditRunner(runner)}
                      className="p-2"
                      accessibilityRole="button"
                    >
                      <EditIcon size={20} color="#4B5563" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteRunner(runner)}
                      className="p-2"
                      accessibilityRole="button"
                    >
                      <DeleteIcon size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Text className="text-xs text-blue-600">
                No delivery runners added yet. Click "Add" to add your first runner.
              </Text>
            </View>
          )}
        </View>

        {/* Delivery Logic Section */}
        <View className="mt-6 pt-6 border-t border-gray-100">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base font-semibold text-gray-900">Delivery Logic</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Configure order value thresholds, surcharges, and delivery rules.
              </Text>
            </View>
            <TouchableOpacity
              className="rounded-full bg-blue-600 px-4 py-2"
              onPress={handleOpenLogicForm}
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-white">Configure</Text>
            </TouchableOpacity>
          </View>

          {isLoadingLogic ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="ml-2 text-xs text-gray-500">Loading settings...</Text>
            </View>
          ) : (
            <View className="space-y-3">
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xs text-gray-600">Minimum Order Value</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    Rs {deliveryLogic?.minimumOrderValue.toFixed(0) || '200'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  Orders below this value will have a surcharge applied
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xs text-gray-600">Small Order Surcharge</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    Rs {deliveryLogic?.smallOrderSurcharge.toFixed(0) || '40'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  Applied when order value is below minimum
                </Text>
              </View>

              <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xs text-gray-600">Least Order Value (Hard Floor)</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    Rs {deliveryLogic?.leastOrderValue.toFixed(0) || '100'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  Orders below this value will be rejected at checkout
                </Text>
              </View>

              {/* Free Delivery */}
              <View className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <View className="flex-row items-center mb-2">
                  <Text className="text-xs font-semibold text-emerald-900">🎉 Free Delivery</Text>
                </View>
                <Text className="text-xs text-emerald-700 mb-1">
                  • Order value ≥ Rs {deliveryLogic?.freeDeliveryThreshold.toFixed(0) || '800'}
                </Text>
                <Text className="text-xs text-emerald-700">
                  • Distance ≤ {deliveryLogic?.freeDeliveryRadius.toFixed(0) || '1000'}m
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Distance Tiering Section */}
        <View className="mt-6 pt-6 border-t border-gray-100">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-3">
              <Text className="text-base font-semibold text-gray-900">Distance Tiering</Text>
              <Text className="text-xs text-gray-500 mt-1">
                Auto mode calculates delivery fees based on distance. Most merchants use default settings.
              </Text>
            </View>
            <TouchableOpacity
              className="rounded-full bg-blue-600 px-4 py-2"
              onPress={handleOpenDistanceForm}
              accessibilityRole="button"
            >
              <Text className="text-sm font-semibold text-white">Configure</Text>
            </TouchableOpacity>
          </View>

          {isLoadingLogic ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="ml-2 text-xs text-gray-500">Loading settings...</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {/* Distance Mode Badge */}
              <View className="flex-row items-center mb-2">
                <View className={`rounded-full px-3 py-1 ${
                  deliveryLogic?.distanceMode === 'custom' 
                    ? 'bg-orange-50' 
                    : 'bg-purple-50'
                }`}>
                  <Text className={`text-xs font-semibold ${
                    deliveryLogic?.distanceMode === 'custom' 
                      ? 'text-orange-600' 
                      : 'text-purple-600'
                  }`}>
                    {deliveryLogic?.distanceMode === 'custom' ? '⚙️ Custom Mode' : '🤖 Auto Mode'}
                  </Text>
                </View>
              </View>

              {/* Distance Tiers Preview */}
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <Text className="text-xs font-semibold text-gray-700 mb-2">Distance Tiers</Text>
                <View className="space-y-1">
                  {deliveryLogic?.distanceTiers?.slice(0, 3).map((tier: any, index: number) => (
                    <View key={index} className="flex-row justify-between">
                      <Text className="text-xs text-gray-600">
                        {index === 0 ? '≤' : `${deliveryLogic.distanceTiers[index - 1].max_distance + 1} -`} {tier.max_distance}m
                      </Text>
                      <Text className="text-xs font-semibold text-gray-900">Rs {tier.fee}</Text>
                    </View>
                  ))}
                  {deliveryLogic && deliveryLogic.distanceTiers && deliveryLogic.distanceTiers.length > 3 && (
                    <Text className="text-xs text-gray-500 italic">
                      +{deliveryLogic.distanceTiers.length - 3} more tiers...
                    </Text>
                  )}
                </View>
              </View>

              {/* Max Delivery Fee */}
              <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xs text-gray-600">Maximum Delivery Fee</Text>
                  <Text className="text-sm font-semibold text-gray-900">
                    Rs {deliveryLogic?.maxDeliveryFee.toFixed(0) || '130'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500">
                  Cap on the maximum delivery fee charged
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <DeliveryRunnerFormSheet
        visible={isFormOpen}
        mode={formMode}
        defaultRunner={selectedRunner}
        loading={createMutation.isLoading || updateMutation.isLoading}
        deleteLoading={deleteMutation.isLoading}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        onDelete={formMode === 'edit' ? confirmDeleteRunner : undefined}
      />

      <DeliveryLogicFormSheet
        visible={isLogicFormOpen}
        defaultLogic={deliveryLogic}
        loading={saveLogicMutation.isLoading}
        onClose={handleCloseLogicForm}
        onSubmit={handleSubmitLogicForm}
      />

      <DistanceLayerFormSheet
        visible={isDistanceFormOpen}
        defaultLogic={deliveryLogic}
        loading={saveLogicMutation.isLoading}
        onClose={handleCloseDistanceForm}
        onSubmit={handleSubmitDistanceForm}
      />
    </>
  );
}

