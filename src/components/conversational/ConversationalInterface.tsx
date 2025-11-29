/**
 * Conversational Interface Component
 * 
 * Main UI component for the conversational shopping interface.
 * Displays message history and handles user input (text and voice).
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  Animated,
  Keyboard,
} from 'react-native';
import { useConversation } from '../../context/ConversationContext';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { executeFunctionCall, type FunctionExecutionContext } from '../../services/ai/functionRouter';
import { retrievePreferencesBySimilarity, formatPreferencesForLLM } from '../../services/ai/memoryRetrievalService';
import MessageBubble from './MessageBubble';
import VoiceInputButton from './VoiceInputButton';
import type { ShopItem } from '../../services/consumer/shopService';
import { fetchShopDetails, fetchShopItems, validateDeliveryAddress } from '../../services/consumer/shopService';
import { getUserAddresses } from '../../services/consumer/addressService';
import AddressSelectionBottomSheet from '../consumer/AddressSelectionBottomSheet';
import type { Message } from '../../services/ai/conversationManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ORDER_COMPLETED_FLAG_KEY = 'aroundyou_order_completed';

/**
 * Oscillating dots component for loading states
 */
function OscillatingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 200);
    const anim3 = createAnimation(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const opacity1 = dot1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  const opacity2 = dot2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  const opacity3 = dot3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7280', marginHorizontal: 2 }, { opacity: opacity1 }]} />
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7280', marginHorizontal: 2 }, { opacity: opacity2 }]} />
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7280', marginHorizontal: 2 }, { opacity: opacity3 }]} />
    </View>
  );
}

const CART_MUTATION_FUNCTIONS = new Set([
  'addItemsToCart',
  'addItemToCart',
  'removeItemFromCart',
  'updateItemQuantity',
  'getCart',
]);

function extractShopIdsFromArgs(functionName: string, args: Record<string, any>): string[] {
  if (!args || typeof args !== 'object') {
    return [];
  }

  switch (functionName) {
    case 'addItemsToCart':
      if (Array.isArray(args.items)) {
        return Array.from(
          new Set(
            args.items
              .map((item) => item?.shopId)
              .filter((id: string | undefined): id is string => typeof id === 'string' && id.length > 0)
          )
        );
      }
      return [];
    case 'addItemToCart':
    case 'removeItemFromCart':
    case 'updateItemQuantity':
    case 'getCart':
      return args.shopId ? [args.shopId] : [];
    default:
      return [];
  }
}

