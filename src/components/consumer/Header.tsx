
import { View, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FavoriteIcon from '../../icons/FavoriteIcon';
import CartIcon from '../../icons/CartIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  onFavPress?: () => void;
  onCartPress?: () => void;
  onLocationPress?: () => void;
  locationLabel?: string;
}

export default function Header({
  onFavPress,
  onCartPress,
  onLocationPress,
  locationLabel,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#1e3a8a', '#3b82f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      className="pb-3 px-5"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center justify-between">
        {/* Left: Tappable Location (left-aligned) */}
        <TouchableOpacity
          onPress={onLocationPress}
          className="flex-1 mr-3 items-start"
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Text className="text-base">📍</Text>
            <Text numberOfLines={1} className="ml-1 text-white text-base font-semibold">
              {locationLabel || 'Select your address'}
            </Text>
            <Text className="ml-1 text-white/80 text-base">▾</Text>
          </View>
        </TouchableOpacity>

        {/* Right: Favorites and Cart (monochrome-style icons) */}
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={onFavPress}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-2"
            activeOpacity={0.7}
          >
            <FavoriteIcon size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onCartPress}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            activeOpacity={0.7}
          >
            <CartIcon size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

