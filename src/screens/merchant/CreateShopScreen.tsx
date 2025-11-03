import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp as RNRouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { createShop, uploadShopImage, type ShopType, type CreateShopData } from '../../services/merchant/shopService';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CreateShop'>;
type CreateShopRouteProp = RNRouteProp<RootStackParamList, 'CreateShop'>;

const SHOP_TYPES: { label: string; value: ShopType; emoji: string }[] = [
  { label: 'Grocery', value: 'Grocery', emoji: '🛒' },
  { label: 'Meat', value: 'Meat', emoji: '🥩' },
  { label: 'Vegetable', value: 'Vegetable', emoji: '🥬' },
  { label: 'Stationery', value: 'Stationery', emoji: '📚' },
  { label: 'Dairy', value: 'Dairy', emoji: '🥛' },
];

const EXAMPLE_TAGS = [
  'Fresh Produce', 'Organic', 'Halal', 'Local', 'Fast Delivery',
  'Best Prices', '24/7', 'Bulk Orders', 'Home Delivery', 'Quality Assured',
];

export default function CreateShopScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreateShopRouteProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Get address from route params if coming from map screen
  const initialAddress = route.params?.address || '';
  const initialLatitude = route.params?.latitude;
  const initialLongitude = route.params?.longitude;

  // Form state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopType, setShopType] = useState<ShopType | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude || null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Update address when route params change
  React.useEffect(() => {
    if (initialAddress) {
      setAddress(initialAddress);
    }
    if (initialLatitude !== undefined) {
      setLatitude(initialLatitude);
    }
    if (initialLongitude !== undefined) {
      setLongitude(initialLongitude);
    }
  }, [initialAddress, initialLatitude, initialLongitude]);

  // Image picker handler
  const handlePickImage = async () => {
    try {
      // Try to use react-native-image-picker if available
      let ImagePicker: any = null;
      try {
        ImagePicker = require('react-native-image-picker');
      } catch (e) {
        // Library not installed
      }

      if (!ImagePicker) {
        Alert.alert(
          'Image Picker',
          'Image picker library not installed. You can skip adding an image for now.',
          [{ text: 'OK' }]
        );
        return;
      }

      ImagePicker.launchImageLibrary(
        {
          mediaType: 'photo',
          quality: 0.8,
          maxWidth: 1200,
          maxHeight: 1200,
        },
        (response: any) => {
          if (response.didCancel) {
            return;
          } else if (response.errorMessage) {
            Alert.alert('Error', response.errorMessage);
          } else if (response.assets && response.assets[0]) {
            setImageUri(response.assets[0].uri);
          }
        }
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick image');
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setImageUri(null);
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Add example tag
  const handleAddExampleTag = (tag: string) => {
    if (!tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a shop name');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please enter a shop description');
      return false;
    }
    if (!shopType) {
      Alert.alert('Validation Error', 'Please select a shop type');
      return false;
    }
    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please select an address');
      return false;
    }
    if (latitude === null || longitude === null) {
      Alert.alert('Validation Error', 'Please select a valid address location');
      return false;
    }
    return true;
  };

  // Create shop
  const handleCreateShop = async () => {
    if (!validateForm() || !user) return;

    try {
      ReactNativeHapticFeedback.trigger('impactMedium');
      setIsCreating(true);

      let imageUrl: string | undefined;

      // Upload image if provided
      if (imageUri) {
        const { url, error: uploadError } = await uploadShopImage(user.id, imageUri);
        if (uploadError) {
          Alert.alert('Upload Error', uploadError.message);
          setIsCreating(false);
          return;
        }
        imageUrl = url || undefined;
      }

      // Create shop data
      const shopData: CreateShopData = {
        name: name.trim(),
        description: description.trim(),
        shop_type: shopType!,
        address: address.trim(),
        latitude: latitude!,
        longitude: longitude!,
        image_url: imageUrl,
        tags: tags.length > 0 ? tags : undefined,
      };

      // Create shop
      const { shop, error } = await createShop(user.id, shopData);

      if (error) {
        Alert.alert('Error', error.message);
        setIsCreating(false);
        return;
      }

      ReactNativeHapticFeedback.trigger('notificationSuccess');
      Alert.alert('Success', 'Shop created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create shop');
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient overlay behind notch/status bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Header */}
      <View className="px-5 pb-4" style={{ paddingTop: insets.top + 16 }}>
        <LinearGradient
          colors={["#1e3a8a", "#3b82f6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="rounded-b-3xl px-5 py-4"
        >
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-3"
              activeOpacity={0.7}
            >
              <Text className="text-white text-2xl">←</Text>
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold flex-1">Create Shop</Text>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Picture Section */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-3">Shop Picture (Optional)</Text>
          {imageUri ? (
            <View className="relative">
              <Image
                source={{ uri: imageUri }}
                className="w-full h-48 rounded-2xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={handleRemoveImage}
                className="absolute top-2 right-2 bg-red-500 rounded-full w-8 h-8 items-center justify-center"
                activeOpacity={0.8}
              >
                <Text className="text-white text-lg">×</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickImage}
              className="w-full h-48 bg-gray-100 rounded-2xl items-center justify-center border-2 border-dashed border-gray-300"
              activeOpacity={0.7}
            >
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="text-gray-600 text-base">Tap to add picture</Text>
              <Text className="text-gray-400 text-sm mt-1">Recommended: 1200x800px</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Shop Name */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-2">Shop Name *</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="e.g., Fresh Mart Grocery"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* Shop Description */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-2">Description *</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Describe your shop, what makes it special..."
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        {/* Shop Type */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-3">Shop Type *</Text>
          <View className="flex-row flex-wrap gap-3">
            {SHOP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  setShopType(type.value);
                }}
                className={`px-4 py-3 rounded-xl border-2 ${
                  shopType === type.value
                    ? 'bg-blue-50 border-blue-600'
                    : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-2">{type.emoji}</Text>
                  <Text
                    className={`text-base font-medium ${
                      shopType === type.value ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {type.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-2">Address *</Text>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('ShopAddressMap', {
                address: address,
                latitude: latitude || undefined,
                longitude: longitude || undefined,
              });
            }}
            className="bg-white rounded-xl px-4 py-3 border border-gray-200 flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <Text className={`flex-1 text-base ${address ? 'text-gray-900' : 'text-gray-400'}`}>
              {address || 'Select address on map'}
            </Text>
            <Text className="text-blue-600 text-lg">→</Text>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View className="px-5 mb-6">
          <Text className="text-gray-700 text-base font-semibold mb-2">Tags (Optional)</Text>
          <Text className="text-gray-500 text-sm mb-3">
            Add tags to help customers find your shop. Examples: specialties, popular items, etc.
          </Text>
          
          {/* Tag Input */}
          <View className="flex-row gap-2 mb-3">
            <TextInput
              className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200 flex-1"
              placeholder="Add a tag..."
              placeholderTextColor="#9CA3AF"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
              maxLength={30}
            />
            <TouchableOpacity
              onPress={handleAddTag}
              className="bg-blue-600 rounded-xl px-6 py-3 items-center justify-center"
              activeOpacity={0.8}
              disabled={!tagInput.trim() || tags.length >= 10}
            >
              <Text className="text-white font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {/* Example Tags */}
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-2">Example tags:</Text>
            <View className="flex-row flex-wrap gap-2">
              {EXAMPLE_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleAddExampleTag(tag)}
                  className="bg-gray-100 px-3 py-1.5 rounded-full"
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-700 text-sm">+ {tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Selected Tags */}
          {tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleRemoveTag(tag)}
                  className="bg-blue-100 px-3 py-1.5 rounded-full flex-row items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-blue-700 text-sm mr-1">{tag}</Text>
                  <Text className="text-blue-700 text-sm">×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Create Button */}
        <View className="px-5 mb-8">
          <TouchableOpacity
            onPress={handleCreateShop}
            disabled={isCreating}
            className={`bg-blue-600 rounded-xl py-4 items-center ${
              isCreating ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">Create Shop</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

