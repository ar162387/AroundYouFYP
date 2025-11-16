import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import DeliveryRunnerIcon from '../../icons/DeliveryRunnerIcon';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useUserLocation } from '../../hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../context/LocationContext';
import { searchShopsAndItems, fetchSampleItemsForShop, type ShopSearchResult, type SearchItem } from '../../services/consumer/searchService';
import ShopCard from '../../components/consumer/ShopCard';

export default function 
SearchScreen() {
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<ShopSearchResult[]>([]);
  const navigation = useNavigation();
  const route = useRoute();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  // Prefer selected address coords if present (same behavior as HomeScreen)
  const activeCoords = React.useMemo(() => {
    return selectedAddress?.coords || coords || null;
  }, [selectedAddress?.coords?.latitude, selectedAddress?.coords?.longitude, coords?.latitude, coords?.longitude]);

  // Debug: log active coordinates when they change
  React.useEffect(() => {
    console.log('[SearchScreen] activeCoords:', activeCoords);
  }, [activeCoords?.latitude, activeCoords?.longitude]);

  // Debounced realtime search while typing
  React.useEffect(() => {
    const handle = setTimeout(async () => {
      if (!activeCoords?.latitude || !activeCoords?.longitude) return;
      if (!query.trim() || query.trim().length < 2) {
        setResults([]);
        if (!query.trim()) {
          console.log('[SearchScreen] skip search: empty query');
        } else {
          console.log('[SearchScreen] skip search: short query', query);
        }
        return;
      }
      console.log('[SearchScreen] running debounced search for:', query);
      setLoading(true);
      const { results: r } = await searchShopsAndItems(activeCoords.latitude, activeCoords.longitude, query);
      setResults(r);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, activeCoords?.latitude, activeCoords?.longitude]);

  // Trigger a full search explicitly for the current input (e.g., suggestion tap)
  const runExplicitSearch = async (text: string) => {
    if (!activeCoords?.latitude || !activeCoords?.longitude) return;
    setQuery(text);
    setLoading(true);
    console.log('[SearchScreen] running explicit search for:', text);
    const { results: r } = await searchShopsAndItems(activeCoords.latitude, activeCoords.longitude, text);
    setResults(r);
    setLoading(false);
  };

  const renderItemsRow = (items: SearchItem[]) => {
    if (!items || items.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ paddingRight: 12 }}>
        {items.map((item) => (
          <View key={item.id} className="mr-3">
            <View className="w-[96px] h-[96px] bg-gray-100 rounded-xl items-center justify-center overflow-hidden">
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Text className="text-gray-400 text-xs">No Image</Text>
              )}
            </View>
            <Text className="text-gray-800 text-xs mt-1 w-[96px]" numberOfLines={2}>{item.name}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <View className="flex-1 bg-white px-4 pt-12">
      <View className="flex-row items-center">
        {route.name === 'Search' && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            className="w-10 h-12 items-center justify-center mr-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
        )}
        <View className="flex-1 flex-row items-center bg-gray-100 rounded-2xl px-4 py-3">
          <Text className="text-gray-400 text-lg mr-2">🔍</Text>
          <TextInput
            autoFocus
            value={query}
            onChangeText={(t) => {
              console.log('[SearchScreen] query changed:', t);
              setQuery(t);
            }}
            placeholder="Search for shops, items..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-gray-800 text-base"
            returnKeyType="search"
            onSubmitEditing={() => runExplicitSearch(query)}
          />
        </View>
      </View>

      {/* Suggest-as-you-type */}
      {query.trim().length > 0 && (
        <TouchableOpacity
          className="mt-3"
          onPress={() => runExplicitSearch(query)}
          activeOpacity={0.7}
        >
          <Text className="text-gray-600">
            Search for "{query}"
          </Text>
        </TouchableOpacity>
      )}

      {/* Results / Empty Location */}
      <ScrollView className="mt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {!activeCoords?.latitude || !activeCoords?.longitude ? (
          <View className="py-12 items-center">
            <Text className="text-gray-600 text-center px-6">
              Set your delivery address to search shops and items available in your area.
            </Text>
          </View>
        ) : null}

        {loading && (
          <View className="py-12 items-center">
            <ActivityIndicator />
            <Text className="text-gray-500 mt-2">Searching…</Text>
          </View>
        )}

        {!loading && results.length === 0 && query.trim().length >= 2 && (
          <View className="py-12 items-center">
            <Text className="text-gray-500">No results found. Try a different query.</Text>
          </View>
        )}

        {!loading && results.map((r) => (
          <TouchableOpacity
            key={r.shop.id}
            activeOpacity={0.7}
            onPress={() => (navigation as any).navigate('Shop', { shopId: r.shop.id, shop: r.shop })}
            className="bg-white rounded-2xl overflow-hidden mb-5"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            {/* Header row */}
            <View className="flex-row">
              <View className="w-[132px] h-24 overflow-hidden">
                {r.shop.image_url ? (
                  <Image
                    source={{ uri: r.shop.image_url }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full bg-gray-200 items-center justify-center">
                    <Text className="text-3xl">🏪</Text>
                  </View>
                )}
              </View>
              <View className="flex-1 p-3 justify-center">
                <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                  {r.shop.name}
                </Text>
                <View className="flex-row items-center mt-1 flex-wrap">
                  {/* Delivery runner icon + fee */}
                  <View className="flex-row items-center bg-blue-50 px-2 py-1 rounded-full mr-2 mb-1">
                    <DeliveryRunnerIcon size={14} />
                    <Text className="text-blue-700 text-[11px] ml-1">
                      Rs {Math.round((r.shop as any).delivery_fee || 0)}
                    </Text>
                  </View>
                  {/* Minimum order */}
                  {'minimumOrderValue' in r.shop && r.shop.minimumOrderValue !== undefined && r.shop.minimumOrderValue !== null && (
                    <View className="bg-gray-100 px-2 py-1 rounded-full mr-2 mb-1">
                      <Text className="text-gray-700 text-[11px]">
                        Min: Rs {Math.round((r.shop as any).minimumOrderValue)}
                      </Text>
                    </View>
                  )}
                  {/* Rating */}
                  <View className="bg-yellow-50 px-2 py-1 rounded-full mr-2 mb-1">
                    <Text className="text-yellow-700 text-[11px]">
                      ★ {(r.shop as any).rating || 0}
                      {(r.shop as any).orders != null
                        ? ` (${(r.shop as any).orders})`
                        : (r.shop as any).ratingCount
                        ? ` (${(r.shop as any).ratingCount})`
                        : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            {/* Items row unified inside card */}
            <View className="px-3 pb-3 pt-1 border-t border-gray-100">
              {r.matchedItems && r.matchedItems.length > 0 ? (
                renderItemsRow(r.matchedItems.slice(0, 12))
              ) : (
                <LazySampleItems shopId={r.shop.id} render={renderItemsRow} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function LazySampleItems({ shopId, render }: { shopId: string; render: (items: SearchItem[]) => React.ReactNode }) {
  const [items, setItems] = React.useState<SearchItem[] | null>(null);
  React.useEffect(() => {
    let mounted = true;
    fetchSampleItemsForShop(shopId, 8).then(({ items }) => {
      if (mounted) setItems(items);
    });
    return () => {
      mounted = false;
    };
  }, [shopId]);
  if (!items) return null;
  return <>{render(items)}</>;
}


