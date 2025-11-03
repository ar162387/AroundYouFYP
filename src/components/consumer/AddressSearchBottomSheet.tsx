import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  ScrollView,
  PanResponderGestureState,
} from 'react-native';
import * as addressService from '../../services/consumer/addressService';

export type SheetMode = 'search' | 'confirm' | 'details';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  coords: { latitude: number; longitude: number };
}

export interface AddressSearchBottomSheetProps {
  // Layout/animation
  sheetHeightAnim: Animated.Value;
  sheetMode: SheetMode;
  setSheetMode: (mode: SheetMode) => void;
  animateSheetTo: (height: number) => void;
  SHEET_HEIGHT: number;
  SHEET_HEIGHT_MIN: number;
  SHEET_HEIGHT_DETAILS: number;
  panHandlers: any;

  // Search
  searchQuery: string;
  isSearching: boolean;
  searchResults: SearchResult[];
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onSelectResult: (result: SearchResult) => void;

  // Address
  lastReverse: { formatted: string; city?: string; region?: string; streetLine?: string } | null;
  mapRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

  // Details form (authed)
  user: any;
  landmark: string;
  onChangeLandmark: (text: string) => void;
  selectedTitle: addressService.AddressTitle;
  onToggleTitle: (title: 'home' | 'office') => void;
  isSaving: boolean;
  onConfirm: () => void;
  onBackFromDetails: () => void;
  onAddDetails: () => void;
  onSearchAgain: () => void;
}

export default function AddressSearchBottomSheet({
  sheetHeightAnim,
  sheetMode,
  setSheetMode,
  animateSheetTo,
  SHEET_HEIGHT,
  SHEET_HEIGHT_MIN,
  SHEET_HEIGHT_DETAILS,
  panHandlers,
  searchQuery,
  isSearching,
  searchResults,
  onSearchChange,
  onClearSearch,
  onSelectResult,
  lastReverse,
  mapRegion,
  user,
  landmark,
  onChangeLandmark,
  selectedTitle,
  onToggleTitle,
  isSaving,
  onConfirm,
  onBackFromDetails,
  onAddDetails,
  onSearchAgain,
}: AddressSearchBottomSheetProps) {
  return (
    <Animated.View
      className="bg-white rounded-t-3xl shadow-2xl"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: sheetHeightAnim,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        zIndex: 20,
        elevation: Platform.OS === 'android' ? 8 : 0,
      }}
    >
      {/* Grabber Handle */}
      <View
        className="items-center mb-3"
        {...panHandlers}
        style={{ paddingVertical: 8, marginTop: -8, marginHorizontal: -16, paddingHorizontal: 16 }}
      >
        <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </View>

      {/* STATE 1: SEARCH (90% height) */}
      {sheetMode === 'search' ? (
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <View className="items-center mb-3">
            <Text className="text-gray-900 text-base font-semibold">Enter the Address to Explore Shops AroundYou</Text>
          </View>
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-2">
            <Text className="text-xl mr-3">🔍</Text>
            <TextInput
              className="flex-1 text-base text-gray-900"
              placeholder="Search for location..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={onClearSearch} activeOpacity={0.7}>
                <Text className="text-xl text-gray-400 ml-2">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {searchResults.length > 0 && (
              <>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    className="flex-row items-start py-3 px-2 border-b border-gray-100"
                    onPress={() => {
                      onSelectResult(item);
                      setSheetMode('confirm');
                      animateSheetTo(SHEET_HEIGHT_MIN);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-lg mr-3 mt-0.5">📍</Text>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {item.name}
                      </Text>
                      <Text className="text-sm text-gray-600 mt-0.5" numberOfLines={2}>
                        {item.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {isSearching && (
              <View className="py-4 items-center">
                <Text className="text-gray-500">Searching...</Text>
              </View>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <View className="py-4 items-center">
                <Text className="text-gray-500">No results found</Text>
              </View>
            )}

            {searchQuery.length === 0 && (
              <View className="py-4 items-center">
                <Text className="text-gray-400 text-sm">
                  Search for a location to get started
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      ) : sheetMode === 'confirm' ? (
        /* STATE 2: CONFIRM (38% height) */
        <View style={{ flex: 1 }}>
          {/* Clickable Address Header - Transitions back to search */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="mb-2 bg-gray-50 border border-gray-300 rounded-xl"
            onPress={onSearchAgain}
            style={{ paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <View className="flex-row items-center justify-between">
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text
                  className="text-gray-900 text-base font-bold"
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {lastReverse?.streetLine || 'Street address'}
                </Text>
                <Text className="text-gray-600 text-sm" numberOfLines={1} ellipsizeMode="tail">
                  {lastReverse?.city || ''}
                </Text>
              </View>
              <Text className="text-gray-500 text-lg" style={{ paddingLeft: 8 }}>✎</Text>
            </View>
          </TouchableOpacity>

          <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
            <Text className="text-blue-700 text-sm">
              Your rider will deliver to the pinned location. You can make changes to your written address on the next page.
            </Text>
          </View>

          {/* TRANSITION 2 → 3: Add Details Button - Fixed at bottom */}
          <View className="mt-auto" style={{ paddingTop: 4 }}>
            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3.5 items-center shadow-md"
              onPress={onAddDetails}
              activeOpacity={0.7}
            >
              <Text className="text-white font-bold text-base">Add address details</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* STATE 3: DETAILS (45% height) */
        <View style={{ flex: 1 }}>
          <View className="mb-3">
            <Text className="text-gray-900 text-base font-bold mb-1">Help the Rider Find Your location</Text>
            <Text className="text-gray-600 text-sm">Place the pin exactly on your building entrance for smooth delivery</Text>
          </View>

          <View className="mb-4 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Text className="text-gray-900 font-semibold" numberOfLines={2} ellipsizeMode="tail">{lastReverse?.streetLine || 'Street address'}</Text>
            <Text className="text-gray-600 text-sm" numberOfLines={1} ellipsizeMode="tail">{lastReverse?.city || ''}</Text>
          </View>

          {user && (
            <>
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">Add Flat / House / Street number or Landmark (optional)</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base"
                  placeholder="e.g., Flat 2B, House 45, Near Main Gate"
                  value={landmark}
                  onChangeText={onChangeLandmark}
                  autoCapitalize="words"
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">Address Title (optional, unique)</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
                      selectedTitle === 'home'
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => onToggleTitle('home')}
                    activeOpacity={0.7}
                  >
                    <Text className="text-xl mr-2">🏠</Text>
                    <Text className={`font-semibold ${selectedTitle === 'home' ? 'text-blue-600' : 'text-gray-700'}`}>
                      Home
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
                      selectedTitle === 'office'
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => onToggleTitle('office')}
                    activeOpacity={0.7}
                  >
                    <Text className="text-xl mr-2">🏢</Text>
                    <Text className={`font-semibold ${selectedTitle === 'office' ? 'text-blue-600' : 'text-gray-700'}`}>
                      Office
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* TRANSITION 3 → 2: Back Button */}
          <View className="flex-row gap-3 mt-auto" style={{ paddingTop: 8 }}>
            <TouchableOpacity
              className="flex-1 bg-white border-2 border-blue-600 rounded-xl py-3.5 items-center"
              onPress={onBackFromDetails}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              <Text className="text-blue-600 font-bold text-base">Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 bg-blue-600 rounded-xl py-3.5 items-center ${isSaving ? 'opacity-60' : ''}`}
              onPress={onConfirm}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              <Text className="text-white font-bold text-base">{isSaving ? 'Saving...' : 'Confirm location'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

