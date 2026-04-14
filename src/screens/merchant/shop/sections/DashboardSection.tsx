import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { MerchantShop } from '../../../../services/merchant/shopService';
import OrdersRevenueLineChart from '../../../../components/merchant/charts/OrdersRevenueLineChart';
import { useShopOrderTimeSeries, useShopOrderAnalytics } from '../../../../hooks/merchant/useOrders';
import { formatDuration } from '../../../../types/orders';
import OrdersTrendIcon from '../../../../icons/OrdersTrendIcon';
import RevenueFlowIcon from '../../../../icons/RevenueFlowIcon';
import { getShopReviews, getShopReviewStats, ReviewWithUser } from '../../../../services/consumer/reviewService';
import StarIcon from '../../../../icons/StarIcon';
import { useTranslation } from 'react-i18next';

type DashboardSectionProps = {
  shop: MerchantShop;
  onShowOrders?: () => void;
};

type RangeType = 'today' | 'yesterday' | '7_days' | '30_days' | 'all_time' | 'custom';

function normalizeCalendarDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function getShopMinSelectableDate(createdAtIso: string, maxDate: Date): Date {
  const c = new Date(createdAtIso);
  if (Number.isNaN(c.getTime())) {
    return normalizeCalendarDate(maxDate);
  }
  const min = normalizeCalendarDate(c);
  return min.getTime() > maxDate.getTime() ? normalizeCalendarDate(maxDate) : min;
}

