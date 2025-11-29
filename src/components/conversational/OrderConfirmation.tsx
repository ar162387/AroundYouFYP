import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useOrder, useOrderTimer } from '../../hooks/consumer/useOrders';
import { getOrderStatusDisplay } from '../../types/orders';
import {
    OrderPendingIcon,
    OrderConfirmedIcon,
    OrderOutForDeliveryIcon,
    OrderDeliveredIcon,
    OrderCancelledIcon,
} from '../../icons/OrderStatusIcons';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDER_COMPLETED_FLAG_KEY = 'aroundyou_order_completed';

interface OrderData {
    id: string;
    order_number: string;
    status: string;
}

interface OrderConfirmationProps {
    order: OrderData;
}

export default function OrderConfirmation({ order: initialOrder }: OrderConfirmationProps) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ur';
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    
    // Fetch real-time order data
    const { data: order, isLoading } = useOrder(initialOrder.id);
    const timerState = useOrderTimer(order || null);
    
    // Use real-time order if available, otherwise fall back to initial
    const currentOrder = order || initialOrder;

    // Set flag when order becomes delivered or cancelled
    useEffect(() => {
        const setOrderCompletedFlag = async () => {
            if (currentOrder?.status === 'delivered' || currentOrder?.status === 'cancelled') {
                await AsyncStorage.setItem(ORDER_COMPLETED_FLAG_KEY, 'true');
            }
        };
        
        setOrderCompletedFlag();
    }, [currentOrder?.status]);

    // Animated value for pulsing effect (only for active orders)
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (currentOrder && timerState.isActive) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );

            animation.start();

            return () => {
                animation.stop();
            };
        }

        pulseAnim.setValue(1);
    }, [currentOrder?.status, timerState.isActive, pulseAnim]);

    if (!currentOrder) {
        return null;
    }

    const statusDisplay = getOrderStatusDisplay(currentOrder.status as any);
    const isTerminal = currentOrder.status === 'delivered' || currentOrder.status === 'cancelled';
    
    // Derive text colors from status color
    const textColor = currentOrder.status === 'delivered' ? '#065f46' : 
                     currentOrder.status === 'cancelled' ? '#991b1b' :
                     currentOrder.status === 'out_for_delivery' ? '#1e40af' :
                     currentOrder.status === 'confirmed' ? '#92400e' :
                     '#0c4a6e';
    const subtitleColor = currentOrder.status === 'delivered' ? '#047857' :
                          currentOrder.status === 'cancelled' ? '#dc2626' :
                          currentOrder.status === 'out_for_delivery' ? '#3b82f6' :
                          currentOrder.status === 'confirmed' ? '#d97706' :
                          '#0369a1';

    // Get gradient colors based on status
    const getGradientColors = () => {
        switch (currentOrder.status) {
            case 'delivered':
                return ['#ecfdf5', '#d1fae5'];
            case 'cancelled':
                return ['#fef2f2', '#fee2e2'];
            case 'out_for_delivery':
                return ['#eff6ff', '#dbeafe'];
            case 'confirmed':
                return ['#fef3c7', '#fde68a'];
            case 'pending':
            default:
                return ['#f0f9ff', '#e0f2fe'];
        }
    };

    const getBorderColor = () => {
        switch (currentOrder.status) {
            case 'delivered':
                return '#a7f3d0';
            case 'cancelled':
                return '#fca5a5';
            case 'out_for_delivery':
                return '#93c5fd';
            case 'confirmed':
                return '#fcd34d';
            case 'pending':
            default:
                return '#bae6fd';
        }
    };

    const renderStatusIcon = () => {
        const primary = statusDisplay.color;
        const secondary = `${statusDisplay.color}33`;

        switch (currentOrder.status) {
            case 'pending':
                return <OrderPendingIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
            case 'confirmed':
                return <OrderConfirmedIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
            case 'out_for_delivery':
                return <OrderOutForDeliveryIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
            case 'delivered':
                return <OrderDeliveredIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
            case 'cancelled':
                return <OrderCancelledIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
            default:
                return <OrderPendingIcon size={44} primaryColor={primary} secondaryColor={secondary} />;
        }
    };

    const getProgressPercentage = () => {
        switch (currentOrder.status) {
            case 'pending':
                return 25;
            case 'confirmed':
                return 50;
            case 'out_for_delivery':
                return 75;
            case 'delivered':
                return 100;
            default:
                return 0;
        }
    };

    const cardContent = (
        <LinearGradient
            colors={getGradientColors()}
            style={[styles.card, { borderColor: getBorderColor() }]}
        >
            <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: statusDisplay.color }]}>
                    {renderStatusIcon()}
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.title, { color: textColor }]}>
                        {isTerminal 
                            ? currentOrder.status === 'delivered'
                                ? t('order.orderDelivered', 'Order Delivered!')
                                : t('order.orderCancelled', 'Order Cancelled')
                            : t('order.orderPlaced', 'Order Placed!')}
                    </Text>
                    <Text style={[styles.subtitle, { color: subtitleColor }]}>
                        {t('order.orderNumber', 'Order #{{number}}', { number: currentOrder.order_number })}
                    </Text>
                    {order?.shop && (
                        <Text style={[styles.shopName, { color: subtitleColor }]} numberOfLines={1}>
                            {order.shop.name}
                        </Text>
                    )}
                </View>
            </View>

            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={statusDisplay.color} />
                    <Text style={[styles.loadingText, { color: subtitleColor }]}>
                        {t('common.updating', 'Updating...')}
                    </Text>
                </View>
            )}

            <View style={styles.statusContainer}>
                <Text style={[styles.statusLabel, { color: textColor }]}>
                    {t('common.status', 'Status')}:
                </Text>
                <Text style={[styles.statusValue, { color: statusDisplay.color }]}>
                    {t(`orders.status.${currentOrder.status}`, currentOrder.status.toUpperCase())}
                </Text>
            </View>

            {/* Show runner info if out for delivery */}
            {order?.delivery_runner && currentOrder.status === 'out_for_delivery' && (
                <View style={styles.runnerContainer}>
                    <DeliveryRunnerIcon size={14} color={statusDisplay.color} />
                    <Text style={[styles.runnerText, { color: subtitleColor }]}>
                        {order.delivery_runner.name} • {order.delivery_runner.phone_number}
                    </Text>
                </View>
            )}

            {/* Progress Bar */}
            {!isTerminal && (
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarBackground, { backgroundColor: `${statusDisplay.color}33` }]}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${getProgressPercentage()}%`,
                                    backgroundColor: statusDisplay.color,
                                },
                            ]}
                        />
                    </View>
                </View>
            )}

            <TouchableOpacity
                style={[styles.trackButton, { backgroundColor: statusDisplay.color }]}
                onPress={() => navigation.navigate('OrderStatus', { orderId: currentOrder.id })}
                activeOpacity={0.8}
            >
                <Text style={styles.trackButtonText}>
                    {isTerminal 
                        ? t('order.viewOrder', 'View Order')
                        : t('order.trackOrder', 'Track Order')}
                </Text>
            </TouchableOpacity>
        </LinearGradient>
    );

    // Apply pulse animation only for active orders
    if (!isTerminal && timerState.isActive) {
        return (
            <Animated.View
                style={[
                    styles.container,
                    {
                        transform: [{ scale: pulseAnim }],
                    },
                ]}
            >
                {cardContent}
            </Animated.View>
        );
    }

    return <View style={styles.container}>{cardContent}</View>;
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
        width: '100%',
        paddingRight: 16,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 4,
    },
    shopName: {
        fontSize: 12,
        marginTop: 2,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        paddingVertical: 8,
    },
    loadingText: {
        fontSize: 12,
        marginLeft: 8,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 12,
    },
    statusLabel: {
        fontSize: 12,
        marginRight: 6,
        fontWeight: '600',
    },
    statusValue: {
        fontSize: 12,
        fontWeight: '700',
    },
    runnerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderRadius: 8,
    },
    runnerText: {
        fontSize: 12,
        marginLeft: 6,
    },
    progressBarContainer: {
        marginBottom: 16,
    },
    progressBarBackground: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    trackButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        width: '100%',
        alignItems: 'center',
    },
    trackButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});
