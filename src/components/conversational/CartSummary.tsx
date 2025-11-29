import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Alert, ToastAndroid } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import {
    calculateDistance,
    calculateTotalDeliveryFee,
    fetchDeliveryLogic,
    type DeliveryLogic,
} from '../../services/merchant/deliveryLogicService';

interface CartItem {
    id: string;
    name: string;
    quantity: number;
    price_cents: number;
}

interface CartData {
    shopId: string;
    shopName: string;
    shopImage?: string;
    shopAddress?: string;
    shopLatitude?: number | null;
    shopLongitude?: number | null;
    deliveryLogic?: DeliveryLogic | null;
    items: CartItem[];
    totalPrice: number;
    totalItems: number;
}

interface CartSummaryProps {
    cart: CartData;
    onChangeAddress?: (shopId?: string) => void;
}

export default function CartSummary({ cart, onChangeAddress }: CartSummaryProps) {
    const { t } = useTranslation();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { getShopCart } = useCart();
    const { selectedAddress, setSelectedAddress } = useLocationSelection();
    const [landmarkValue, setLandmarkValue] = useState(selectedAddress?.landmark || '');
    const [deliveryLogic, setDeliveryLogic] = useState<DeliveryLogic | null>(cart.deliveryLogic || null);
    const [isFetchingDeliveryLogic, setIsFetchingDeliveryLogic] = useState(false);

    const resolvedCart = useMemo(() => {
        const liveCart = getShopCart(cart.shopId);
        if (liveCart) {
            return {
                shopId: liveCart.shopId,
                shopName: liveCart.shopName,
                shopImage: liveCart.shopImage,
                shopAddress: liveCart.shopAddress,
                shopLatitude: liveCart.shopLatitude ?? null,
                shopLongitude: liveCart.shopLongitude ?? null,
                deliveryLogic: liveCart.deliveryLogic,
                items: liveCart.items.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price_cents: item.price_cents,
                })),
                totalPrice: liveCart.totalPrice,
                totalItems: liveCart.totalItems,
            };
        }
        return cart;
    }, [cart, getShopCart]);

    const displayedSubtotal = useMemo(
        () => resolvedCart.items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
        [resolvedCart.items]
    );

    useEffect(() => {
        setLandmarkValue(selectedAddress?.landmark || '');
    }, [selectedAddress?.landmark]);

    useEffect(() => {
        let isMounted = true;

        if (resolvedCart.deliveryLogic) {
            setDeliveryLogic(resolvedCart.deliveryLogic);
            setIsFetchingDeliveryLogic(false);
            return () => {
                isMounted = false;
            };
        }

        if (!resolvedCart.shopId) {
            return () => {
                isMounted = false;
            };
        }

        setIsFetchingDeliveryLogic(true);
        fetchDeliveryLogic(resolvedCart.shopId)
            .then(({ data }) => {
                if (isMounted) {
                    setDeliveryLogic(data || null);
                }
            })
            .catch((error) => {
                console.error('[CartSummary] Failed to fetch delivery logic:', error);
            })
            .finally(() => {
                if (isMounted) {
                    setIsFetchingDeliveryLogic(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [resolvedCart.deliveryLogic, resolvedCart.shopId]);

    const distanceMeters = useMemo(() => {
        if (
            !selectedAddress?.coords ||
            selectedAddress.coords.latitude == null ||
            selectedAddress.coords.longitude == null ||
            resolvedCart.shopLatitude == null ||
            resolvedCart.shopLongitude == null
        ) {
            return null;
        }

        return calculateDistance(
            selectedAddress.coords.latitude,
            selectedAddress.coords.longitude,
            resolvedCart.shopLatitude,
            resolvedCart.shopLongitude
        );
    }, [
        selectedAddress?.coords?.latitude,
        selectedAddress?.coords?.longitude,
        resolvedCart.shopLatitude,
        resolvedCart.shopLongitude,
    ]);

    const deliveryDetails = useMemo(() => {
        if (!deliveryLogic || distanceMeters == null) {
            return null;
        }

        const subtotalValue = resolvedCart.totalPrice / 100;
        const calculation = calculateTotalDeliveryFee(subtotalValue, distanceMeters, deliveryLogic);

        return {
            ...calculation,
            subtotalValue,
            distanceMeters,
        };
    }, [deliveryLogic, distanceMeters, resolvedCart.totalPrice]);

    const requiresLandmark = Boolean(
        selectedAddress && (!selectedAddress.landmark || !selectedAddress.landmark.trim())
    );

    const minimumOrderValue = deliveryLogic?.leastOrderValue;
    const meetsMinimumOrder =
        !minimumOrderValue || resolvedCart.totalPrice / 100 >= minimumOrderValue;

    const handleSaveLandmark = () => {
        if (!selectedAddress) {
            return;
        }

        const trimmed = landmarkValue.trim();
        if (trimmed.length < 3) {
            Alert.alert(
                t('checkout.landmarkRequired', 'Landmark required'),
                t('checkout.landmarkHelper', 'Please share a nearby landmark (min 3 characters).')
            );
            return;
        }

        setSelectedAddress({
            ...selectedAddress,
            landmark: trimmed,
        });

        if (Platform.OS === 'android') {
            ToastAndroid.show(t('checkout.landmarkSaved', 'Landmark saved'), ToastAndroid.SHORT);
        } else {
            Alert.alert(t('checkout.landmarkSaved', 'Landmark saved'));
        }
    };

    if (!resolvedCart || !resolvedCart.items || resolvedCart.items.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#ffffff', '#f8fafc']}
                style={styles.card}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerLabel}>{t('cart.cartSummary', 'Cart Summary')}</Text>
                        <Text style={styles.shopName}>{resolvedCart.shopName}</Text>
                    </View>
                    <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>
                            {resolvedCart.totalItems} {resolvedCart.totalItems === 1 ? t('common.item', 'item') : t('common.items', 'items')}
                        </Text>
                    </View>
                </View>

                {/* Items List */}
                <View style={styles.itemsList}>
                    {resolvedCart.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                            <View style={styles.quantityBadge}>
                                <Text style={styles.quantityText}>{item.quantity}x</Text>
                            </View>
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.itemPrice}>
                                {t('common.currency', 'PKR')} {Math.round((item.price_cents * item.quantity) / 100)}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('cart.subtotal', 'Subtotal')}</Text>
                    <Text style={styles.totalAmount}>
                        {t('common.currency', 'PKR')} {Math.round(displayedSubtotal / 100)}
                    </Text>
                </View>

                <View style={styles.addressContainer}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.sectionLabel}>{t('checkout.deliveryAddress', 'Delivery address')}</Text>
                        <Text style={styles.addressValue} numberOfLines={2}>
                            {selectedAddress?.label || t('checkout.selectAddressMsg', 'Select a delivery address')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => onChangeAddress?.(resolvedCart.shopId)}
                        style={styles.changeAddressButton}
                        activeOpacity={onChangeAddress ? 0.8 : 1}
                        disabled={!onChangeAddress}
                    >
                        <Text style={styles.changeAddressText}>{t('common.change', 'Change')}</Text>
                    </TouchableOpacity>
                </View>

                {requiresLandmark && (
                    <View style={styles.landmarkContainer}>
                        <Text style={styles.sectionLabel}>
                            {t('checkout.landmarkPrompt', 'Add a landmark so riders can find you')}
                        </Text>
                        <Text style={styles.landmarkHint}>
                            {t(
                                'checkout.landmarkExample',
                                'Example: Opposite Habib Bank, Gate #2, Street 5'
                            )}
                        </Text>
                        <TextInput
                            style={styles.landmarkInput}
                            placeholder={t('checkout.landmarkPlaceholder', 'Nearby landmark or building')}
                            placeholderTextColor="#94a3b8"
                            value={landmarkValue}
                            onChangeText={setLandmarkValue}
                        />
                        <TouchableOpacity
                            style={styles.saveLandmarkButton}
                            onPress={handleSaveLandmark}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.saveLandmarkText}>
                                {t('checkout.saveLandmark', 'Save landmark')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.deliveryCard}>
                    <View style={styles.deliveryRow}>
                        <Text style={styles.label}>{t('cart.distance', 'Distance')}</Text>
                        <Text style={styles.value}>
                            {distanceMeters != null
                                ? `${(distanceMeters / 1000).toFixed(2)} km`
                                : t('cart.distanceUnknown', '—')}
                        </Text>
                    </View>

                    {deliveryDetails ? (
                        <>
                            <View style={styles.deliveryRow}>
                                <Text style={styles.label}>{t('cart.deliveryFee', 'Delivery')}</Text>
                                <Text
                                    style={[
                                        styles.value,
                                        deliveryDetails.freeDeliveryApplied && styles.freeText,
                                    ]}
                                >
                                    {deliveryDetails.freeDeliveryApplied
                                        ? t('common.free', 'Free')
                                        : `${t('common.currency', 'PKR')} ${deliveryDetails.baseFee.toFixed(0)}`}
                                </Text>
                            </View>
                            {deliveryDetails.surcharge > 0 && (
                                <View style={styles.deliveryRow}>
                                    <Text style={styles.label}>{t('cart.surcharge', 'Small order fee')}</Text>
                                    <Text style={styles.value}>
                                        {t('common.currency', 'PKR')} {deliveryDetails.surcharge.toFixed(0)}
                                    </Text>
                                </View>
                            )}
                            <View style={[styles.deliveryRow, styles.estimatedRow]}>
                                <Text style={styles.totalLabel}>
                                    {t('cart.estimatedTotal', 'Estimated total')}
                                </Text>
                                <Text style={styles.totalAmount}>
                                    {t('common.currency', 'PKR')}{' '}
                                    {(deliveryDetails.subtotalValue + deliveryDetails.finalFee).toFixed(0)}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.deliveryHint}>
                            {selectedAddress
                                ? isFetchingDeliveryLogic
                                    ? t('cart.deliveryCalculating', 'Calculating delivery fee…')
                                    : t(
                                          'cart.deliveryHintNoLogic',
                                          'Delivery fee will appear as soon as this shop shares its delivery rules.'
                                      )
                                : t(
                                      'cart.deliveryHintNoAddress',
                                      'Select your delivery address to calculate delivery fees.'
                                  )}
                        </Text>
                    )}
                </View>

                {!meetsMinimumOrder && minimumOrderValue && (
                    <Text style={styles.warningText}>
                        {t(
                            'cart.minimumOrderWarning',
                            'Minimum order amount is Rs {{amount}}. Add a bit more to continue.',
                            { amount: minimumOrderValue.toFixed(0) }
                        )}
                    </Text>
                )}

                <View style={styles.promptCard}>
                    <Text style={styles.promptTitle}>{t('cart.readyToOrder', 'Ready to order?')}</Text>
                    <Text style={styles.promptText}>
                        {t(
                            'cart.promptMessage',
                            'Let me know if you want me to place the order now or adjust the items.'
                        )}
                    </Text>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.viewCartButton}
                        onPress={() => navigation.navigate('ViewCart', { shopId: resolvedCart.shopId })}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.viewCartText}>{t('cart.viewCart', 'View Cart & Checkout')}</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 12,
        paddingRight: 16,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    headerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    shopName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    itemCountBadge: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    itemCountText: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '600',
    },
    itemsList: {
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    quantityBadge: {
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 8,
    },
    quantityText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    itemName: {
        flex: 1,
        fontSize: 14,
        color: '#334155',
        marginRight: 8,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    divider: {
        height: 1,
        backgroundColor: '#e2e8f0',
        marginBottom: 12,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#475569',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: '#2563eb',
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    changeAddressButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        backgroundColor: '#eff6ff',
    },
    changeAddressText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563eb',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 2,
    },
    addressValue: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
    },
    landmarkContainer: {
        borderWidth: 1,
        borderColor: '#fde68a',
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    landmarkHint: {
        fontSize: 12,
        color: '#92400e',
        marginBottom: 8,
    },
    landmarkInput: {
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#0f172a',
        marginBottom: 10,
    },
    saveLandmarkButton: {
        alignSelf: 'flex-start',
        backgroundColor: '#f59e0b',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
    },
    saveLandmarkText: {
        color: '#fff7ed',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 0.2,
    },
    deliveryCard: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#f8fafc',
        marginBottom: 12,
    },
    deliveryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    label: {
        fontSize: 13,
        color: '#475569',
    },
    value: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    freeText: {
        color: '#16a34a',
    },
    deliveryHint: {
        fontSize: 12,
        color: '#475569',
        fontStyle: 'italic',
    },
    estimatedRow: {
        marginTop: 4,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    warningText: {
        color: '#b45309',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 12,
    },
    promptCard: {
        backgroundColor: '#ecfeff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    promptTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    promptText: {
        fontSize: 13,
        color: '#0f172a',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewCartButton: {
        flex: 1,
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    viewCartText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});
