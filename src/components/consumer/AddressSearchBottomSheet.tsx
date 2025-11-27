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
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import { useTranslation } from 'react-i18next';

export type SheetMode = 'search' | 'confirm' | 'pinpoint' | 'details';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  coords: { latitude: number; longitude: number };
}

export interface AddressSearchBottomSheetProps {
  // Layout/animation
  sheetHeightAnim: Animated.Value;
  sheetBottomAnim?: Animated.Value; // For keyboard adjustment
  sheetMode: SheetMode;
  setSheetMode: (mode: SheetMode) => void;
  animateSheetTo: (height: number) => void;
  SHEET_HEIGHT: number;
  SHEET_HEIGHT_MIN: number;
  SHEET_HEIGHT_PINPOINT: number;
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
  onBackFromPinpoint: () => void;
  onAddDetails: () => void;
  onPinpointComplete: () => void;
  onSearchAgain: () => void;
}

export default function AddressSearchBottomSheet({
  sheetHeightAnim,
  sheetBottomAnim,
  sheetMode,
  setSheetMode,
  animateSheetTo,
  SHEET_HEIGHT,
  SHEET_HEIGHT_MIN,
  SHEET_HEIGHT_PINPOINT,
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
  onBackFromPinpoint,
  onAddDetails,
  onPinpointComplete,
  onSearchAgain,
}: AddressSearchBottomSheetProps) {
  const { t } = useTranslation();
  return (
    <Animated.View
      className="bg-white rounded-t-3xl shadow-2xl"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: sheetBottomAnim || 0,
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
            <Text className="text-gray-900 text-base font-semibold">{t('address.enterAddress')}</Text>
          </View>
          <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-2">
            <Text className="text-xl mr-3">🔍</Text>
            <TextInput
              className="flex-1 text-base text-gray-900"
              placeholder={t('address.searchPlaceholder')}
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
                      // Always go to confirm state
                      setSheetMode('confirm');
                      animateSheetTo(SHEET_HEIGHT_MIN);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="mr-3 mt-0.5">
                      <LocationMarkerIcon size={20} color="#2563EB" innerColor="#FFFFFF" accentColor="rgba(255,255,255,0.25)" />
                    </View>
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
                <Text className="text-gray-500">{t('address.searching')}</Text>
              </View>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <View className="py-4 items-center">
                <Text className="text-gray-500">{t('address.noResults')}</Text>
              </View>
            )}

            {searchQuery.length === 0 && (
              <View className="py-4 items-center">
                <Text className="text-gray-400 text-sm">
                  {t('address.searchStart')}
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
              {t('address.deliveryNote')}
            </Text>
          </View>

          {/* TRANSITION 2 → 3: Pinpoint Button - Fixed at bottom */}
          <View className="mt-auto" style={{ paddingTop: 4 }}>
            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3.5 items-center shadow-md"
              onPress={onAddDetails}
              activeOpacity={0.7}
            >
              <Text className="text-white font-bold text-base">{t('address.pinpointLocation')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : sheetMode === 'pinpoint' ? (
        /* STATE 3: PINPOINT (reduced height) - Just pin placement, no form */
        <View style={{ flex: 1 }}>
          <View className="mb-2">
            <Text className="text-gray-900 text-base font-bold mb-1">{t('address.pinpointHelp')}</Text>
            <Text className="text-gray-600 text-sm">{t('address.pinpointDesc')}</Text>
          </View>

          <View className="mb-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Text className="text-gray-900 font-semibold" numberOfLines={2} ellipsizeMode="tail">{lastReverse?.streetLine || 'Street address'}</Text>
            <Text className="text-gray-600 text-sm" numberOfLines={1} ellipsizeMode="tail">{lastReverse?.city || ''}</Text>
          </View>

          {/* TRANSITION 3 → 4: Continue Button - Fixed at bottom */}
          <View className="mt-auto" style={{ paddingTop: 4 }}>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-white border-2 border-blue-600 rounded-xl py-3.5 items-center"
                onPress={onBackFromPinpoint}
                activeOpacity={0.7}
              >
                <Text className="text-blue-600 font-bold text-base">{t('address.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-xl py-3.5 items-center"
                onPress={onPinpointComplete}
                activeOpacity={0.7}
              >
                <Text className="text-white font-bold text-base">{t('address.continue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* STATE 4: DETAILS - Address details form with sticky buttons */
        <View style={{ flex: 1 }}>
          {/* Clickable Address Header - Transitions back to search */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="mb-3 bg-gray-50 border border-gray-300 rounded-xl"
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

          {/* Scrollable content */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 90 }}
          >
            {user && (
              <>
                <View className="mb-3">
                  <Text className="text-gray-700 text-sm font-medium mb-2">{t('address.addDetails')}</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-base"
                    placeholder={t('address.detailsPlaceholder')}
                    value={landmark}
                    onChangeText={onChangeLandmark}
                    autoCapitalize="words"
                  />
                </View>

                <View className="mb-0">
                  <Text className="text-gray-700 text-sm font-medium mb-2">{t('address.titleLabel')}</Text>
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${selectedTitle === 'home'
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-gray-300'
                        }`}
                      onPress={() => onToggleTitle('home')}
                      activeOpacity={0.7}
                    >
                      <Text className="text-xl mr-2">🏠</Text>
                      <Text className={`font-semibold ${selectedTitle === 'home' ? 'text-blue-600' : 'text-gray-700'}`}>
                        {t('address.home')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${selectedTitle === 'office'
                        ? 'bg-blue-50 border-blue-600'
                        : 'bg-white border-gray-300'
                        }`}
                      onPress={() => onToggleTitle('office')}
                      activeOpacity={0.7}
                    >
                      <Text className="text-xl mr-2">🏢</Text>
                      <Text className={`font-semibold ${selectedTitle === 'office' ? 'text-blue-600' : 'text-gray-700'}`}>
                        {t('address.office')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          {/* Sticky buttons at bottom */}
          <View
            style={{
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 24 : 16,
              left: 16,
              right: 16,
              backgroundColor: 'white',
              paddingTop: 8,
            }}
          >
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-white border-2 border-blue-600 rounded-xl py-3.5 items-center"
                onPress={onBackFromDetails}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <Text className="text-blue-600 font-bold text-base">{t('address.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 bg-blue-600 rounded-xl py-3.5 items-center ${isSaving ? 'opacity-60' : ''}`}
                onPress={onConfirm}
                activeOpacity={0.7}
                disabled={isSaving}
              >
                <Text className="text-white font-bold text-base">{isSaving ? t('address.saving') : t('address.saveAndContinue')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