export default function DashboardSection({ shop, onShowOrders }: DashboardSectionProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeType>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(() => normalizeCalendarDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState<Date | null>(() => normalizeCalendarDate(new Date()));
  const [draftStart, setDraftStart] = useState<Date>(() => normalizeCalendarDate(new Date()));
  const [draftEnd, setDraftEnd] = useState<Date>(() => normalizeCalendarDate(new Date()));
  const [androidPickerField, setAndroidPickerField] = useState<'start' | 'end' | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const minSelectableDate = useMemo(
    () => getShopMinSelectableDate(shop.created_at, normalizeCalendarDate(new Date())),
    [shop.created_at]
  );

  useEffect(() => {
    if (!showDatePicker) {
      setAndroidPickerField(null);
    }
  }, [showDatePicker]);

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

  const orderTrend = useMemo(() => {
    if (!allTimeAnalytics || previousAllTimeAnalytics === undefined) {
      return { change: null, changeType: null };
    }

    const previousTotal = previousAllTimeAnalytics?.total_orders;
    if (previousTotal === undefined || previousTotal === null) {
      return { change: null, changeType: null };
    }

    const diff = allTimeAnalytics.total_orders - previousTotal;
    if (diff === 0) {
      return { change: null, changeType: null };
    }

    return {
      change: Math.abs(diff),
      changeType: diff > 0 ? 'up' as const : 'down' as const,
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

  const handleRangeSelect = (selectedRange: RangeType) => {
    if (selectedRange === 'custom') {
      const maxD = normalizeCalendarDate(new Date());
      const minD = minSelectableDate;
      let s = customStartDate ? normalizeCalendarDate(customStartDate) : maxD;
      let e = customEndDate ? normalizeCalendarDate(customEndDate) : maxD;
      if (s.getTime() < minD.getTime()) s = new Date(minD);
      if (e.getTime() < minD.getTime()) e = new Date(minD);
      if (s.getTime() > maxD.getTime()) s = new Date(maxD);
      if (e.getTime() > maxD.getTime()) e = new Date(maxD);
      if (s.getTime() > e.getTime()) {
        e = new Date(s);
      }
      setDraftStart(s);
      setDraftEnd(e);
      setDateError(null);
      setAndroidPickerField(null);
      setShowDatePicker(true);
    }
    setRange(selectedRange);
  };

  const handleApplyCustomRange = () => {
    const maxD = normalizeCalendarDate(new Date());
    const minD = minSelectableDate;
    const s = normalizeCalendarDate(draftStart);
    const e = normalizeCalendarDate(draftEnd);

    if (s.getTime() < minD.getTime()) {
      setDateError(t('merchant.dashboardSection.datePicker.startNotBeforeCreation'));
      return;
    }
    if (e.getTime() < minD.getTime()) {
      setDateError(t('merchant.dashboardSection.datePicker.startNotBeforeCreation'));
      return;
    }
    if (s.getTime() > maxD.getTime() || e.getTime() > maxD.getTime()) {
      setDateError(t('merchant.dashboardSection.datePicker.notAfterToday'));
      return;
    }
    if (s.getTime() > e.getTime()) {
      setDateError(t('merchant.dashboardSection.datePicker.dateErrorStart'));
      return;
    }

    setCustomStartDate(s);
    setCustomEndDate(e);
    setDateError(null);
    setShowDatePicker(false);
  };

  const formatMediumDate = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const onDraftStartChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPickerField(null);
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      return;
    }
    if (!date) return;
    const maxD = normalizeCalendarDate(new Date());
    let next = normalizeCalendarDate(date);
    if (next.getTime() < minSelectableDate.getTime()) next = new Date(minSelectableDate);
    if (next.getTime() > maxD.getTime()) next = new Date(maxD);
    setDraftStart(next);
    setDraftEnd((prev) => {
      const p = normalizeCalendarDate(prev);
      if (p.getTime() < next.getTime()) return next;
      if (p.getTime() > maxD.getTime()) return new Date(maxD);
      return p;
    });
  };

  const onDraftEndChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPickerField(null);
    }
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      return;
    }
    if (!date) return;
    const maxD = normalizeCalendarDate(new Date());
    let next = normalizeCalendarDate(date);
    const startNorm = normalizeCalendarDate(draftStart);
    const endMin =
      startNorm.getTime() < minSelectableDate.getTime() ? minSelectableDate : startNorm;
    if (next.getTime() < endMin.getTime()) next = new Date(endMin);
    if (next.getTime() > maxD.getTime()) next = new Date(maxD);
    setDraftEnd(next);
    if (startNorm.getTime() > next.getTime()) {
      setDraftStart(new Date(next));
    }
  };

  const customRangeTodayMax = normalizeCalendarDate(new Date());
  const customRangeStartPickerMax =
    draftEnd.getTime() < customRangeTodayMax.getTime() ? draftEnd : customRangeTodayMax;
  const customRangeEndPickerMin =
    draftStart.getTime() > minSelectableDate.getTime() ? draftStart : minSelectableDate;

  const formatDateRange = () => {
    if (!customStartDate && !customEndDate) {
      return t('merchant.dashboardSection.ranges.selectDates');
    }
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (customStartDate && customEndDate) {
      return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
    }
    if (customStartDate) {
      return `${t('merchant.dashboardSection.ranges.from')} ${formatDate(customStartDate)}`;
    }
    return `${t('merchant.dashboardSection.ranges.until')} ${formatDate(customEndDate!)}`;
  };

  const rangeLabel = useMemo(() => {
    switch (range) {
      case 'today':
        return t('merchant.dashboardSection.ranges.today');
      case 'yesterday':
        return t('merchant.dashboardSection.ranges.yesterday');
      case '7_days':
        return t('merchant.dashboardSection.ranges.last7Days');
      case '30_days':
        return t('merchant.dashboardSection.ranges.last30Days');
      case 'all_time':
        return t('merchant.dashboardSection.ranges.allTime');
      case 'custom':
        return t('merchant.dashboardSection.ranges.custom');
      default:
        return t('merchant.dashboardSection.ranges.today');
    }
  }, [range, t]);

  // Fetch reviews data
  const [reviewsData, setReviewsData] = useState<ReviewWithUser[]>([]);
  const [reviewStats, setReviewStats] = useState<{ average_rating: number; total_reviews: number } | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      setIsLoadingReviews(true);
      try {
        const [reviewsResult, statsResult] = await Promise.all([
          getShopReviews(shop.id),
          getShopReviewStats(shop.id),
        ]);

        if (reviewsResult.data) {
          setReviewsData(reviewsResult.data);
        }

        if (statsResult.data) {
          setReviewStats(statsResult.data);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    fetchReviews();
  }, [shop.id]);

  // Get 3 random reviews
  const randomReviews = useMemo(() => {
    if (reviewsData.length === 0) return [];

    // Shuffle array and take first 3
    const shuffled = [...reviewsData].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, [reviewsData]);

  const formatReviewDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return t('merchant.dashboardSection.reviews.todayAt', {
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (diffInDays === 1) {
      return t('merchant.dashboardSection.reviews.yesterdayAt', {
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (diffInDays < 7) {
      return t('merchant.dashboardSection.reviews.daysAgo', { count: diffInDays });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getUserDisplayName = (review: ReviewWithUser) => {
    return review.user?.name || review.user?.email || 'User';
  };

  const metricCards = useMemo(() => {
    return [
      {
        key: 'confirmation',
        title: t('merchant.dashboardSection.metrics.confirmationTime'),
        value:
          timeMetrics.confirmation.current !== null && timeMetrics.confirmation.current !== undefined
            ? formatDuration(timeMetrics.confirmation.current)
            : null,
        changeLabel:
          timeMetrics.confirmation.change !== null && timeMetrics.confirmation.change !== undefined
            ? formatDuration(timeMetrics.confirmation.change)
            : null,
        changeType: timeMetrics.confirmation.changeType,
        subtitle: t('merchant.dashboardSection.metrics.avgTime'),
      },
      {
        key: 'preparation',
        title: t('merchant.dashboardSection.metrics.preparationTime'),
        value:
          timeMetrics.preparation.current !== null && timeMetrics.preparation.current !== undefined
            ? formatDuration(timeMetrics.preparation.current)
            : null,
        changeLabel:
          timeMetrics.preparation.change !== null && timeMetrics.preparation.change !== undefined
            ? formatDuration(timeMetrics.preparation.change)
            : null,
        changeType: timeMetrics.preparation.changeType,
        subtitle: t('merchant.dashboardSection.metrics.avgTime'),
      },
      {
        key: 'delivery',
        title: t('merchant.dashboardSection.metrics.deliveryTime'),
        value:
          timeMetrics.delivery.current !== null && timeMetrics.delivery.current !== undefined
            ? formatDuration(timeMetrics.delivery.current)
            : null,
        changeLabel:
          timeMetrics.delivery.change !== null && timeMetrics.delivery.change !== undefined
            ? formatDuration(timeMetrics.delivery.change)
            : null,
        changeType: timeMetrics.delivery.changeType,
        subtitle: t('merchant.dashboardSection.metrics.avgTime'),
      },
      {
        key: 'totalOrders',
        title: t('merchant.dashboardSection.metrics.totalOrders'),
        value: allTimeAnalytics ? allTimeAnalytics.total_orders.toLocaleString() : null,
        changeLabel:
          orderTrend.change !== null && orderTrend.change !== undefined
            ? orderTrend.change.toLocaleString()
            : null,
        changeType: orderTrend.changeType,
        subtitle: t('merchant.dashboardSection.metrics.allTimeSubtitle'),
      },
    ] as const;
  }, [allTimeAnalytics, orderTrend.change, orderTrend.changeType, timeMetrics, t]);

  return (
    <View className="space-y-4">
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900">{t('merchant.dashboardSection.titles.summary')}</Text>
        </View>

        <View className="mt-5 flex-row flex-wrap">
          {[
            { key: 'today', label: t('merchant.dashboardSection.ranges.today') },
            { key: 'yesterday', label: t('merchant.dashboardSection.ranges.yesterday') },
            { key: '7_days', label: t('merchant.dashboardSection.ranges.last7Days') },
            { key: '30_days', label: t('merchant.dashboardSection.ranges.last30Days') },
            { key: 'all_time', label: t('merchant.dashboardSection.ranges.allTime') },
            { key: 'custom', label: range === 'custom' ? formatDateRange() : t('merchant.dashboardSection.ranges.custom') },
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

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onShowOrders}
          disabled={!onShowOrders}
          accessibilityRole="button"
          accessibilityLabel="View detailed orders analytics"
          className="mt-6 bg-white border border-gray-100 rounded-3xl p-5 shadow-sm"
        >
          <View className="flex-row justify-between gap-4">
            <View className="flex-1 basis-0">
              <View className="flex-row items-center">
                <OrdersTrendIcon size={22} color="#2563eb" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">{t('merchant.dashboardSection.chart.orders')}</Text>
              </View>
              {isLoadingChart ? (
                <ActivityIndicator size="small" color="#2563eb" className="mt-2" />
              ) : (
                <Text className="mt-2 text-3xl font-semibold text-gray-900">
                  {chartConfig.orders.toLocaleString()}
                </Text>
              )}
            </View>
            <View className="flex-1 basis-0">
              <View className="flex-row items-center">
                <RevenueFlowIcon size={22} color="#16a34a" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">{t('merchant.dashboardSection.chart.revenue')}</Text>
              </View>
              {isLoadingChart ? (
                <ActivityIndicator size="small" color="#16a34a" className="mt-2" />
              ) : (
                <Text className="mt-2 text-3xl font-semibold text-gray-900">
                  Rs {((chartConfig.revenue || 0) / 100).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </View>
          </View>

          <View className="overflow-hidden mt-6">
            {isLoadingChart ? (
              <View className="h-40 items-center justify-center">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="text-gray-500 mt-2">{t('merchant.dashboardSection.chart.loadingChart')}</Text>
              </View>
            ) : chartConfig.data.length > 0 ? (
              <OrdersRevenueLineChart data={chartData} xLabels={chartConfig.xLabels} yLabels={chartConfig.yLabels} />
            ) : (
              <View className="h-40 items-center justify-center">
                <Text className="text-gray-500">{t('merchant.dashboardSection.chart.noData')}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Time Metrics Cards Section - Always shows all-time averages, separate from chart */}
      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md mt-4">
        <Text className="text-lg font-bold text-gray-900 mb-4">{t('merchant.dashboardSection.titles.performanceMetrics')}</Text>
        <View className="flex-row flex-wrap -mx-1">
          {isLoadingAllTime
            ? Array.from({ length: 4 }).map((_, index) => (
              <View key={`metric-skeleton-${index}`} className="w-1/2 px-1 pb-3">
                <View className="bg-white border border-gray-100 rounded-2xl p-4 items-center justify-center shadow-sm">
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text className="text-xs text-gray-500 mt-2">Loading...</Text>
                </View>
              </View>
            ))
            : metricCards.map((card) => (
              <View key={card.key} className="w-1/2 px-1 pb-3">
                <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {card.title}
                  </Text>
                  <View className="flex-row items-baseline flex-wrap">
                    {card.value ? (
                      <>
                        <Text className="text-xl font-bold text-gray-900">{card.value}</Text>
                        {card.changeLabel && card.changeType === 'up' && (
                          <View className="ml-2 flex-row items-center bg-green-50 px-2 py-1 rounded-full">
                            <Text className="text-green-600 text-xs font-semibold">↑</Text>
                            <Text className="text-green-600 text-xs font-semibold ml-1">
                              +{card.changeLabel}
                            </Text>
                          </View>
                        )}
                        {card.changeLabel && card.changeType === 'down' && (
                          <View className="ml-2 flex-row items-center bg-red-50 px-2 py-1 rounded-full">
                            <Text className="text-red-600 text-xs font-semibold">↓</Text>
                            <Text className="text-red-600 text-xs font-semibold ml-1">
                              -{card.changeLabel}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <Text className="text-sm text-gray-400">No data</Text>
                    )}
                  </View>
                  <Text className="text-[11px] text-gray-400 mt-1">{card.subtitle}</Text>
                </View>
              </View>
            ))}
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
          <View className="bg-white rounded-t-3xl p-6 pb-10 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">{t('merchant.dashboardSection.datePicker.selectRange')}</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text className="text-blue-600 font-semibold text-base">{t('merchant.dashboardSection.datePicker.close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {Platform.OS === 'ios' ? (
                <View className="space-y-4">
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">
                      {t('merchant.dashboardSection.datePicker.startDate')}
                    </Text>
                    <DateTimePicker
                      value={draftStart}
                      mode="date"
                      display="spinner"
                      minimumDate={minSelectableDate}
                      maximumDate={customRangeStartPickerMax}
                      onChange={onDraftStartChange}
                      style={{ height: 180 }}
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">
                      {t('merchant.dashboardSection.datePicker.endDate')}
                    </Text>
                    <DateTimePicker
                      value={draftEnd}
                      mode="date"
                      display="spinner"
                      minimumDate={customRangeEndPickerMin}
                      maximumDate={customRangeTodayMax}
                      onChange={onDraftEndChange}
                      style={{ height: 180 }}
                    />
                  </View>
                </View>
              ) : (
                <View className="space-y-4">
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">
                      {t('merchant.dashboardSection.datePicker.startDate')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setAndroidPickerField('start')}
                      className="border border-gray-200 rounded-2xl px-4 py-4 bg-gray-50"
                      activeOpacity={0.85}
                    >
                      <Text className="text-base text-gray-900 font-medium">{formatMediumDate(draftStart)}</Text>
                      <Text className="text-xs text-gray-500 mt-1">
                        {t('merchant.dashboardSection.datePicker.tapToChooseStart')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">
                      {t('merchant.dashboardSection.datePicker.endDate')}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setAndroidPickerField('end')}
                      className="border border-gray-200 rounded-2xl px-4 py-4 bg-gray-50"
                      activeOpacity={0.85}
                    >
                      <Text className="text-base text-gray-900 font-medium">{formatMediumDate(draftEnd)}</Text>
                      <Text className="text-xs text-gray-500 mt-1">
                        {t('merchant.dashboardSection.datePicker.tapToChooseEnd')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {androidPickerField === 'start' && (
                    <DateTimePicker
                      key={`android-start-${draftStart.getTime()}`}
                      value={draftStart}
                      mode="date"
                      display="default"
                      minimumDate={minSelectableDate}
                      maximumDate={customRangeStartPickerMax}
                      onChange={onDraftStartChange}
                    />
                  )}
                  {androidPickerField === 'end' && (
                    <DateTimePicker
                      key={`android-end-${draftEnd.getTime()}`}
                      value={draftEnd}
                      mode="date"
                      display="default"
                      minimumDate={customRangeEndPickerMin}
                      maximumDate={customRangeTodayMax}
                      onChange={onDraftEndChange}
                    />
                  )}
                </View>
              )}

              {dateError ? (
                <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mt-4">
                  <Text className="text-xs text-red-600">{dateError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleApplyCustomRange}
                className="bg-blue-600 rounded-2xl py-4 mt-6"
              >
                <Text className="text-center text-white font-semibold text-base">
                  {t('merchant.dashboardSection.datePicker.apply')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <Text className="text-lg font-semibold text-gray-900">{t('merchant.dashboardSection.titles.reviews')}</Text>

        {isLoadingReviews ? (
          <View className="mt-5 items-center py-8">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-500 mt-2">{t('merchant.dashboardSection.reviews.loadingReviews')}</Text>
          </View>
        ) : (
          <>
            <View className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <Text className="text-xs uppercase font-semibold text-blue-700">{t('merchant.dashboardSection.reviews.avgRating')}</Text>
              <View className="flex-row items-end mt-2">
                <Text className="text-4xl font-bold text-blue-900">
                  {reviewStats?.average_rating.toFixed(1) || '0.0'}
                </Text>
                <Text className="text-sm text-blue-600 ml-2">/ 5.0</Text>
                {reviewStats && reviewStats.total_reviews > 0 && (
                  <Text className="text-sm text-blue-600 ml-2">
                    ({reviewStats.total_reviews} {reviewStats.total_reviews === 1 ? t('merchant.dashboardSection.reviews.review') : t('merchant.dashboardSection.reviews.reviews')})
                  </Text>
                )}
              </View>
              {reviewStats && reviewStats.total_reviews === 0 && (
                <Text className="text-xs text-blue-600 mt-2">{t('merchant.dashboardSection.reviews.noReviews')}</Text>
              )}
            </View>

            {randomReviews.length > 0 ? (
              <View className="mt-5 space-y-4">
                {randomReviews.map((review) => (
                  <View
                    key={review.id}
                    className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <View key={star} className="mr-1">
                            <StarIcon
                              size={18}
                              color="#FCD34D"
                              filled={star <= review.rating}
                            />
                          </View>
                        ))}
                      </View>
                      <Text className="text-sm text-gray-500">{formatReviewDate(review.created_at)}</Text>
                    </View>
                    <Text className="text-base font-semibold text-gray-900 mt-2">
                      {getUserDisplayName(review)}
                    </Text>
                    {review.review_text && (
                      <Text className="text-sm text-gray-600 mt-2" numberOfLines={4}>
                        {review.review_text}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : reviewStats && reviewStats.total_reviews === 0 ? (
              <View className="mt-5 bg-gray-50 border border-gray-200 rounded-2xl p-6 items-center">
                <Text className="text-4xl mb-2">⭐</Text>
                <Text className="text-gray-600 text-sm text-center">{t('merchant.dashboardSection.reviews.noReviews')}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

