import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../../context/CartContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import FunctionCallDisplay from './FunctionCallDisplay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SearchResultItem {
    id: string;
    shopId: string;
    name: string;
    price_cents: number;
    similarity: number;
    image_url?: string;
}

interface SearchResultShop {
    shop: {
        id: string;
        name: string;
        address: string;
        delivery_fee: number;
        image_url?: string;
    };
    items: SearchResultItem[];
    relevanceScore: number;
}

interface SearchResultsProps {
    results: {
        shops: SearchResultShop[];
        reasoning?: string;
        intent?: any;
    };
}

export default function SearchResults({ results }: SearchResultsProps) {
    const { t } = useTranslation();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { addItemToCart } = useCart();

    if (!results || !results.shops || results.shops.length === 0) {
        return null;
    }

    const shopCount = results.shops.length;
    const gap = 12;
    const horizontalPadding = 32; // matches content padding
    const availableWidth = SCREEN_WIDTH - horizontalPadding;
    const cardWidth =
        shopCount > 1
            ? (availableWidth - gap * (shopCount - 1)) / shopCount
            : availableWidth * 0.8;

    return (
        <View style={styles.container}>
            {/* Show AI reasoning if available - display like function calls */}
            {results.reasoning && (
                <FunctionCallDisplay
                    functionName="thinking"
                    description="AI Reasoning"
                    content={results.reasoning}
                    isStreaming={false}
                />
            )}
            
            <Text style={styles.headerText}>{t('shoppingAssistant.foundItems', 'Found these items for you')}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="fast"
            >
                {results.shops.map((shopResult, index) => (
                    <View
                        key={shopResult.shop.id}
                        style={[
                            styles.cardContainer,
                            { width: cardWidth },
                            index < shopCount - 1 && { marginRight: gap },
                        ]}
                    >
                        {/* Shop Header */}
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => navigation.navigate('Shop', { shopId: shopResult.shop.id })}
                            style={styles.shopHeader}
                        >
                            <LinearGradient
                                colors={['#f8fafc', '#f1f5f9']}
                                style={styles.shopHeaderGradient}
                            >
                                <View style={styles.shopInfo}>
                                    <Text style={styles.shopName} numberOfLines={1}>
                                        {shopResult.shop.name}
                                    </Text>
                                    <View style={styles.deliveryInfo}>
                                        <Text style={styles.deliveryFee}>
                                            {shopResult.shop.delivery_fee > 0
                                                ? t('shopCard.deliveryFee', { amount: Math.round(shopResult.shop.delivery_fee) })
                                                : t('shopCard.freeDelivery')}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.visitButton}>
                                    <Text style={styles.visitButtonText}>Visit</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Items List */}
                        <View style={styles.itemsContainer}>
                            {shopResult.items.slice(0, 3).map((item, index) => (
                                <View key={item.id} style={[
                                    styles.itemRow,
                                    index === shopResult.items.slice(0, 3).length - 1 && styles.lastItemRow
                                ]}>
                                    {/* Item Image */}
                                    <View style={styles.imageContainer}>
                                        {item.image_url ? (
                                            <Image
                                                source={{ uri: item.image_url }}
                                                style={styles.itemImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={styles.placeholderImage}>
                                                <Text style={styles.placeholderText}>No Img</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.itemPrice}>
                                            {t('common.currency', 'PKR')} {Math.round(item.price_cents / 100)}
                                        </Text>
                                    </View>

                                    {/* We don't have direct add to cart here because we need full item details.
                      The user can ask the agent to add it. */}
                                </View>
                            ))}
                            {shopResult.items.length > 3 && (
                                <View style={styles.moreItems}>
                                    <Text style={styles.moreItemsText}>
                                        +{shopResult.items.length - 3} more items
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 12,
    },
    headerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
        marginLeft: 20,
        marginBottom: 12,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        alignItems: 'stretch',
    },
    cardContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    shopHeader: {
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    shopHeaderGradient: {
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    shopInfo: {
        flex: 1,
        marginRight: 8,
    },
    shopName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 2,
    },
    deliveryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deliveryFee: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    visitButton: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    visitButtonText: {
        fontSize: 11,
        color: '#2563eb',
        fontWeight: '600',
    },
    itemsContainer: {
        padding: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    lastItemRow: {
        borderBottomWidth: 0,
    },
    imageContainer: {
        width: 48,
        height: 48,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
    },
    placeholderText: {
        fontSize: 8,
        color: '#94a3b8',
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        color: '#334155',
        marginBottom: 2,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    moreItems: {
        marginTop: 8,
        alignItems: 'center',
    },
    moreItemsText: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500',
    },
});
