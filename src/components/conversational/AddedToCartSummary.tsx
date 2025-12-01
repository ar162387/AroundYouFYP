import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions,
    TextInput,
    Alert,
    Platform,
    ToastAndroid,
    ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import {
    calculateDistance,
    calculateTotalDeliveryFee,
    fetchDeliveryLogic,
    type DeliveryLogic,
} from '../../services/merchant/deliveryLogicService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AddedItem {
    itemId: string;
    name: string;
    quantity: number;
    shopId: string;
    shopName: string;
    price_cents: number;
    image_url?: string;
}

interface DeliveryInfo {
    deliveryFee: number;
    surcharge: number;
    freeDeliveryApplied: boolean;
    total: number;
    cartSubtotal?: number;
    addedSubtotal?: number;
}

interface CartResultPayload {
    shopId: string;
    shopName: string;
    shopImage?: string;
    shopAddress?: string;
    shopLatitude?: number | null;
    shopLongitude?: number | null;
    deliveryLogic?: DeliveryLogic | null;
    totalPrice: number;
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        price_cents: number;
        image_url?: string | null;
    }>;
}

type ShopCardData = {
    shopId: string;
    shopName: string;
    items: AddedItem[];
    totalPrice: number;
    addedSubtotal?: number;
    shopImage?: string;
    shopAddress?: string;
    shopLatitude?: number | null;
    shopLongitude?: number | null;
    deliveryLogic?: DeliveryLogic | null;
};

type CalculatedDeliveryInfo = {
    deliveryFee: number;
    surcharge: number;
    freeDeliveryApplied: boolean;
    total: number;
    cartSubtotal: number;
    addedSubtotal?: number;
    distanceMeters?: number;
    minimumOrderValue?: number | null;
};

interface AddedToCartSummaryProps {
    addedItems?: AddedItem[];
    deliveryInfos?: Record<string, DeliveryInfo>;
    address?: any;
    onChangeAddress?: (shopId?: string) => void;
    carts?: CartResultPayload[];
    highlightLandmark?: boolean; // Highlight landmark field if there was an error
}

