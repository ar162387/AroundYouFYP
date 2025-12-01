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
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversation } from '../../context/ConversationContext';
import { useCart } from '../../context/CartContext';
import { useLocationSelection } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { executeFunctionCall, type FunctionExecutionContext } from '../../services/ai/functionRouter';
import AuthModal from './AuthModal';
import { retrievePreferencesBySimilarity, formatPreferencesForLLM } from '../../services/ai/memoryRetrievalService';
import type { SearchProgress } from '../../services/ai/intelligentSearchService';
import MessageBubble from './MessageBubble';
import type { ShopItem } from '../../services/consumer/shopService';
import { fetchShopDetails, fetchShopItems, validateDeliveryAddress } from '../../services/consumer/shopService';
import { getUserAddresses } from '../../services/consumer/addressService';
import AddressSelectionBottomSheet from '../consumer/AddressSelectionBottomSheet';
import type { Message } from '../../services/ai/conversationManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';

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
  const { addItemToCart, addItemToCartWithQuantity, removeItemFromCart, updateItemQuantity, getShopCart, getAllCarts, deleteShopCart } = useCart();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [inputText, setInputText] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<Record<number, boolean>>({});
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [addressChangeContext, setAddressChangeContext] = useState<{ shopId?: string } | null>(null);
  const lastCartActionRef = useRef<{ name: string; args: Record<string, any>; shopIds: string[] } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPlaceOrder, setPendingPlaceOrder] = useState<{
    functionName: string;
    functionArgs: Record<string, any>;
  } | null>(null);
  const retryingPlaceOrderRef = useRef(false);

  // Scroll to bottom when new messages arrive or content updates (for streaming)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, messages]); // Also depend on messages content for streaming updates

  // Internal function to send a message (used by both handleSendMessage and handleSuggestionClick)
  const sendMessageInternal = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    // Check if we need to reset due to order completion
    const shouldReset = await checkAndResetIfNeeded();
    if (shouldReset) {
      // Conversation was reset, continue with new message
    }

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

      // Use streaming for better UX (only for non-function-call responses)
      // Streaming callback to update UI in real-time
      const onStreamChunk = (chunk: string) => {
        // Messages are updated in real-time by the conversation manager
        refreshMessages();
      };

      // Send message with streaming support
      let maxIterations = 10;
      let iteration = 0;
      let currentResult = await sendMessage(userMessage, additionalContext || undefined, onStreamChunk);

      // Handle multiple function calls in sequence
      while (currentResult?.functionCall && iteration < maxIterations) {
        iteration++;

        try {
          const functionArgs = JSON.parse(currentResult.functionCall.arguments || '{}');
          console.log(`[ConversationalInterface] Executing function: ${currentResult.functionCall.name}`, functionArgs);

          // Check authentication for placeOrder
          if (currentResult.functionCall.name === 'placeOrder' && !user) {
            // Store pending placeOrder call
            setPendingPlaceOrder({
              functionName: currentResult.functionCall.name,
              functionArgs,
            });
            setShowAuthModal(true);
            // Wait for authentication - the auth modal will trigger retry via useEffect
            break;
          }

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

          const resultToPass = functionResult.success
            ? functionResult.result
            : {
              success: false,
              error: functionResult.error || 'Unknown error occurred'
            };

          conversationManager.addFunctionResult(currentResult.functionCall.name, resultToPass);
          refreshMessages();

          const nextResult = await continueConversation();

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
            conversationManager.addFunctionResult(currentResult.functionCall.name, { error: err.message });
            refreshMessages();
            currentResult = await continueConversation();
          } else {
            break;
          }
        }
      }

      // Clear progress when done (but only after a delay to ensure UI updates)
      setTimeout(() => {
      setSearchProgress(null);
      }, 500);

      if (iteration >= maxIterations) {
        console.warn('[ConversationalInterface] Reached max function call iterations');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
    }
  };

  // Handle suggestion click - send message and switch to messages view
  const handleSuggestionClick = async (suggestionText: string) => {
    // Extract the message from suggestion text (e.g., "💡 Try: "Find bread near me"" -> "Find bread near me")
    const match = suggestionText.match(/Try:\s*"([^"]+)"/);
    const message = match ? match[1] : suggestionText.replace(/^[^\s]+\s+Try:\s*"/, '').replace(/"$/, '');

    if (message && message.trim()) {
      await sendMessageInternal(message.trim());
    }
  };

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
    addItemToCartWithQuantityFn: addItemToCartWithQuantity,
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
    onProgress: (progress: SearchProgress) => {
      console.log('[ConversationalInterface] Progress update:', progress);
      setSearchProgress(progress);
    },
  };

  // Retry placeOrder after authentication (moved here so functionContext is available)
  useEffect(() => {
    if (user && pendingPlaceOrder && !showAuthModal && !retryingPlaceOrderRef.current) {
      // User is now authenticated, retry the placeOrder
      retryingPlaceOrderRef.current = true;
      const retryPlaceOrder = async () => {
        try {
          const functionResult = await executeFunctionCall(
            pendingPlaceOrder.functionName,
            pendingPlaceOrder.functionArgs,
            functionContext
          );

          const resultToPass = functionResult.success
            ? functionResult.result
            : {
                success: false,
                error: functionResult.error || 'Unknown error occurred',
              };

          conversationManager.addFunctionResult(pendingPlaceOrder.functionName, resultToPass);
          refreshMessages();

          // Continue conversation after function result
          await continueConversation();
        } catch (err: any) {
          console.error('[ConversationalInterface] Error retrying placeOrder:', err);
          conversationManager.addFunctionResult(pendingPlaceOrder.functionName, {
            error: err.message,
          });
          refreshMessages();
        } finally {
          setPendingPlaceOrder(null);
          retryingPlaceOrderRef.current = false;
        }
      };

      retryPlaceOrder();
    }
  }, [user, pendingPlaceOrder, showAuthModal, functionContext, conversationManager, refreshMessages, continueConversation]);

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
    const userMessage = inputText.trim();
    if (!userMessage || isLoading) return;

    setInputText('');
    await sendMessageInternal(userMessage);
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

    // Track search calls and their results separately to stack them
    const searchCallMap = new Map<number, { call: Message; result?: Message }>();
    let searchCallIndex = 0;

    for (const message of messages) {
      const isSearchCall =
        message.role === 'assistant' &&
        message.function_call &&
        isSearchFunctionName(message.function_call.name);

      const isSearchResult =
        message.role === 'function' &&
        isSearchFunctionName(message.name);

      if (isSearchCall) {
        // Flush any existing session
        flushSession();
        // Add search call directly to result (stack them, don't merge)
        result.push(message);
        // Track it for result matching
        searchCallMap.set(searchCallIndex, { call: message });
        searchCallIndex++;
        continue;
      }

      if (isSearchResult) {
        // Find the most recent search call without a result
        let assigned = false;
        for (let i = searchCallIndex - 1; i >= 0; i--) {
          const entry = searchCallMap.get(i);
          if (entry && !entry.result) {
            entry.result = message;
            // Add result right after the call in result array
            const callIndex = result.findIndex(m => m === entry.call);
            if (callIndex >= 0) {
              result.splice(callIndex + 1, 0, message);
            } else {
              result.push(message);
            }
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          // No matching call found, just add the result
          result.push(message);
        }
        continue;
      }

      // Any other message ends the search session
      flushSession();
      result.push(message);
    }

    // Results are already added in the loop above, so nothing to do here

    flushSession();
    return result;
  }, [messages]);

  // Track if we should show welcome view (show when no messages, hide once user interacts)
  const visibleMessages = displayMessages.filter((msg) => msg.role !== 'system');
  const shouldShowWelcome = messages.length === 0 && visibleMessages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {shouldShowWelcome ? (
        // Welcome View - shown when no messages
        <View style={styles.welcomeViewContainer}>
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeBubble}>
              <Text style={styles.welcomeTitle}>👋 Welcome to your Shopping Assistant</Text>
              <Text style={styles.welcomeText}>
                I can help you find items, add them to your cart, and place orders. Just ask me naturally!
              </Text>
              <View style={styles.suggestionChips}>
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionClick('💡 Try: "Find bread near me"')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>💡 Try: "Find bread near me"</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionClick('🛒 Try: "Add milk to cart"')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>🛒 Try: "Add milk to cart"</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionClick('📍 Try: "Show me grocery stores"')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>📍 Try: "Show me grocery stores"</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : (
        // Messages View - shown when there are messages
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {displayMessages
            .filter((msg) => msg.role !== 'system') // Don't show system messages
            .map((message, index) => {
              // Check if this is the last assistant message and we're currently streaming
              const isLastAssistantMessage =
                message.role === 'assistant' &&
                !message.function_call &&
                index === displayMessages.filter(m => m.role !== 'system').length - 1;
              const isStreaming = isLoading && isLastAssistantMessage && !message.function_call;

              // Check if this is a search result and if it's the last one
              const isSearchResult = message.role === 'function' &&
                (message.name === 'intelligentSearch' || message.name === 'searchItemsInShop');

              // Find the last search result index
              let lastSearchResultIndex = -1;
              for (let i = displayMessages.length - 1; i >= 0; i--) {
                const msg = displayMessages[i];
                if (msg.role === 'function' &&
                  (msg.name === 'intelligentSearch' || msg.name === 'searchItemsInShop')) {
                  lastSearchResultIndex = i;
                  break;
                }
              }

              const isLastSearchResult = isSearchResult
                ? index === lastSearchResultIndex
                : true; // Default to true for non-search results

              const isLastMessage = index === displayMessages.length - 1;
              // Show progress on function call messages for intelligentSearch/searchItemsInShop
              const isIntelligentSearchCall = message.function_call && 
                (message.function_call.name === 'intelligentSearch' || message.function_call.name === 'searchItemsInShop');
              // Show progress if:
              // 1. It's an intelligent search call AND we have progress (even if not loading anymore)
              // 2. OR it's the last message AND we're loading AND have progress
              const showProgress = (isIntelligentSearchCall && searchProgress) || (isLastMessage && isLoading && searchProgress);
              // Keep loading state for intelligent search calls while we have progress
              const isIntelligentSearchLoading = isIntelligentSearchCall && (isLoading || (searchProgress ? searchProgress.currentStepId !== null : false));

              return (
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
                  isLoading={isIntelligentSearchLoading}
                  isStreaming={isStreaming}
                  isLastSearchResult={isLastSearchResult}
                  progress={showProgress ? searchProgress : undefined}
                />
              );
            })}

          {/* 
            Standalone "Thinking" card removed as progress is now integrated into the active message bubble.
            We only show a generic loader if there are NO messages yet (unlikely) or if loading but no progress state.
           */}
          {isLoading && !searchProgress && displayMessages.length === 0 && (
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
      )}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={inputText}
          onChangeText={(text) => {
            setInputText(text);
            // When user starts typing, ensure we're in messages view
            if (shouldShowWelcome && text.length > 0) {
              // This will trigger re-render and switch to messages view
            }
            // Scroll to bottom when user types
            if (!shouldShowWelcome) {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
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

      <AuthModal
        visible={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingPlaceOrder(null);
        }}
        onSuccess={() => {
          setShowAuthModal(false);
          // The useEffect will handle retrying placeOrder
        }}
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
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  welcomeViewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  welcomeContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeBubble: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
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
    marginTop: 8,
    width: '100%',
  },
  suggestionChip: {
    marginBottom: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 14,
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
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
    backgroundColor: '#ffffff',
    marginRight: 8,
    lineHeight: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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