export default function ConversationalInterface() {
  const { conversationManager, messages, isLoading, error, sendMessage, continueConversation, refreshMessages, clearConversation, checkAndResetIfNeeded } = useConversation();
  const { addItemToCart, removeItemFromCart, updateItemQuantity, getShopCart, getAllCarts, deleteShopCart } = useCart();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();

  const [inputText, setInputText] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<Record<number, boolean>>({});
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [addressChangeContext, setAddressChangeContext] = useState<{ shopId?: string } | null>(null);
  const lastCartActionRef = useRef<{ name: string; args: Record<string, any>; shopIds: string[] } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Handle keyboard show/hide
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Create function execution context
  const functionContext: FunctionExecutionContext = {
    addItemToCartFn: addItemToCart,
    removeItemFromCartFn: removeItemFromCart,
    updateItemQuantityFn: updateItemQuantity,
    getShopCartFn: getShopCart,
    getAllCartsFn: getAllCarts,
    deleteShopCartFn: deleteShopCart,
    getCurrentLocation: async () => {
      if (selectedAddress?.coords) {
        return {
          latitude: selectedAddress.coords.latitude,
          longitude: selectedAddress.coords.longitude,
        };
      }
      return null;
    },
    getDefaultAddressId: async () => {
      const addresses = await getUserAddresses();
      if (addresses.data && addresses.data.length > 0) {
        return addresses.data[0].id;
      }
      return null;
    },
    currentAddress: selectedAddress
      ? {
          // Use a real saved address ID when available; otherwise fall back to an internal
          // placeholder so downstream consumers always receive a string.
          id: selectedAddress.addressId || 'context-address',
          user_id: 'current',
          title: null,
          street_address: selectedAddress.label,
          city: selectedAddress.city,
          region: null,
          latitude: selectedAddress.coords?.latitude || 0,
          longitude: selectedAddress.coords?.longitude || 0,
          landmark: selectedAddress.landmark || null,
          formatted_address: selectedAddress.label,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined,
    getShopDetailsFn: async (shopId: string) => {
      const result = await fetchShopDetails(shopId);
      return result.data || null;
    },
    getItemDetailsFn: async (itemId: string, shopId: string) => {
      // Fetch item details using the same method as regular search
      const result = await fetchShopItems(shopId);
      if (result.data) {
        const item = result.data.find((i) => i.id === itemId);
        return item || null;
      }
      return null;
    },
  };

  const showOutOfAreaMessage = (shopName?: string) => {
    const message = shopName
      ? `${shopName} isn't available for that address yet. Please pick another nearby location.`
      : 'Selected address is outside the supported delivery area.';

    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Delivery unavailable', message);
    }
  };

  const determineShopIdsForValidation = (requestedShopId?: string): string[] => {
    if (requestedShopId) {
      return [requestedShopId];
    }

    if (lastCartActionRef.current?.shopIds?.length) {
      return lastCartActionRef.current.shopIds;
    }

    const carts = getAllCarts();
    return carts.map((cart) => cart.shopId);
  };

  const findInvalidShopForAddress = async (
    shopIds: string[],
    coords: { latitude: number; longitude: number }
  ): Promise<string | null> => {
    for (const shopId of shopIds) {
      try {
        const { data, error } = await validateDeliveryAddress(
          shopId,
          coords.latitude,
          coords.longitude
        );

        if (error) {
          console.error('[ConversationalInterface] Error validating delivery address:', error);
          continue;
        }

        if (!data?.isWithinDeliveryZone) {
          return shopId;
        }
      } catch (validationError) {
        console.error('[ConversationalInterface] Exception during delivery validation:', validationError);
      }
    }

    return null;
  };

  const handleSelectAddress = async (address: {
    label: string;
    city: string;
    coords: { latitude: number; longitude: number };
    isCurrent: boolean;
    addressId?: string;
    landmark?: string | null;
  }) => {
    try {
      if (!address?.coords) {
        showOutOfAreaMessage();
        return;
      }

      const shopIdsToValidate = determineShopIdsForValidation(addressChangeContext?.shopId);

      if (shopIdsToValidate.length > 0) {
        const invalidShopId = await findInvalidShopForAddress(shopIdsToValidate, address.coords);

        if (invalidShopId) {
          const cart = getShopCart(invalidShopId);
          showOutOfAreaMessage(cart?.shopName);
          return;
        }
      }

      // Fetch landmark if addressId exists but landmark is missing
      let finalAddress = { ...address };
      if (address.addressId && !address.landmark) {
        try {
          const addresses = await getUserAddresses();
          if (addresses.data) {
            const savedAddress = addresses.data.find(addr => addr.id === address.addressId);
            if (savedAddress?.landmark) {
              finalAddress.landmark = savedAddress.landmark;
            }
          }
        } catch (error) {
          console.error('[ConversationalInterface] Failed to fetch landmark:', error);
        }
      }

      setSelectedAddress(finalAddress);
      setShowAddressSheet(false);
      setAddressChangeContext(null);
      refreshMessages();
    } catch (error) {
      console.error('[ConversationalInterface] Failed to handle address selection:', error);
      Alert.alert('Unable to update address', 'Please try again in a moment.');
    }
  };

  const openAddressSheet = (shopId?: string) => {
    setAddressChangeContext(shopId ? { shopId } : null);
    setShowAddressSheet(true);
  };


  // Check for order completion in messages and set flag
  // Note: OrderConfirmation component also sets this flag when order becomes delivered/cancelled
  useEffect(() => {
    const checkOrderCompletion = async () => {
      // Check function results for delivered/cancelled status
      for (const message of messages) {
        if (message.role === 'function' && message.name === 'placeOrder') {
          const result = message.function_result;
          if (result?.order?.status) {
            const status = result.order.status;
            if (status === 'delivered' || status === 'cancelled') {
              await AsyncStorage.setItem(ORDER_COMPLETED_FLAG_KEY, 'true');
              return;
            }
          }
        }
      }
    };
    
    checkOrderCompletion();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    // Check if we need to reset due to order completion
    const shouldReset = await checkAndResetIfNeeded();
    if (shouldReset) {
      // Conversation was reset, continue with new message
    }

    const userMessage = inputText.trim();
    setInputText('');

    try {
      // Retrieve user preferences for context
      const preferences = await retrievePreferencesBySimilarity(userMessage, {
        limit: 3,
        minConfidence: 0.5,
      });

      let additionalContext = '';
      if (preferences.data && preferences.data.length > 0) {
        additionalContext += formatPreferencesForLLM(preferences.data) + '\n\n';
      }

      // Add location context
      if (selectedAddress) {
        additionalContext += `User location: ${selectedAddress.label}, ${selectedAddress.city}\n`;
      }

      // Send message and handle function calls in a loop
      let maxIterations = 10; // Prevent infinite loops
      let iteration = 0;
      let currentResult = await sendMessage(userMessage, additionalContext || undefined);

      // Handle multiple function calls in sequence (e.g., multiple searches, then add to cart)
      while (currentResult?.functionCall && iteration < maxIterations) {
        iteration++;

        // Execute function call
        try {
          const functionArgs = JSON.parse(currentResult.functionCall.arguments || '{}');
          console.log(`[ConversationalInterface] Executing function: ${currentResult.functionCall.name}`, functionArgs);

          if (CART_MUTATION_FUNCTIONS.has(currentResult.functionCall.name)) {
            const shopIds = extractShopIdsFromArgs(currentResult.functionCall.name, functionArgs);
            if (shopIds.length > 0) {
              lastCartActionRef.current = {
                name: currentResult.functionCall.name,
                args: functionArgs,
                shopIds,
              };
            }
          }

          const functionResult = await executeFunctionCall(
            currentResult.functionCall.name,
            functionArgs,
            functionContext
          );

          console.log(`[ConversationalInterface] Function result:`, functionResult);

          // Add function result to conversation
          // Always pass a valid object - include error if success is false
          const resultToPass = functionResult.success 
            ? functionResult.result 
            : { 
                success: false, 
                error: functionResult.error || 'Unknown error occurred' 
              };
          
          conversationManager.addFunctionResult(currentResult.functionCall.name, resultToPass);

          // Refresh messages to show the function result (even if hidden)
          refreshMessages();

          // Get next LLM response (which might be another function call)
          // Use context's continueConversation to ensure messages are updated
          const nextResult = await continueConversation();

          // Prevent endless loops: if the next result is the same function call with same args, stop.
          if (nextResult?.functionCall &&
            nextResult.functionCall.name === currentResult.functionCall.name &&
            nextResult.functionCall.arguments === currentResult.functionCall.arguments) {
            console.warn('[ConversationalInterface] Detected loop in function calls. Stopping.');
            break;
          }

          currentResult = nextResult;
        } catch (err: any) {
          console.error('[ConversationalInterface] Error executing function:', err);
          if (currentResult?.functionCall) {
            // If error, we still need to tell the LLM about it
            conversationManager.addFunctionResult(currentResult.functionCall.name, { error: err.message });
            refreshMessages();
            currentResult = await continueConversation();
          } else {
            break; // Stop if we can't continue
          }
        }
      }

      if (iteration >= maxIterations) {
        console.warn('[ConversationalInterface] Reached max function call iterations');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
    }
  };

  /**
   * Build a display-optimized version of the messages:
   * - Collapse consecutive intelligentSearch/searchItemsInShop function calls
   *   into a single spinner line (keep only the latest one)
   * - Merge consecutive intelligentSearch/searchItemsInShop function results
   *   into a single combined result so the UI shows one stable banner that
   *   grows as more items/shops are found.
   */
  const displayMessages = useMemo(() => {
    const result: Message[] = [];
    const isSearchFunctionName = (name?: string) =>
      name === 'intelligentSearch' || name === 'searchItemsInShop';

    const mergeShops = (existing: any[] = [], incoming: any[] = []) => {
      const shopMap = new Map<string, any>();

      existing.forEach((shop) => {
        if (shop?.shop?.id) {
          shopMap.set(shop.shop.id, {
            ...shop,
            items: Array.isArray(shop.items) ? [...shop.items] : [],
          });
        }
      });

      incoming.forEach((shop) => {
        const shopId = shop?.shop?.id;
        if (!shopId) return;

        if (!shopMap.has(shopId)) {
          shopMap.set(shopId, {
            ...shop,
            items: Array.isArray(shop.items) ? [...shop.items] : [],
          });
          return;
        }

        const existingShop = shopMap.get(shopId);
        const itemMap = new Map<string, any>();

        existingShop.items.forEach((item: any) => {
          if (item?.id) {
            itemMap.set(item.id, item);
          }
        });

        (Array.isArray(shop.items) ? shop.items : []).forEach((item: any) => {
          if (item?.id && !itemMap.has(item.id)) {
            itemMap.set(item.id, item);
          }
        });

        existingShop.items = Array.from(itemMap.values());
        shopMap.set(shopId, existingShop);
      });

      return Array.from(shopMap.values());
    };

    const parseFunctionResult = (message: Message) => {
      if (message.function_result) return message.function_result;
      if (message.content) {
        try {
          return JSON.parse(message.content);
        } catch {
          return null;
        }
      }
      return null;
    };

    type SearchSession = {
      callMessage: Message;
      callIndex: number;
      resultMessage: Message | null;
      resultIndex: number | null;
      combinedResult: any;
      functionName: string;
    };

    let session: SearchSession | null = null;

    const startSessionWithCall = (message: Message) => {
      session = {
        callMessage: { ...message },
        callIndex: result.length,
        resultMessage: null,
        resultIndex: null,
        combinedResult: { shops: [] },
        functionName: message.function_call?.name || 'intelligentSearch',
      };
      result.push(session.callMessage);
    };

    const ensureSessionResultsMessage = () => {
      if (!session) return;
      if (session.resultMessage) {
        if (session.resultIndex !== null) {
          result[session.resultIndex] = session.resultMessage;
        }
        return;
      }
      session.resultMessage = {
        role: 'function',
        name: session.functionName || 'intelligentSearch',
        content: JSON.stringify(session.combinedResult),
        function_result: session.combinedResult,
        timestamp: Date.now(),
      };
      session.resultIndex = result.length;
      result.push(session.resultMessage);
    };

    const flushSession = () => {
      if (!session) return;
      // Ensure latest references stored in result array
      result[session.callIndex] = session.callMessage;
      if (session.resultMessage && session.resultIndex !== null) {
        result[session.resultIndex] = session.resultMessage;
      }
      session = null;
    };

    for (const message of messages) {
      const isSearchCall =
        message.role === 'assistant' &&
        message.function_call &&
        isSearchFunctionName(message.function_call.name);

      const isSearchResult =
        message.role === 'function' &&
        isSearchFunctionName(message.name);

      if (isSearchCall) {
        if (!session) {
          startSessionWithCall(message);
        } else {
          const ensuredSession = session as SearchSession;
          ensuredSession.functionName = message.function_call?.name || ensuredSession.functionName;
          ensuredSession.callMessage = { ...message };
          result[ensuredSession.callIndex] = ensuredSession.callMessage;
        }
        continue;
      }

      if (isSearchResult) {
        if (!session) {
          // Rare but handle by starting a session so UI stays consistent
          startSessionWithCall({
            role: 'assistant',
            content: '',
            function_call: { name: message.name || 'intelligentSearch', arguments: '{}' },
            timestamp: message.timestamp,
          });
        }

        const parsed = parseFunctionResult(message);
        const shops = parsed?.shops;
        if (Array.isArray(shops)) {
          session!.combinedResult.shops = mergeShops(
            session!.combinedResult.shops || [],
            shops
          );
        }
        session!.combinedResult = {
          ...session!.combinedResult,
          ...parsed,
          shops: session!.combinedResult.shops,
        };

        ensureSessionResultsMessage();
        if (session!.resultMessage) {
          session!.resultMessage.content = JSON.stringify(session!.combinedResult);
          session!.resultMessage.function_result = session!.combinedResult;
          result[session!.resultIndex!] = session!.resultMessage;
        }
        continue;
      }

      // Any other message ends the search session
      flushSession();
      result.push(message);
    }

    flushSession();
    return result;
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeBubble}>
              <Text style={styles.welcomeTitle}>👋 Welcome to your Shopping Assistant</Text>
              <Text style={styles.welcomeText}>
                I can help you find items, add them to your cart, and place orders. Just ask me naturally!
              </Text>
              <View style={styles.suggestionChips}>
                <Text style={styles.suggestionText}>💡 Try: "Find bread near me"</Text>
                <Text style={styles.suggestionText}>🛒 Try: "Add milk to cart"</Text>
                <Text style={styles.suggestionText}>📍 Try: "Show me grocery stores"</Text>
              </View>
            </View>
          </View>
        )}

        {displayMessages
          .filter((msg) => msg.role !== 'system') // Don't show system messages
          .map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              showTechnicalDetails={showTechnicalDetails[index] || false}
              onToggleTechnicalDetails={() => {
                setShowTechnicalDetails(prev => ({
                  ...prev,
                  [index]: !prev[index]
                }));
              }}
              onChangeAddress={openAddressSheet}
              isLoading={isLoading}
            />
          ))}

        {isLoading && (
          <View style={styles.thinkingContainer}>
            <View style={styles.thinkingHeader}>
              <OscillatingDots />
              <Text style={styles.thinkingText}>AI is thinking...</Text>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputText}
          onChangeText={(text) => {
            setInputText(text);
            // Scroll to bottom when user types
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
          placeholder="Type your message or speak..."
          placeholderTextColor="#9ca3af"
          multiline
          editable={!isLoading}
          onSubmitEditing={handleSendMessage}
          onFocus={() => {
            // Scroll to bottom when input is focused
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        />
        <VoiceInputButton onTranscript={setInputText} />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || isLoading}
        >
          <Text style={styles.sendButtonIcon}>↑</Text>
        </TouchableOpacity>
      </View>

      <AddressSelectionBottomSheet
        visible={showAddressSheet}
        onClose={() => {
          setShowAddressSheet(false);
          setAddressChangeContext(null);
        }}
        onSelectAddress={handleSelectAddress}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  welcomeBubble: {
    maxWidth: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  suggestionChips: {
    gap: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thinkingContainer: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 4,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thinkingText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'monospace',
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginRight: 8,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sendButtonIcon: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});

