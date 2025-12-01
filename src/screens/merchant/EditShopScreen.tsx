import React, { useState, useRef, useEffect } from 'react';
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
import { updateShop, uploadShopImage, type ShopType, type CreateShopData, type MerchantShop } from '../../services/merchant/shopService';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import ShopTypeImage from '../../icons/shopTypeRemote';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditShop'>;
type EditShopRouteProp = RNRouteProp<RootStackParamList, 'EditShop'>;

const SHOP_TYPES: { label: string; value: ShopType }[] = [
  { label: 'Grocery', value: 'Grocery' },
  { label: 'Meat', value: 'Meat' },
  { label: 'Vegetable', value: 'Vegetable' },
  { label: 'Stationery', value: 'Stationery' },
  { label: 'Dairy', value: 'Dairy' },
  { label: 'Pharmacy', value: 'Pharmacy' },
];

const EXAMPLE_TAGS = [
  'Fresh Produce', 'Organic', 'Halal', 'Local', 'Fast Delivery',
  'Best Prices', '24/7', 'Bulk Orders', 'Home Delivery', 'Quality Assured',
];

export default function EditShopScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditShopRouteProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const shop = route.params.shop;

  // Get address from route params if coming from map screen
  const initialAddress = route.params?.address || shop.address;
  const initialLatitude = route.params?.latitude ?? shop.latitude;
  const initialLongitude = route.params?.longitude ?? shop.longitude;

  // Form state - initialize with shop data
  const [imageUri, setImageUri] = useState<string | null>(shop.image_url || null);
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description);
  const [shopType, setShopType] = useState<ShopType>(shop.shop_type);
  const [address, setAddress] = useState(initialAddress);
  const [latitude, setLatitude] = useState<number>(initialLatitude);
  const [longitude, setLongitude] = useState<number>(initialLongitude);
  const [tags, setTags] = useState<string[]>(shop.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Update address when route params change
  React.useEffect(() => {
    if (route.params?.address) {
      setAddress(route.params.address);
    }
    if (route.params?.latitude !== undefined) {
      setLatitude(route.params.latitude);
    }
    if (route.params?.longitude !== undefined) {
      setLongitude(route.params.longitude);
    }
  }, [route.params?.address, route.params?.latitude, route.params?.longitude]);

  // Image picker handler with crop functionality
  const handlePickImage = async () => {
    try {
      const ImageCropPicker = require('react-native-image-crop-picker');
      
      // First, pick an image
      const image = await ImageCropPicker.openPicker({
        mediaType: 'photo',
        width: 1200,
        height: 675, // 16:9 aspect ratio for shop images
        cropping: true,
        cropperToolbarTitle: 'Adjust Image',
        cropperChooseText: 'Choose',
        cropperCancelText: 'Cancel',
        cropperRotateButtonsHidden: false,
        freeStyleCropEnabled: false,
        aspectRatio: [16, 9], // Shop image aspect ratio
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      setImageUri(image.path);
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert('Error', error.message || 'Failed to pick image');
      }
    }
  };

  // Edit existing image
  const handleEditImage = async () => {
    if (!imageUri || imageUri.startsWith('http')) {
      // Can't edit remote images, just pick a new one
      handlePickImage();
      return;
    }

    try {
      const ImageCropPicker = require('react-native-image-crop-picker');
      
      const image = await ImageCropPicker.openCropper({
        path: imageUri,
        width: 1200,
        height: 675, // 16:9 aspect ratio
        cropping: true,
        cropperToolbarTitle: 'Adjust Image',
        cropperChooseText: 'Save',
        cropperCancelText: 'Cancel',
        cropperRotateButtonsHidden: false,
        freeStyleCropEnabled: false,
        aspectRatio: [16, 9],
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      setImageUri(image.path);
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert('Error', error.message || 'Failed to edit image');
      }
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

  // Update shop
  const handleUpdateShop = async () => {
    if (!validateForm() || !user) return;

    try {
      ReactNativeHapticFeedback.trigger('impactMedium');
      setIsUpdating(true);

      let imageUrl: string | null | undefined = undefined;

      // Handle image upload/update
      if (imageUri) {
        if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('ph://')) {
          // New image selected - upload it
          const { url, error: uploadError } = await uploadShopImage(user.id, imageUri);
          if (uploadError) {
            Alert.alert('Upload Error', uploadError.message);
            setIsUpdating(false);
            return;
          }
          imageUrl = url || null;
        } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
          // Keep existing image URL (no change)
          imageUrl = imageUri;
        }
      } else {
        // Image was removed - set to null to clear it
        imageUrl = null;
      }

      // Update shop data
      const shopData: Partial<CreateShopData> & { image_url?: string | null } = {
        name: name.trim(),
        description: description.trim(),
        shop_type: shopType,
        address: address.trim(),
        latitude: latitude,
        longitude: longitude,
        tags: tags.length > 0 ? tags : [],
      };

      // Only include image_url if it changed (not undefined)
      // Note: We use 'as any' to allow null for clearing the image
      if (imageUrl !== undefined) {
        (shopData as any).image_url = imageUrl;
      }

      // Update shop
      const { shop: updatedShop, error } = await updateShop(shop.id, user.id, shopData);

      if (error) {
        Alert.alert('Error', error.message);
        setIsUpdating(false);
        return;
      }

      ReactNativeHapticFeedback.trigger('notificationSuccess');
      Alert.alert('Success', 'Shop updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to shop portal with updated shop
            navigation.navigate('MerchantShopPortal', { shop: updatedShop! });
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update shop');
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={[]}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient overlay behind notch/status bar */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, zIndex: 10 }} pointerEvents="none">
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Header */}
      <View className="px-5 pb-4" style={{ paddingTop: insets.top + 16 }}>
        <LinearGradient
          colors={["#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
            <Text className="text-white text-2xl font-bold flex-1">Edit Shop</Text>
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
            <View className="relative rounded-2xl overflow-hidden">
              <View className="w-full bg-gray-100" style={{ aspectRatio: 16 / 9 }}>
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <View className="absolute top-2 right-2 flex-row gap-2">
                <TouchableOpacity
                  onPress={handleEditImage}
                  className="bg-blue-500 rounded-full w-8 h-8 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-xs">✎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRemoveImage}
                  className="bg-red-500 rounded-full w-8 h-8 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-lg">×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handlePickImage}
              className="w-full bg-gray-100 rounded-2xl items-center justify-center border-2 border-dashed border-gray-300"
              style={{ aspectRatio: 16 / 9 }}
              activeOpacity={0.7}
            >
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="text-gray-600 text-base">Tap to add picture</Text>
              <Text className="text-gray-400 text-sm mt-1">16:9 aspect ratio</Text>
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
                  <ShopTypeImage
                    type={type.value}
                    size={24}
                    borderColor={shopType === type.value ? '#2563eb' : '#E5E7EB'}
                    backgroundColor={shopType === type.value ? '#DBEAFE' : '#F3F4F6'}
                  />
                  <Text
                    className={`text-base font-medium ml-2 ${
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
                latitude: latitude,
                longitude: longitude,
                returnTo: 'EditShop',
                shop: shop,
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

        {/* Update Button */}
        <View className="px-5 mb-8">
          <TouchableOpacity
            onPress={handleUpdateShop}
            disabled={isUpdating}
            className={`bg-blue-600 rounded-xl py-4 items-center ${
              isUpdating ? 'opacity-50' : ''
            }`}
            activeOpacity={0.8}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">Update Shop</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

