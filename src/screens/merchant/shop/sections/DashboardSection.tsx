import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import OrdersRevenueLineChart from '../../../../components/merchant/charts/OrdersRevenueLineChart';
import { useShopOrderTimeSeries, useShopOrderAnalytics } from '../../../../hooks/merchant/useOrders';
import { formatDuration } from '../../../../types/orders';

type DashboardSectionProps = {
  shop: MerchantShop;
};

type RangeType = 'today' | 'yesterday' | '7_days' | '30_days' | 'all_time' | 'custom';

export default function DashboardSection({ shop }: DashboardSectionProps) {
  const [range, setRange] = useState<RangeType>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startInput, setStartInput] = useState({ day: '', month: '', year: '' });
  const [endInput, setEndInput] = useState({ day: '', month: '', year: '' });
  const [dateError, setDateError] = useState<string | null>(null);

  // Map DashboardSection range to order service timeFilter
  const timeFilterMap: Record<RangeType, 'today' | 'yesterday' | '7days' | '30days' | 'all_time' | 'custom'> = {
    today: 'today',
    yesterday: 'yesterday',
    '7_days': '7days',
    '30_days': '30days',
    all_time: 'all_time',
    custom: 'custom',
  };

  // Fetch real time-series data
  const { data: timeSeriesData, isLoading: isLoadingChart } = useShopOrderTimeSeries(
    shop.id,
    timeFilterMap[range],
    customStartDate || undefined,
    customEndDate || undefined
  );

  // Fetch ALL-TIME analytics for the metrics cards (always shows all-time data, independent of chart filter)
  const { data: allTimeAnalytics, isLoading: isLoadingAllTime } = useShopOrderAnalytics(
    shop.id,
    'all' // Always fetch all-time data for metrics cards
  );

  // Calculate previous period for comparison (compare current all-time with previous all-time)
  // We'll compare current all-time with all-time from 30 days ago
  const previousAllTimeFilter = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return { startDate: undefined, endDate: thirtyDaysAgo };
  }, []);

  // Fetch previous all-time analytics (all orders before 30 days ago) for comparison
  const { data: previousAllTimeAnalytics } = useShopOrderAnalytics(
    shop.id,
    undefined,
    undefined,
    previousAllTimeFilter.endDate
  );

  // Calculate time differences (always using all-time data)
  const timeMetrics = useMemo(() => {
    console.log('All-Time Analytics:', allTimeAnalytics);
    console.log('Previous All-Time Analytics:', previousAllTimeAnalytics);
    
    if (!allTimeAnalytics) {
        return {
        confirmation: { current: null, change: null, changeType: null },
        preparation: { current: null, change: null, changeType: null },
        delivery: { current: null, change: null, changeType: null },
        };
      }
      
    const calculateChange = (current: number | undefined, previous: number | undefined) => {
      if (current === undefined || current === null) return { change: null, changeType: null };
      if (previous === undefined || previous === null) return { change: null, changeType: null };
      
      const diff = Math.round(current - previous);
      if (diff === 0) return { change: null, changeType: null };
        return {
        change: Math.abs(diff),
        changeType: diff > 0 ? 'up' : 'down',
        };
    };

        return {
      confirmation: {
        current: allTimeAnalytics.average_confirmation_time_seconds,
        ...calculateChange(
          allTimeAnalytics.average_confirmation_time_seconds,
          previousAllTimeAnalytics?.average_confirmation_time_seconds
        ),
      },
      preparation: {
        current: allTimeAnalytics.average_preparation_time_seconds,
        ...calculateChange(
          allTimeAnalytics.average_preparation_time_seconds,
          previousAllTimeAnalytics?.average_preparation_time_seconds
        ),
      },
      delivery: {
        current: allTimeAnalytics.average_delivery_time_seconds,
        ...calculateChange(
          allTimeAnalytics.average_delivery_time_seconds,
          previousAllTimeAnalytics?.average_delivery_time_seconds
        ),
      },
    };
  }, [allTimeAnalytics, previousAllTimeAnalytics]);

  // Generate chart data from real data
  const chartConfig = useMemo(() => {
    if (isLoadingChart || !timeSeriesData) {
          return {
        xLabels: [] as string[],
        yLabels: [0] as number[],
        data: [] as number[],
        orders: 0,
        revenue: 0,
          };
        }
        
    const data = timeSeriesData as { xLabels: string[]; data: number[]; orders: number; revenue: number };

    // Generate yLabels based on max value
    const maxValue = Math.max(...(data.data || []), 1);
    const yMax = Math.ceil(maxValue / 1000) * 1000 || 1000;
        const yLabels = Array.from({ length: 5 }, (_, i) => Math.floor((yMax / 4) * i));
        
        return {
      xLabels: data.xLabels || [],
          yLabels,
      data: data.data || [],
      orders: data.orders || 0,
      revenue: data.revenue || 0, // This is in cents
        };
  }, [timeSeriesData, isLoadingChart]);

  const chartData = chartConfig.data.map((value: number, index: number) => ({
    label: chartConfig.xLabels[index] || '',
    value,
  }));

  const formatFromDate = (date: Date | null) => {
    if (!date) {
      return { day: '', month: '', year: '' };
    }

    const pad = (value: number) => value.toString().padStart(2, '0');
    return {
      day: pad(date.getDate()),
      month: pad(date.getMonth() + 1),
      year: date.getFullYear().toString(),
    };
  };

  const handleRangeSelect = (selectedRange: RangeType) => {
    if (selectedRange === 'custom') {
      setStartInput(formatFromDate(customStartDate));
      setEndInput(formatFromDate(customEndDate));
      setDateError(null);
      setShowDatePicker(true);
    }
    setRange(selectedRange);
  };

  const parseDateInput = (input: { day: string; month: string; year: string }) => {
    const day = Number(input.day);
    const month = Number(input.month);
    const year = Number(input.year);

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return null;
    }

    if (input.year.length !== 4) {
      return null;
    }

    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  };

  const handleApplyCustomRange = () => {
    const startDate = parseDateInput(startInput);
    const endDate = parseDateInput(endInput);

    if (!startDate || !endDate) {
      setDateError('Enter valid dates in DD / MM / YYYY format.');
      return;
    }

    if (startDate > endDate) {
      setDateError('Start date cannot be after end date.');
      return;
    }

    if (endDate < startDate) {
      setDateError('End date cannot be before start date.');
      return;
    }

    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    setDateError(null);
    setShowDatePicker(false);

    Alert.alert(
      'Custom range applied',
      `Showing stats from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`
    );
  };

  const formatDateRange = () => {
    if (!customStartDate && !customEndDate) {
      return 'Select dates';
    }
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (customStartDate && customEndDate) {
      return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
    }
    if (customStartDate) {
      return `From ${formatDate(customStartDate)}`;
    }
    return `Until ${formatDate(customEndDate!)}`;
  };

  const rangeLabel = useMemo(() => {
    switch (range) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case '7_days':
        return 'Last 7 days';
      case '30_days':
        return 'Last 30 days';
      case 'all_time':
        return 'All time';
      case 'custom':
        return 'Custom';
      default:
        return 'Today';
    }
  }, [range]);

  const reviews = useMemo(
    () => [
      {
        id: '1',
        rating: 5,
        customer: 'Nadia Khan',
        review: 'Delivery was super fast and everything was fresh. Keep it up!',
        timestamp: 'Oct 28, 10:24 AM',
      },
      {
        id: '2',
        rating: 4,
        customer: 'Imran Ahmad',
        review: 'Great experience overall. Would love more vegetarian options.',
        timestamp: 'Oct 27, 06:10 PM',
      },
      {
        id: '3',
        rating: 5,
        customer: 'Sara Malik',
        review: 'Customer support was very helpful with my order modifications.',
        timestamp: 'Oct 25, 01:45 PM',
      },
    ],
    []
  );

  return (
    <View className="space-y-4">
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">Summary</Text>
        </View>

        <View className="mt-5 flex-row flex-wrap">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: '7_days', label: '7 days' },
            { key: '30_days', label: '30 days' },
            { key: 'all_time', label: 'All time' },
            { key: 'custom', label: range === 'custom' && (customStartDate || customEndDate) ? formatDateRange() : 'Custom' },
          ].map((item) => {
            const isActive = range === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => handleRangeSelect(item.key as RangeType)}
                className={`mb-2 mr-2 px-4 py-2 rounded-full border ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <Text className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="mt-6 bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
          <View className="mb-6">
            <Text className="text-sm text-gray-500">Orders</Text>
            {isLoadingChart ? (
              <ActivityIndicator size="small" color="#3B82F6" className="mt-2" />
            ) : (
            <Text className="text-3xl font-semibold text-gray-900 mt-1">{chartConfig.orders.toLocaleString()}</Text>
            )}
          </View>
          <View className="mb-6">
            <Text className="text-sm text-gray-500">Revenue</Text>
            {isLoadingChart ? (
              <ActivityIndicator size="small" color="#3B82F6" className="mt-2" />
            ) : (
              <Text className="text-3xl font-semibold text-gray-900 mt-1">
                Rs {((chartConfig.revenue || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            )}
          </View>

          <View className="overflow-hidden">
            {isLoadingChart ? (
              <View className="h-40 items-center justify-center">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="text-gray-500 mt-2">Loading chart data...</Text>
              </View>
            ) : chartConfig.data.length > 0 ? (
            <OrdersRevenueLineChart data={chartData} xLabels={chartConfig.xLabels} yLabels={chartConfig.yLabels} />
            ) : (
              <View className="h-40 items-center justify-center">
                <Text className="text-gray-500">No data available for this period</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Time Metrics Cards Section - Always shows all-time averages, separate from chart */}
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md mt-4">
        <Text className="text-lg font-bold text-gray-900 mb-4">Performance Metrics (All-Time)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, paddingRight: 16 }}
            style={{ minHeight: 120 }}
          >
            {/* Loading state */}
            {isLoadingAllTime && (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 mr-3 min-w-[200px] items-center justify-center">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="text-xs text-gray-500 mt-2">Loading metrics...</Text>
              </View>
            )}

            {/* Confirmation Time Card */}
            {!isLoadingAllTime && (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 mr-3 min-w-[200px] shadow-sm">
                <Text className="text-xs text-gray-500 mb-1">Confirmation Time</Text>
                <View className="flex-row items-baseline flex-wrap">
                  {timeMetrics.confirmation.current !== null && timeMetrics.confirmation.current !== undefined ? (
                    <>
                      <Text className="text-2xl font-bold text-gray-900">
                        {formatDuration(timeMetrics.confirmation.current)}
                      </Text>
                      {timeMetrics.confirmation.change !== null && timeMetrics.confirmation.changeType === 'up' && (
                        <View className="ml-2 flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                          <Text className="text-green-600 text-xs font-semibold">↑</Text>
                          <Text className="text-green-600 text-xs font-semibold ml-1">
                            +{formatDuration(timeMetrics.confirmation.change)}
                          </Text>
                        </View>
                      )}
                      {timeMetrics.confirmation.change !== null && timeMetrics.confirmation.changeType === 'down' && (
                        <View className="ml-2 flex-row items-center bg-red-50 px-2 py-1 rounded-full">
                          <Text className="text-red-600 text-xs font-semibold">↓</Text>
                          <Text className="text-red-600 text-xs font-semibold ml-1">
                            -{formatDuration(timeMetrics.confirmation.change)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text className="text-lg text-gray-400">No data</Text>
                  )}
                </View>
                <Text className="text-xs text-gray-400 mt-1">Average time</Text>
              </View>
            )}

            {/* Preparation Time Card */}
            {!isLoadingAllTime && (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 mr-3 min-w-[200px] shadow-sm">
                <Text className="text-xs text-gray-500 mb-1">Preparation Time</Text>
                <View className="flex-row items-baseline flex-wrap">
                  {timeMetrics.preparation.current !== null && timeMetrics.preparation.current !== undefined ? (
                    <>
                      <Text className="text-2xl font-bold text-gray-900">
                        {formatDuration(timeMetrics.preparation.current)}
                      </Text>
                      {timeMetrics.preparation.change !== null && timeMetrics.preparation.changeType === 'up' && (
                        <View className="ml-2 flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                          <Text className="text-green-600 text-xs font-semibold">↑</Text>
                          <Text className="text-green-600 text-xs font-semibold ml-1">
                            +{formatDuration(timeMetrics.preparation.change)}
                          </Text>
                        </View>
                      )}
                      {timeMetrics.preparation.change !== null && timeMetrics.preparation.changeType === 'down' && (
                        <View className="ml-2 flex-row items-center bg-red-50 px-2 py-1 rounded-full">
                          <Text className="text-red-600 text-xs font-semibold">↓</Text>
                          <Text className="text-red-600 text-xs font-semibold ml-1">
                            -{formatDuration(timeMetrics.preparation.change)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text className="text-lg text-gray-400">No data</Text>
                  )}
                </View>
                <Text className="text-xs text-gray-400 mt-1">Average time</Text>
              </View>
            )}

            {/* Delivery Time Card */}
            {!isLoadingAllTime && (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 mr-3 min-w-[200px] shadow-sm">
                <Text className="text-xs text-gray-500 mb-1">Delivery Time</Text>
                <View className="flex-row items-baseline flex-wrap">
                  {timeMetrics.delivery.current !== null && timeMetrics.delivery.current !== undefined ? (
                    <>
                      <Text className="text-2xl font-bold text-gray-900">
                        {formatDuration(timeMetrics.delivery.current)}
                      </Text>
                      {timeMetrics.delivery.change !== null && timeMetrics.delivery.changeType === 'up' && (
                        <View className="ml-2 flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                          <Text className="text-green-600 text-xs font-semibold">↑</Text>
                          <Text className="text-green-600 text-xs font-semibold ml-1">
                            +{formatDuration(timeMetrics.delivery.change)}
                          </Text>
                        </View>
                      )}
                      {timeMetrics.delivery.change !== null && timeMetrics.delivery.changeType === 'down' && (
                        <View className="ml-2 flex-row items-center bg-red-50 px-2 py-1 rounded-full">
                          <Text className="text-red-600 text-xs font-semibold">↓</Text>
                          <Text className="text-red-600 text-xs font-semibold ml-1">
                            -{formatDuration(timeMetrics.delivery.change)}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text className="text-lg text-gray-400">No data</Text>
                  )}
                </View>
                <Text className="text-xs text-gray-400 mt-1">Average time</Text>
              </View>
            )}
          </ScrollView>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text className="text-blue-600 font-semibold text-base">Close</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-6">
              <View>
                <Text className="text-sm font-semibold text-gray-700 mb-3">Start Date</Text>
                <View className="flex-row space-x-3">
                  {[
                    { key: 'day', placeholder: 'DD', maxLength: 2 },
                    { key: 'month', placeholder: 'MM', maxLength: 2 },
                    { key: 'year', placeholder: 'YYYY', maxLength: 4 },
                  ].map((field) => (
                    <View key={`start-${field.key}`} className="flex-1">
                      <TextInput
                        value={startInput[field.key as keyof typeof startInput]}
                        onChangeText={(text) =>
                          setStartInput((prev) => ({ ...prev, [field.key]: text.replace(/[^0-9]/g, '') }))
                        }
                        placeholder={field.placeholder}
                        keyboardType="number-pad"
                        maxLength={field.maxLength}
                        className="border border-gray-200 rounded-2xl px-4 py-3 text-base text-gray-900"
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View>
                <Text className="text-sm font-semibold text-gray-700 mb-3">End Date</Text>
                <View className="flex-row space-x-3">
                  {[
                    { key: 'day', placeholder: 'DD', maxLength: 2 },
                    { key: 'month', placeholder: 'MM', maxLength: 2 },
                    { key: 'year', placeholder: 'YYYY', maxLength: 4 },
                  ].map((field) => (
                    <View key={`end-${field.key}`} className="flex-1">
                      <TextInput
                        value={endInput[field.key as keyof typeof endInput]}
                        onChangeText={(text) =>
                          setEndInput((prev) => ({ ...prev, [field.key]: text.replace(/[^0-9]/g, '') }))
                        }
                        placeholder={field.placeholder}
                        keyboardType="number-pad"
                        maxLength={field.maxLength}
                        className="border border-gray-200 rounded-2xl px-4 py-3 text-base text-gray-900"
                      />
                    </View>
                  ))}
                </View>
              </View>

              {dateError && (
                <View className="bg-red-50 border border-red-200 rounded-2xl p-3">
                  <Text className="text-xs text-red-600">{dateError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleApplyCustomRange}
                className="bg-blue-600 rounded-2xl py-4"
              >
                <Text className="text-center text-white font-semibold text-base">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-lg font-semibold text-gray-900">Reviews</Text>
        <Text className="text-sm text-gray-500 mt-2">
          Surface sentiment and act on feedback once reviews API is available.
        </Text>

        <View className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <Text className="text-xs uppercase font-semibold text-blue-700">Average rating</Text>
          <View className="flex-row items-end mt-2">
            <Text className="text-4xl font-bold text-blue-900">4.8</Text>
            <Text className="text-sm text-blue-600 ml-2">/ 5.0 (placeholder)</Text>
          </View>
          <Text className="text-xs text-blue-600 mt-2">Connect to customer experience service to make this live.</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-5"
          contentContainerStyle={{ paddingRight: 12 }}
        >
          {reviews.map((review) => (
            <View
              key={review.id}
              className="w-64 bg-white border border-gray-100 rounded-2xl p-4 mr-4 shadow-sm"
            >
              <View className="flex-row items-center">
                <Text className="text-lg text-yellow-500 mr-2">{'★'.repeat(review.rating)}</Text>
                <Text className="text-sm text-gray-500">{review.timestamp}</Text>
              </View>
              <Text className="text-base font-semibold text-gray-900 mt-3">{review.customer}</Text>
              <Text className="text-sm text-gray-600 mt-2" numberOfLines={4}>
                {review.review}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

