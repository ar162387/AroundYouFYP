import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function SearchScreen() {
  const [query, setQuery] = React.useState('');
  const navigation = useNavigation();
  const route = useRoute();
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
            onChangeText={setQuery}
            placeholder="Search for shops, items..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 text-gray-800 text-base"
          />
        </View>
      </View>
    </View>
  );
}


