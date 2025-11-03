
import { View, Text, Pressable } from 'react-native';

interface CategoryIconProps {
  name: string;
  emoji: string;
  onPress?: () => void;
}

export default function CategoryIcon({ name, emoji, onPress }: CategoryIconProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-3"
      android_ripple={{ color: '#e5e7eb' }}
    >
      <View className="w-24 items-center">
        <View className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 items-center justify-center mb-2">
          <Text className="text-2xl">{emoji}</Text>
        </View>
        <Text className="text-gray-700 text-xs font-medium text-center w-full" numberOfLines={1}>
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

