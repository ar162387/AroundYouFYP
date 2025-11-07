import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import OrdersRevenueLineChart from '../../../../components/merchant/charts/OrdersRevenueLineChart';

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

  // Generate dynamic chart data and labels based on selected range
  const chartConfig = useMemo(() => {
    const now = new Date();
    
    switch (range) {
      case 'today': {
        // Hourly data for today
        const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        const data = [120, 180, 250, 320, 280, 350, 400];
        const yLabels = [0, 100, 200, 300, 400];
        return {
          xLabels: hours,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      case 'yesterday': {
        // Hourly data for yesterday
        const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        const data = [100, 160, 220, 290, 240, 310, 370];
        const yLabels = [0, 100, 200, 300, 400];
        return {
          xLabels: hours,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      case '7_days': {
        // Daily data for last 7 days
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const data = [1200, 1450, 1680, 1890, 2100, 2400, 2200];
        const yLabels = [0, 600, 1200, 1800, 2400];
        return {
          xLabels: days,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      case '30_days': {
        // Weekly data for last 30 days
        const weeks = ['Wk1', 'Wk2', 'Wk3', 'Wk4'];
        const data = [8500, 9200, 10100, 11500];
        const yLabels = [0, 3000, 6000, 9000, 12000];
        return {
          xLabels: weeks,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      case 'all_time': {
        // Monthly data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const data = [25000, 28000, 32000, 35000, 38000, 42000];
        const yLabels = [0, 10000, 20000, 30000, 40000];
        return {
          xLabels: months,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      case 'custom': {
        // Custom range logic
        if (!customStartDate && !customEndDate) {
          // Default if no dates selected
          const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
          const data = [800, 950, 1100, 1250, 1400];
          const yLabels = [0, 400, 800, 1200, 1600];
          return {
            xLabels: days,
            yLabels,
            data,
            orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
            revenue: data.reduce((sum, val) => sum + val * 85, 0),
          };
        }
        
        // Calculate days between dates
        const startDate = customStartDate || new Date('2024-01-01');
        const endDate = customEndDate || now;
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        let xLabels: string[];
        let dataPoints: number;
        
        if (daysDiff <= 1) {
          // Hourly for single day
          xLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
          dataPoints = 7;
        } else if (daysDiff <= 7) {
          // Daily for week or less
          xLabels = Array.from({ length: Math.min(daysDiff, 7) }, (_, i) => `Day ${i + 1}`);
          dataPoints = xLabels.length;
        } else if (daysDiff <= 30) {
          // Weekly for month or less
          const weeks = Math.ceil(daysDiff / 7);
          xLabels = Array.from({ length: weeks }, (_, i) => `Wk${i + 1}`);
          dataPoints = xLabels.length;
        } else {
          // Monthly for longer periods
          const months = Math.min(Math.ceil(daysDiff / 30), 12);
          xLabels = Array.from({ length: months }, (_, i) => {
            const date = new Date(startDate);
            date.setMonth(date.getMonth() + i);
            return date.toLocaleDateString('en-US', { month: 'short' });
          });
          dataPoints = xLabels.length;
        }
        
        // Generate sample data
        const data = Array.from({ length: dataPoints }, (_, i) => 
          Math.floor(500 + Math.random() * 1000 + (i * 100))
        );
        const maxData = Math.max(...data);
        const yMax = Math.ceil(maxData / 1000) * 1000;
        const yLabels = Array.from({ length: 5 }, (_, i) => Math.floor((yMax / 4) * i));
        
        return {
          xLabels,
          yLabels,
          data,
          orders: data.reduce((sum, val) => sum + Math.floor(val / 100), 0),
          revenue: data.reduce((sum, val) => sum + val * 85, 0),
        };
      }
      
      default:
        return {
          xLabels: [],
          yLabels: [0],
          data: [],
          orders: 0,
          revenue: 0,
        };
    }
  }, [range, customStartDate, customEndDate]);

  const chartData = chartConfig.data.map((value, index) => ({
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
            <Text className="text-3xl font-semibold text-gray-900 mt-1">{chartConfig.orders.toLocaleString()}</Text>
          </View>
          <View className="mb-6">
            <Text className="text-sm text-gray-500">Revenue</Text>
            <Text className="text-3xl font-semibold text-gray-900 mt-1">Rs {chartConfig.revenue.toLocaleString()}</Text>
          </View>

          <View className="overflow-hidden">
            <OrdersRevenueLineChart data={chartData} xLabels={chartConfig.xLabels} yLabels={chartConfig.yLabels} />
          </View>
        </View>
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

