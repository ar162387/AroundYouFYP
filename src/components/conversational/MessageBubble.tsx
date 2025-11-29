import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Message } from '../../services/ai/conversationManager';
import AISparkleIcon from '../../icons/AISparkleIcon';
import SearchResults from './SearchResults';
import AddedToCartSummary from './AddedToCartSummary';
import OrderConfirmation from './OrderConfirmation';

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
    <View style={styles.oscillatingDots}>
      <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
    </View>
  );
}

interface MessageBubbleProps {
  message: Message;
  showTechnicalDetails?: boolean;
  onToggleTechnicalDetails?: () => void;
  onChangeAddress?: (shopId?: string) => void;
  /**
   * Global loading state for the conversation.
   * Used to stop the function-call spinner once the
   * current function has finished executing.
   */
  isLoading?: boolean;
}

export default function MessageBubble({
  message,
  showTechnicalDetails = false,
  onToggleTechnicalDetails,
  onChangeAddress,
  isLoading = false,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isFunction = message.role === 'function';
  const isSystem = message.role === 'system';

  if (isSystem) return null; // Don't show system messages

  const renderCartModule = (result: any) => {
    if (!result) {
      return null;
    }

    const carts = Array.isArray(result.carts)
      ? result.carts
      : result.cart
      ? [result.cart]
      : [];

    const hasAddedItems = Array.isArray(result.added) && result.added.length > 0;

    console.log('[MessageBubble] renderCartModule:', { 
      hasAddedItems, 
      cartsLength: carts.length,
      addedCount: result.added?.length || 0 
    });

    // Show cart module if we have added items OR if we have carts
    // Always show when items are added, even if carts array is empty initially
    // Also show when getCart/getAllCarts is called
    if (!hasAddedItems && carts.length === 0) {
      console.log('[MessageBubble] Not showing cart module - no items added and no carts');
      return null;
    }

    // Check if this is a placeOrder error related to landmark
    const isLandmarkError = result.error && 
      typeof result.error === 'string' && 
      result.error.toLowerCase().includes('landmark');

    return (
      <AddedToCartSummary
        addedItems={hasAddedItems ? result.added : undefined}
        carts={carts.length > 0 ? carts : undefined}
        deliveryInfos={result.deliveryInfos}
        address={result.address}
        onChangeAddress={onChangeAddress}
        highlightLandmark={isLandmarkError}
      />
    );
  };

  // Parse function result if available
  let functionResult = null;
  if (message.function_result) {
    functionResult = message.function_result;
  } else if (isFunction && message.content) {
    try {
      functionResult = JSON.parse(message.content);
    } catch (e) {
      // Content might not be JSON
    }
  }

  if (isFunction) {
    // If we have a result and it's one of our known functions, render the rich component
    if (functionResult && message.name) {
      if (message.name === 'intelligentSearch' || message.name === 'searchItemsInShop') {
        return <SearchResults results={functionResult} />;
      }
      if (message.name === 'getCart' || message.name === 'getAllCarts') {
        const cartModule = renderCartModule(functionResult);
        if (cartModule) {
          return <View style={styles.cartResultContainer}>{cartModule}</View>;
        }
        // If no cart module but we have carts, still show them
        if (functionResult?.carts && functionResult.carts.length > 0) {
          return <View style={styles.cartResultContainer}>{renderCartModule(functionResult)}</View>;
        }
      }
      if (message.name === 'addItemsToCart' || message.name === 'addItemToCart' || message.name === 'updateItemQuantity' || message.name === 'removeItemFromCart') {
        // Check for both single item result (addItemToCart) and batch result (addItemsToCart)
        // The router now normalizes to batch result structure for addItemsToCart

        const cartModule = renderCartModule(functionResult);
        if (cartModule) {
          return <View style={styles.cartResultContainer}>{cartModule}</View>;
        }
      }
      if (message.name === 'placeOrder') {
        if (functionResult.order) {
          return <OrderConfirmation order={functionResult.order} />;
        }
        // If placeOrder failed, show cart again (especially for landmark errors)
        if (!functionResult.success && (functionResult.cart || functionResult.carts)) {
          const cartModule = renderCartModule(functionResult);
          if (cartModule) {
            return <View style={styles.cartResultContainer}>{cartModule}</View>;
          }
        }
      }
    }

    // For other function results or if parsing failed,
    // we generally don't want to show raw JSON to the user unless debugging.
    if (showTechnicalDetails) {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>Function Result ({message.name}):</Text>
          <Text style={styles.codeText}>{message.content}</Text>
        </View>
      );
    }

    // Hide function results by default if they don't map to a UI component
    return null;
  }

  // Check if message has a function call (Assistant calling a function)
  if (message.function_call) {
    // Try to parse arguments so we can show a more useful description
    let parsedArgs: any = null;
    try {
      parsedArgs = message.function_call.arguments
        ? JSON.parse(message.function_call.arguments)
        : null;
    } catch {
      parsedArgs = null;
    }

    const dynamicDescription = getFunctionCallDescription(
      message.function_call.name,
      parsedArgs
    );

    return (
      <View style={styles.functionCallContainer}>
        <View style={styles.functionCallHeader}>
          {isLoading && <OscillatingDots />}
          <Text style={styles.functionCallText}>
            {dynamicDescription}
          </Text>
        </View>

        {/* Toggle details button - only show when not loading */}
        {!isLoading && (
          <TouchableOpacity onPress={onToggleTechnicalDetails} style={styles.detailsButton}>
            <Text style={styles.detailsButtonText}>
              {showTechnicalDetails ? 'Hide details' : 'View details'}
            </Text>
          </TouchableOpacity>
        )}

        {showTechnicalDetails && !isLoading && (
          <View style={styles.technicalDetails}>
            <Text style={styles.codeText}>
              {JSON.stringify(message.function_call, null, 2)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[
      styles.bubble,
      isUser ? styles.userBubble : styles.assistantBubble
    ]}>
      {isUser ? (
        <Text style={styles.userText}>{message.content}</Text>
      ) : (
        <Markdown
          style={{
            body: { color: '#1f2937', fontSize: 15, lineHeight: 22 },
            paragraph: { marginBottom: 10 },
            link: { color: '#2563eb' },
            strong: { fontWeight: '700', color: '#111827' },
          }}
        >
          {message.content || ''}
        </Markdown>
      )}
    </View>
  );
}

// Helper to get user-friendly description of function calls
function getFunctionCallDescription(name: string, args?: any): string {
  // For search-related calls, show the actual query being searched
  const query =
    args && typeof args === 'object' && typeof args.query === 'string'
      ? args.query
      : null;

  switch (name) {
    case 'intelligentSearch':
    case 'searchItemsInShop':
      return query ? `Searching for "${query}"...` : 'Searching for items...';
    case 'addItemsToCart':
    case 'addItemToCart':
      return 'Adding items to cart...';
    case 'getCart':
      return 'Checking your cart...';
    case 'placeOrder':
      return 'Placing your order...';
    case 'updateItemQuantity':
      return 'Updating cart...';
    case 'removeItemFromCart':
      return 'Removing item...';
    default:
      return 'Processing...';
  }
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  functionCallContainer: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 4,
  },
  functionCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsButton: {
    marginLeft: 28,
    marginTop: 4,
  },
  detailsButtonText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  technicalDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginLeft: 28,
  },
  functionCallLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  functionCallText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  oscillatingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
    marginHorizontal: 2,
  },
  functionCallArgs: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  toggleDetailsButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  toggleDetailsText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  systemMessage: {
    marginVertical: 4,
    marginHorizontal: 16,
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#334155',
    marginTop: 4,
  },
  cartResultContainer: {
    width: '100%',
    marginTop: 4,
  },
});

