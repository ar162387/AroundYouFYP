import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LocationMarkerIcon from '../../icons/LocationMarkerIcon';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  onLocationPress?: () => void;
  locationLabel?: string;
}

export default function Header({
  onLocationPress,
  locationLabel,
}: HeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#2563eb", "#1d4ed8"]} // Slightly more vibrant/deep blue
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="pb-4 px-5"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center">
        {/* Tappable Location (full width) */}
        <TouchableOpacity
          onPress={onLocationPress}
          className="flex-1 flex-row items-center bg-white/10 px-3 py-2 rounded-full border border-white/10"
          activeOpacity={0.7}
        >
          <LocationMarkerIcon size={18} color="#ffffff" innerColor="#2563eb" accentColor="rgba(255,255,255,0.3)" />
          <View className="flex-1 ml-2 mr-1">
            <Text className="text-white/70 text-xs font-medium uppercase tracking-wider">{t('header.deliveringTo')}</Text>
            <Text numberOfLines={1} className="text-white text-base font-bold">
              {locationLabel || t('address.selectYourAddress')}
            </Text>
          </View>
          <Text className="text-white/80 text-xs">▼</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