export default function AddedToCartSummary({
    addedItems = [],
    deliveryInfos,
    address,
    onChangeAddress,
    carts = [],
    highlightLandmark = false,
}: AddedToCartSummaryProps) {
    const { t } = useTranslation();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { getShopCart, updateItemQuantity, carts: contextCarts } = useCart();
    const { selectedAddress, setSelectedAddress } = useLocationSelection();
    const [landmarkValue, setLandmarkValue] = useState(selectedAddress?.landmark || '');
    const [deliveryState, setDeliveryState] = useState<Record<string, CalculatedDeliveryInfo>>({});
    const [calculatingShops, setCalculatingShops] = useState<Record<string, boolean>>({});
    const [forceUpdate, setForceUpdate] = useState(0);

    // Force re-render when cart context updates
    useEffect(() => {
        setForceUpdate(prev => prev + 1);
    }, [contextCarts]);

    useEffect(() => {
        setLandmarkValue(selectedAddress?.landmark || '');
    }, [selectedAddress?.landmark]);

    useEffect(() => {
        if (!deliveryInfos) return;
        setDeliveryState((prev) => {
            const next = { ...prev };
            Object.entries(deliveryInfos).forEach(([shopId, info]) => {
                next[shopId] = {
                    deliveryFee: (info.deliveryFee || 0) / 100,
                    surcharge: (info.surcharge || 0) / 100,
                    freeDeliveryApplied: info.freeDeliveryApplied,
                    total: (info.total || 0) / 100,
                    cartSubtotal: (info.cartSubtotal || 0) / 100,
                    addedSubtotal: info.addedSubtotal ? info.addedSubtotal / 100 : next[shopId]?.addedSubtotal,
                };
            });
            return next;
        });
    }, [deliveryInfos]);

    const shopCards = useMemo<ShopCardData[]>(() => {
        const map = new Map<string, ShopCardData>();

        // First, process carts from props
        carts.forEach((cart) => {
            map.set(cart.shopId, {
                shopId: cart.shopId,
                shopName: cart.shopName,
                items: (cart.items || []).map((item) => ({
                    itemId: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    shopId: cart.shopId,
                    shopName: cart.shopName,
                    price_cents: item.price_cents,
                    image_url: item.image_url || undefined,
                })),
                totalPrice: cart.totalPrice,
                shopImage: cart.shopImage || undefined,
                shopAddress: cart.shopAddress,
                shopLatitude: cart.shopLatitude ?? null,
                shopLongitude: cart.shopLongitude ?? null,
                deliveryLogic: cart.deliveryLogic ?? null,
            });
        });

        // Track added items for subtotal calculation
        const addedSubtotals = new Map<string, number>();
        addedItems.forEach((item) => {
            const current = addedSubtotals.get(item.shopId) || 0;
            addedSubtotals.set(item.shopId, current + item.price_cents * item.quantity);
        });

        // Also ensure we have entries for shops that only have added items
        addedItems.forEach((item) => {
            if (!map.has(item.shopId)) {
                map.set(item.shopId, {
                    shopId: item.shopId,
                    shopName: item.shopName,
                    items: [],
                    totalPrice: 0,
                    addedSubtotal: 0,
                });
            }
        });

        // Now sync with live cart data
        map.forEach((value, key) => {
            const liveCart = getShopCart(key);
            if (liveCart) {
                // Use live cart items (which are the source of truth)
                // Deduplicate by itemId to prevent duplicate keys
                const itemsMap = new Map<string, typeof liveCart.items[0]>();
                (liveCart.items || []).forEach((item) => {
                    itemsMap.set(item.id, item);
                });
                
                map.set(key, {
                    shopId: liveCart.shopId,
                    shopName: liveCart.shopName,
                    items: Array.from(itemsMap.values()).map((item) => ({
                        itemId: item.id,
                        name: item.name,
                        quantity: item.quantity,
                        shopId: liveCart.shopId,
                        shopName: liveCart.shopName,
                        price_cents: item.price_cents,
                        image_url: item.image_url || undefined,
                    })),
                    totalPrice: liveCart.totalPrice,
                    addedSubtotal: addedSubtotals.get(key),
                    shopImage: liveCart.shopImage || value.shopImage,
                    shopAddress: liveCart.shopAddress || value.shopAddress,
                    shopLatitude: liveCart.shopLatitude ?? value.shopLatitude ?? null,
                    shopLongitude: liveCart.shopLongitude ?? value.shopLongitude ?? null,
                    deliveryLogic: liveCart.deliveryLogic || value.deliveryLogic,
                });
            } else {
                // If no live cart, use the cart from props and add added items
                const addedSubtotal = addedSubtotals.get(key);
                if (addedSubtotal !== undefined) {
                    value.addedSubtotal = addedSubtotal;
                }
            }
        });

        return Array.from(map.values());
    }, [addedItems, carts, getShopCart, forceUpdate, contextCarts]);

    const shopsNeedingCalculation = useMemo(
        () =>
            shopCards.filter((shop) => {
                const info = deliveryState[shop.shopId];
                const liveCart = getShopCart(shop.shopId);
                const currentSubtotal = liveCart ? liveCart.totalPrice / 100 : shop.totalPrice / 100;
                return (
                    !info ||
                    info.distanceMeters === undefined ||
                    info.cartSubtotal === undefined ||
                    Math.abs(info.cartSubtotal - currentSubtotal) > 0.01 // Allow small floating point differences
                );
            }),
        [shopCards, deliveryState, getShopCart]
    );

    useEffect(() => {
        const coords = selectedAddress?.coords;
        if (!coords || shopsNeedingCalculation.length === 0) {
            return;
        }

        let cancelled = false;

        const calculateMissingFees = async () => {
            for (const shop of shopsNeedingCalculation) {
                if (!shop.shopLatitude || !shop.shopLongitude) continue;

                setCalculatingShops((prev) => ({ ...prev, [shop.shopId]: true }));

                try {
                    let logic = shop.deliveryLogic || null;
                    if (!logic) {
                        const { data } = await fetchDeliveryLogic(shop.shopId);
                        logic = data || null;
                    }

                    if (!logic) continue;

                    const distance = calculateDistance(
                        coords.latitude,
                        coords.longitude,
                        shop.shopLatitude,
                        shop.shopLongitude
                    );

                    const liveCart = getShopCart(shop.shopId);
                    const subtotal = liveCart ? liveCart.totalPrice / 100 : shop.totalPrice / 100;
                    const calculation = calculateTotalDeliveryFee(subtotal, distance, logic);

                    if (cancelled) return;

                    setDeliveryState((prev) => ({
                        ...prev,
                        [shop.shopId]: {
                            deliveryFee: calculation.baseFee,
                            surcharge: calculation.surcharge,
                            freeDeliveryApplied: calculation.freeDeliveryApplied,
                            total: subtotal + calculation.finalFee,
                            cartSubtotal: subtotal,
                            addedSubtotal: prev[shop.shopId]?.addedSubtotal ?? (shop.addedSubtotal ? shop.addedSubtotal / 100 : undefined),
                            distanceMeters: distance,
                            minimumOrderValue: logic.leastOrderValue ?? null,
                        },
                    }));
                } catch (error) {
                    console.error('[AddedToCartSummary] Failed to calculate delivery fee', error);
                } finally {
                    if (!cancelled) {
                        setCalculatingShops((prev) => ({ ...prev, [shop.shopId]: false }));
                    }
                }
            }
        };

        calculateMissingFees();

        return () => {
            cancelled = true;
        };
    }, [shopsNeedingCalculation, selectedAddress?.coords, getShopCart]);

    // Track cart totals to detect changes
    const cartTotals = useMemo(() => {
        return shopCards.map(shop => {
            const liveCart = getShopCart(shop.shopId);
            return {
                shopId: shop.shopId,
                totalPrice: liveCart?.totalPrice ?? shop.totalPrice,
            };
        });
    }, [shopCards, getShopCart]);

    // Recalculate delivery fees when cart totals change
    useEffect(() => {
        const coords = selectedAddress?.coords;
        if (!coords) return;

        let cancelled = false;

        const recalculateForShops = async () => {
            for (const shop of shopCards) {
                if (!shop.shopLatitude || !shop.shopLongitude) continue;

                const liveCart = getShopCart(shop.shopId);
                if (!liveCart) continue;

                const currentSubtotal = liveCart.totalPrice / 100;
                const existingInfo = deliveryState[shop.shopId];

                // Only recalculate if subtotal changed significantly
                if (existingInfo && Math.abs(existingInfo.cartSubtotal - currentSubtotal) < 0.01) {
                    continue;
                }

                setCalculatingShops((prev) => ({ ...prev, [shop.shopId]: true }));

                try {
                    let logic = shop.deliveryLogic || null;
                    if (!logic) {
                        const { data } = await fetchDeliveryLogic(shop.shopId);
                        logic = data || null;
                    }

                    if (!logic) {
                        setCalculatingShops((prev) => ({ ...prev, [shop.shopId]: false }));
                        continue;
                    }

                    const distance = calculateDistance(
                        coords.latitude,
                        coords.longitude,
                        shop.shopLatitude,
                        shop.shopLongitude
                    );

                    const calculation = calculateTotalDeliveryFee(currentSubtotal, distance, logic);

                    if (cancelled) return;

                    setDeliveryState((prev) => ({
                        ...prev,
                        [shop.shopId]: {
                            ...prev[shop.shopId],
                            deliveryFee: calculation.baseFee,
                            surcharge: calculation.surcharge,
                            freeDeliveryApplied: calculation.freeDeliveryApplied,
                            total: currentSubtotal + calculation.finalFee,
                            cartSubtotal: currentSubtotal,
                            distanceMeters: distance,
                            minimumOrderValue: logic.leastOrderValue ?? null,
                        },
                    }));
                } catch (error) {
                    console.error('[AddedToCartSummary] Failed to recalculate delivery fee', error);
                } finally {
                    if (!cancelled) {
                        setCalculatingShops((prev) => ({ ...prev, [shop.shopId]: false }));
                    }
                }
            }
        };

        recalculateForShops();

        return () => {
            cancelled = true;
        };
    }, [cartTotals.map(c => c.totalPrice).join(','), selectedAddress?.coords, shopCards]); // Recalculate when cart totals change

    const requiresLandmark = Boolean(
        selectedAddress && (!selectedAddress.landmark || !selectedAddress.landmark.trim())
    );

    const handleSaveLandmark = () => {
        if (!selectedAddress) return;

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

    const handleIncrement = async (shopId: string, itemId: string) => {
        const liveCart = getShopCart(shopId);
        const item = liveCart?.items.find((i) => i.id === itemId);
        if (item) {
            await updateItemQuantity(shopId, itemId, item.quantity + 1);
        }
    };

    const handleDecrement = async (shopId: string, itemId: string) => {
        const liveCart = getShopCart(shopId);
        const item = liveCart?.items.find((i) => i.id === itemId);
        if (item && item.quantity > 1) {
            await updateItemQuantity(shopId, itemId, item.quantity - 1);
        } else if (item && item.quantity === 1) {
            // Remove item completely if quantity would be 0
            await updateItemQuantity(shopId, itemId, 0);
        }
    };

    // Show cart summary if we have added items OR if we have shop cards
    // This ensures the banner shows immediately after adding items
    if (shopCards.length === 0 && (!addedItems || addedItems.length === 0)) {
        return null;
    }
    
    // If we have added items but no shop cards yet, create a temporary card from added items
    const finalShopCards = shopCards.length > 0 ? shopCards : (() => {
        // Group added items by shop
        const shopMap = new Map<string, ShopCardData>();
        addedItems.forEach((item) => {
            if (!shopMap.has(item.shopId)) {
                shopMap.set(item.shopId, {
                    shopId: item.shopId,
                    shopName: item.shopName,
                    items: [],
                    totalPrice: 0,
                    addedSubtotal: 0,
                });
            }
            const shopCard = shopMap.get(item.shopId)!;
            shopCard.items.push(item);
            shopCard.totalPrice += item.price_cents * item.quantity;
            shopCard.addedSubtotal = (shopCard.addedSubtotal || 0) + (item.price_cents * item.quantity);
        });
        return Array.from(shopMap.values());
    })();

    const gap = 8;
    const availableWidth = SCREEN_WIDTH - 64;
    const itemWidth =
        finalShopCards.length > 1
            ? (availableWidth - gap * (finalShopCards.length - 1)) / finalShopCards.length
        : availableWidth;

    const headerText =
        addedItems.length > 0
            ? t('cart.addedToCart', 'Added to cart')
            : t('cart.cartSummary', 'Cart Summary');

    const addressLabel =
        selectedAddress?.label ||
        address?.street_address ||
        address?.formatted_address ||
        t('checkout.selectAddressMsg', 'Select a delivery address');

    return (
        <View style={styles.container}>
            <Text style={styles.headerText}>{headerText}</Text>

            <View style={styles.shopsContainer}>
                {finalShopCards.map((shopData, index) => {
                    const liveCart = getShopCart(shopData.shopId);
                    const deliveryInfo = deliveryState[shopData.shopId];
                    const subtotalValue = liveCart ? liveCart.totalPrice / 100 : (shopData.totalPrice || 0) / 100;
                    const addedSubtotal =
                        shopData.addedSubtotal !== undefined
                            ? shopData.addedSubtotal / 100
                            : deliveryInfo?.addedSubtotal;
                    const meetsMinimum =
                        !deliveryInfo?.minimumOrderValue ||
                        subtotalValue >= deliveryInfo.minimumOrderValue;
                    const isCalculating = calculatingShops[shopData.shopId];


                    return (
                        <TouchableOpacity
                            key={shopData.shopId}
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('ViewCart', { shopId: shopData.shopId })}
                            style={[
                                styles.shopCard,
                                { width: itemWidth },
                                index < finalShopCards.length - 1 && { marginRight: gap },
                            ]}
                        >
                            <LinearGradient colors={['#f0f9ff', '#e0f2fe']} style={styles.gradient}>
                                <Text style={styles.shopName} numberOfLines={1}>
                                    {shopData.shopName}
                                </Text>

                                <View style={styles.itemsPreview}>
                                    {(shopData.items || []).slice(0, 5).map((item) => {
                                        const liveCart = getShopCart(shopData.shopId);
                                        const liveItem = liveCart?.items.find((i) => i.id === item.itemId);
                                        const currentQuantity = liveItem?.quantity ?? item.quantity;
                                        const currentPrice = liveItem?.price_cents ?? item.price_cents;

                                        return (
                                        <View key={item.itemId} style={styles.itemRow}>
                                            <View style={styles.imageContainer}>
                                                {item.image_url ? (
                                                    <Image
                                                        source={{ uri: item.image_url }}
                                                        style={styles.itemImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={styles.placeholderImage} />
                                                )}
                                                <View style={styles.quantityBadge}>
                                                        <Text style={styles.quantityText}>{currentQuantity}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.itemTextContainer}>
                                                <Text style={styles.itemName} numberOfLines={2}>
                                                    {item.name}
                                                </Text>
                                                <View style={styles.priceContainer}>
                                                    <Text style={styles.itemPrice}>
                                                            {t('common.currency', 'PKR')} {Math.round(currentPrice / 100)}
                                                    </Text>
                                                        {currentQuantity > 1 && (
                                                        <Text style={styles.itemTotal}>
                                                                Total: {t('common.currency', 'PKR')}{' '}
                                                                {Math.round((currentPrice * currentQuantity) / 100)}
                                                        </Text>
                                                    )}
                                                    </View>
                                                </View>
                                                <View style={styles.quantityControls}>
                                                    <TouchableOpacity
                                                        style={styles.quantityButton}
                                                        onPress={() => handleDecrement(shopData.shopId, item.itemId)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.quantityButtonText}>−</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.quantityDisplay}>{currentQuantity}</Text>
                                                    <TouchableOpacity
                                                        style={styles.quantityButton}
                                                        onPress={() => handleIncrement(shopData.shopId, item.itemId)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.quantityButtonText}>+</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                    {shopData.items && shopData.items.length > 5 && (
                                        <Text style={styles.moreText}>
                                            +{shopData.items.length - 5} {t('cart.moreItems', 'more items')}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.footer}>
                                    {isCalculating && (
                                        <View style={styles.calculatingRow}>
                                            <ActivityIndicator size="small" color="#0284c7" />
                                            <Text style={styles.calculatingText}>
                                                {t('cart.deliveryCalculating', 'Calculating...')}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.row}>
                                        <Text style={styles.label}>{t('cart.subtotal', 'Subtotal')}</Text>
                                        <Text style={styles.value}>
                                            {t('common.currency', 'PKR')} {Math.round(subtotalValue)}
                                        </Text>
                                    </View>

                                    {addedSubtotal !== undefined && addedSubtotal !== subtotalValue && (
                                        <View style={styles.row}>
                                            <Text style={styles.secondaryLabel}>{t('cart.addedNow', 'Added now')}</Text>
                                            <Text style={styles.secondaryValue}>
                                                {t('common.currency', 'PKR')} {Math.round(addedSubtotal)}
                                            </Text>
                                        </View>
                                    )}

                                    {deliveryInfo && (
                                        <>
                                            <View style={styles.row}>
                                                <Text style={styles.label}>{t('cart.deliveryFee', 'Delivery')}</Text>
                                                <Text
                                                    style={[
                                                        styles.value,
                                                        deliveryInfo.freeDeliveryApplied && styles.freeText,
                                                    ]}
                                                >
                                                    {deliveryInfo.freeDeliveryApplied
                                                        ? t('common.free', 'Free')
                                                        : `${t('common.currency', 'PKR')} ${Math.round(deliveryInfo.deliveryFee)}`}
                                                </Text>
                                            </View>
                                            {deliveryInfo.surcharge > 0 && (
                                                <View style={styles.row}>
                                                    <Text style={styles.label}>{t('cart.surcharge', 'Small order fee')}</Text>
                                                    <Text style={styles.value}>
                                                        {t('common.currency', 'PKR')} {Math.round(deliveryInfo.surcharge)}
                                                    </Text>
                                                </View>
                                            )}
                                            <View style={[styles.row, styles.totalRow]}>
                                                <Text style={styles.totalLabel}>{t('cart.total', 'Total')}</Text>
                                                <Text style={styles.totalPrice}>
                                                    {t('common.currency', 'PKR')} {Math.round(deliveryInfo.total)}
                                                </Text>
                                            </View>
                                        </>
                                    )}

                                        <View style={styles.addressContainer}>
                                            <View style={styles.addressHeader}>
                                                <LocationMarkerIcon size={12} color="#64748b" />
                                                <Text style={styles.addressLabel} numberOfLines={1}>
                                                {addressLabel}
                                                </Text>
                                            </View>
                                            {onChangeAddress && (
                                            <TouchableOpacity onPress={() => onChangeAddress(shopData.shopId)}>
                                                    <Text style={styles.changeAddressText}>{t('common.change', 'Change')}</Text>
                                                </TouchableOpacity>
                                        )}
                                    </View>

                                    {selectedAddress?.landmark && selectedAddress.landmark.trim() && (
                                        <View style={styles.landmarkDisplayContainer}>
                                            <Text style={styles.landmarkLabel}>
                                                {t('checkout.landmark', 'Landmark')}:
                                            </Text>
                                            <Text style={styles.landmarkValue}>
                                                {selectedAddress.landmark}
                                            </Text>
                                        </View>
                                    )}

                                    {requiresLandmark && (
                                        <View style={[
                                            styles.landmarkContainer,
                                            highlightLandmark && styles.landmarkContainerError
                                        ]}>
                                            <Text style={styles.sectionLabel}>
                                                {t('checkout.landmarkPrompt', 'Add a landmark so riders can find you')}
                                            </Text>
                                            {highlightLandmark && (
                                                <Text style={styles.landmarkErrorText}>
                                                    {t('checkout.landmarkRequired', 'Landmark is required to place order')}
                                                </Text>
                                            )}
                                            <Text style={styles.landmarkHint}>
                                                {t(
                                                    'checkout.landmarkExample',
                                                    'Example: Opposite Habib Bank, Gate #2, Street 5'
                                                )}
                                            </Text>
                                            <TextInput
                                                style={[
                                                    styles.landmarkInput,
                                                    highlightLandmark && styles.landmarkInputError
                                                ]}
                                                placeholder={t(
                                                    'checkout.landmarkPlaceholder',
                                                    'Nearby landmark or building'
                                                )}
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

                                    {!meetsMinimum && deliveryInfo?.minimumOrderValue && (
                                        <Text style={styles.warningText}>
                                            {t(
                                                'cart.minimumOrderWarning',
                                                'Minimum order amount is Rs {{amount}}. Add a bit more to continue.',
                                                { amount: deliveryInfo.minimumOrderValue.toFixed(0) }
                                            )}
                                        </Text>
                                    )}

                                    <View style={styles.viewCartButton}>
                                        <Text style={styles.viewCartText}>{t('cart.view', 'View Cart')}</Text>
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        marginBottom: 8,
        width: '100%',
    },
    headerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0369a1',
        marginBottom: 10,
        marginLeft: 4,
    },
    shopsContainer: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'flex-start',
    },
    shopCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#bae6fd',
        backgroundColor: '#fff',
    },
    gradient: {
        padding: 12,
    },
    shopName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0c4a6e',
        marginBottom: 12,
    },
    itemsPreview: {
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderRadius: 12,
        paddingHorizontal: 4,
        paddingVertical: 2,
        marginLeft: 8,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    quantityButton: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0284c7',
    },
    quantityDisplay: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0c4a6e',
        minWidth: 24,
        textAlign: 'center',
        marginHorizontal: 4,
    },
    calculatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        paddingVertical: 4,
    },
    calculatingText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 6,
    },
    imageContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        marginRight: 10,
        position: 'relative',
        borderWidth: 1,
        borderColor: '#e0f2fe',
    },
    itemImage: {
        width: '100%',
        height: '100%',
        borderRadius: 7,
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        borderRadius: 7,
        backgroundColor: '#f0f9ff',
    },
    quantityBadge: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        backgroundColor: '#0284c7',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    quantityText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 4,
    },
    itemTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
        marginBottom: 2,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    itemPrice: {
        fontSize: 13,
        color: '#64748b',
        marginRight: 8,
    },
    itemTotal: {
        fontSize: 13,
        color: '#0369a1',
        fontWeight: '500',
    },
    moreText: {
        fontSize: 12,
        color: '#0284c7',
        fontStyle: 'italic',
        marginTop: 4,
    },
    footer: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.6)',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    label: {
        fontSize: 13,
        color: '#64748b',
    },
    secondaryLabel: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    value: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    secondaryValue: {
        fontSize: 12,
        color: '#475569',
    },
    freeText: {
        color: '#16a34a',
        fontWeight: '600',
    },
    totalRow: {
        marginTop: 4,
        marginBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.4)',
    },
    totalLabel: {
        fontSize: 14,
        color: '#0c4a6e',
        fontWeight: '700',
    },
    totalPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0284c7',
    },
    addressContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.5)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 12,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    addressLabel: {
        fontSize: 11,
        color: '#64748b',
        marginLeft: 4,
        flex: 1,
    },
    changeAddressText: {
        fontSize: 11,
        color: '#0284c7',
        fontWeight: '600',
    },
    landmarkDisplayContainer: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    landmarkLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
    },
    landmarkValue: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
    },
    landmarkContainer: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        borderRadius: 12,
        padding: 10,
        marginBottom: 12,
    },
    landmarkContainerError: {
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5',
        borderWidth: 2,
    },
    landmarkErrorText: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
        marginBottom: 6,
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
        paddingVertical: 8,
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#0f172a',
        marginBottom: 8,
    },
    landmarkInputError: {
        borderColor: '#ef4444',
        borderWidth: 2,
        backgroundColor: '#fef2f2',
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
    warningText: {
        fontSize: 12,
        color: '#b45309',
        fontWeight: '600',
        marginBottom: 8,
    },
    viewCartButton: {
        backgroundColor: '#0284c7',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    viewCartText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
});
