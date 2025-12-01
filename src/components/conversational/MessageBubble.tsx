import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
import Markdown from 'react-native-markdown-display';
import type { Message } from '../../services/ai/conversationManager';
import type { SearchProgress } from '../../services/ai/intelligentSearchService';
import AISparkleIcon from '../../icons/AISparkleIcon';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import AddedToCartSummary from './AddedToCartSummary';
import OrderConfirmation from './OrderConfirmation';
import { useCart } from '../../context/CartContext';
import { fetchShopDetails, fetchShopItems } from '../../services/consumer/shopService';

/**
 * Streaming cursor component with blinking animation
 */
function StreamingCursor() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.streamingIndicator, { opacity }]}>
      <View style={styles.cursor} />
    </Animated.View>
  );
}

/**
 * Reusable Function Call Bubble Component
 * Shows a label with optional expandable details
 */
function FunctionCallBubble({
  label,
  isLoading = false,
  hasDetails = false,
  defaultExpanded = false,
  status,
  children,
}: {
  label: string;
  isLoading?: boolean;
  hasDetails?: boolean;
  defaultExpanded?: boolean;
  status?: 'pending' | 'active' | 'completed' | 'error';
  children?: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Status indicator
  const getStatusIndicator = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color="#6b7280" style={{ marginRight: 8 }} />;
    }
    if (status === 'completed') {
      return <Text style={[styles.statusIcon, styles.statusIconSuccess]}>✓</Text>;
    }
    if (status === 'error') {
      return <Text style={[styles.statusIcon, styles.statusIconError]}>✕</Text>;
    }
    return null;
  };

  return (
    <View style={styles.functionCallBubble}>
      <View style={styles.functionCallHeader}>
        {getStatusIndicator()}
        <Text style={styles.functionCallLabel}>{label}</Text>
      </View>
      {hasDetails && (
        <TouchableOpacity
          onPress={() => setIsExpanded(!isExpanded)}
          style={styles.toggleDetailsButton}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleDetailsText}>
            {isExpanded ? 'Hide details' : 'View details'}
          </Text>
        </TouchableOpacity>
      )}
      {isExpanded && hasDetails && children && (
        <View style={styles.functionCallDetails}>
          {children}
        </View>
      )}
    </View>
  );
}

/**
 * Component to handle async fetching of shop and item names for cart items
 */
function CartItemsWithNames({
  functionName,
  items,
  isLoading,
  defaultExpanded,
}: {
  functionName: string;
  items: any[];
  isLoading: boolean;
  defaultExpanded: boolean;
}) {
  const { getShopCart } = useCart();
  const [enrichedItems, setEnrichedItems] = useState<any[]>([]);
  const [isEnriching, setIsEnriching] = useState(true);

  useEffect(() => {
    const enrichItems = async () => {
      setIsEnriching(true);
      const enriched = await Promise.all(
        items.map(async (item: any) => {
          const shopId = item.shopId || item.shop_id;
          const itemId = item.itemId || item.bundleItemId || item.merchant_item_id;

          if (!shopId || !itemId) {
            return {
              ...item,
              shopId: shopId || 'Unknown',
              itemId: itemId || 'Unknown',
              shopName: 'Unknown Shop',
              itemName: 'Unknown Item',
              quantity: item.quantity || 1,
            };
          }

          // Try to get shop name from cart first
          let shopName = shopId;
          const cart = getShopCart(shopId);
          if (cart?.shopName) {
            shopName = cart.shopName;
          } else {
            // Fetch shop name
            try {
              const shopResult = await fetchShopDetails(shopId);
              if (shopResult.data?.name) {
                shopName = shopResult.data.name;
              }
            } catch (error) {
              console.error('Error fetching shop name:', error);
            }
          }

          // Try to get item name from cart first
          let itemName = itemId;
          if (cart) {
            const cartItem = cart.items.find(i => i.id === itemId);
            if (cartItem?.name) {
              itemName = cartItem.name;
            }
          }

          // If not in cart, fetch item name
          if (itemName === itemId) {
            try {
              const itemsResult = await fetchShopItems(shopId);
              if (itemsResult.data) {
                const foundItem = itemsResult.data.find(i => i.id === itemId);
                if (foundItem?.name) {
                  itemName = foundItem.name;
                }
              }
            } catch (error) {
              console.error('Error fetching item name:', error);
            }
          }

          return {
            ...item,
            shopId,
            itemId,
            shopName,
            itemName,
            quantity: item.quantity || 1,
          };
        })
      );

      setEnrichedItems(enriched);
      setIsEnriching(false);
    };

    if (items.length > 0) {
      enrichItems();
    } else {
      setIsEnriching(false);
    }
  }, [items, getShopCart]);

  const dynamicDescription = getFunctionCallDescription(functionName, { items });

  return (
    <View style={styles.functionCallContainer}>
      <Text style={styles.functionCallLabel}>{dynamicDescription}</Text>
      {enrichedItems.length > 0 && (
        <View style={styles.technicalDetails}>
          {enrichedItems.map((item: any, idx: number) => (
            <Text key={idx} style={styles.functionCallText}>
              {item.shopName}: {item.itemName} (Qty: {item.quantity || 1})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

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
  isLoading?: boolean;
  isStreaming?: boolean;
  isLastSearchResult?: boolean;
  progress?: SearchProgress | null;
}

// Track expanded state for each step bubble (using component-level state)
// We'll use a ref to store the state map per component instance

export default function MessageBubble({
  message,
  showTechnicalDetails = false,
  onToggleTechnicalDetails,
  onChangeAddress,
  isLoading = false,
  isStreaming = false,
  isLastSearchResult = true,
  progress,
}: MessageBubbleProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  /**
   * Persist the latest non-null search progress per-message so that
   * "View details" remains available even after the global
   * search progress is cleared at the end of execution.
   */
  const [persistedProgress, setPersistedProgress] = useState<SearchProgress | null>(null);

  useEffect(() => {
    if (progress) {
      setPersistedProgress(progress);
    }
  }, [progress]);

  const effectiveProgress = progress || persistedProgress;

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
        // Format shops with relevance scores and top items
        const shops = functionResult.shops || [];
        const shopsInfo = shops.map((shopResult: any) => {
          const shop = shopResult.shop || {};
          const items = shopResult.items || [];
          const relevanceScore = shopResult.relevanceScore || 0;
          // Handle both decimal (0-1) and percentage (0-100) formats
          const relevance = relevanceScore > 1
            ? Math.round(relevanceScore * 10) / 10  // Already a percentage
            : Math.round(relevanceScore * 100 * 10) / 10; // Convert decimal to percentage

          // Get top items sorted by similarity
          const topItems = items
            .sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0))
            .slice(0, 5) // Show top 5 in details
            .map((item: any) => ({
              name: item.name || item.item_name,
              // similarity is 0-1, convert to percentage
              confidence: Math.round((item.similarity || 0) * 100),
              price: item.price_cents ? `PKR ${(item.price_cents / 100).toFixed(2)}` : 'N/A',
            }));

          return {
            shopId: shop.id,
            shopName: shop.name,
            relevance,
            topItems,
            totalItems: items.length,
          };
        });

        // Render each shop as a separate bubble
        return (
          <View style={styles.functionResultContainer}>
            {shopsInfo.map((shop: any, idx: number) => {
              const label = `${shop.shopName} - ${shop.relevance}% relevance (${shop.totalItems} items)`;
              const hasDetails = shop.topItems && shop.topItems.length > 0;

              return (
                <FunctionCallBubble
                  key={shop.shopId || idx}
                  label={label}
                  hasDetails={hasDetails}
                  defaultExpanded={false}
                >
                  {hasDetails && (
                    <View>
                      <TouchableOpacity
                        onPress={() => navigation.navigate('Shop', { shopId: shop.shopId })}
                        style={styles.shopLinkButton}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.shopLinkText}>Visit shop →</Text>
                      </TouchableOpacity>
                      <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>Top Items:</Text>
                      {shop.topItems.map((item: any, itemIdx: number) => (
                        <View key={itemIdx} style={styles.shopItemRow}>
                          <Text style={styles.shopItemName} numberOfLines={2}>{item.name}</Text>
                          <View style={styles.shopItemMeta}>
                            <Text style={styles.shopItemConfidence}>{item.confidence}%</Text>
                            <Text style={styles.shopItemPrice}>{item.price}</Text>
                          </View>
                        </View>
                      ))}
                      {shop.totalItems > shop.topItems.length && (
                        <Text style={styles.detailText}>
                          ... and {shop.totalItems - shop.topItems.length} more items
                        </Text>
                      )}
                    </View>
                  )}
                </FunctionCallBubble>
              );
            })}
          </View>
        );
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

    // For other function results, show them in a simple format
    const functionName = message.name || 'function';
    const resultLabel = `Result: ${functionName}`;

    // For cart function results, format to show shop names and item names
    let formattedResult = functionResult || message.content;
    if (functionResult && (
      message.name === 'addItemsToCart' ||
      message.name === 'addItemToCart' ||
      message.name === 'updateItemQuantity' ||
      message.name === 'removeItemFromCart'
    )) {
      // Extract cart information with shop and item names from result
      const added = functionResult.added || [];

      // Use CartItemsWithNames component to handle async name fetching if needed
      // Otherwise use the names from the result if available
      const items = added.map((item: any) => ({
        shopId: item.shopId,
        itemId: item.id || item.itemId,
        shopName: item.shopName || 'Unknown Shop',
        itemName: item.name || 'Unknown Item',
        quantity: item.quantity || 1,
      }));

      formattedResult = {
        function: message.name,
        items,
      };
    }

    return (
      <View style={styles.functionResultContainer}>
        <Text style={styles.functionCallLabel}>
          {resultLabel}
          {functionResult?.error && ' (Error)'}
        </Text>
        {showTechnicalDetails && formattedResult && (
          <View style={styles.technicalDetails}>
            <Text style={styles.functionCallText}>
              {typeof formattedResult === 'string' 
                ? formattedResult 
                : JSON.stringify(formattedResult, null, 2)}
            </Text>
          </View>
        )}
      </View>
    );
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

    // Handle intelligent search with progress steps - render separate bubbles for each step
    // Check if this is an intelligent search call (either with progress or with completed result)
    const isIntelligentSearch = message.function_call.name === 'intelligentSearch' || message.function_call.name === 'searchItemsInShop';
    
    if (isIntelligentSearch) {
      // If we have progress, use it. Otherwise, if we have a function result, create a completed progress state
      let stepsToShow: any[] = [];
      
      if (effectiveProgress) {
        // Use live progress if available
        stepsToShow = effectiveProgress.steps;
      } else {
        // If progress is cleared but we have a function result, create a completed state
        // This ensures UI consistency - steps remain visible after completion
        const defaultSteps: Array<{
          id: string;
          label: string;
          status: 'pending' | 'active' | 'completed' | 'error';
          details?: any;
        }> = [
          { id: 'understand_intent', label: 'Thinking...', status: 'completed' },
          { id: 'find_shops', label: 'Finding nearby shops', status: 'completed' },
          { id: 'semantic_search', label: 'Searching for items', status: 'completed' },
          { id: 'expanding_search', label: 'Expanding search...', status: 'completed' },
          { id: 'ranking', label: 'Ranking results', status: 'completed' },
        ];
        
        // Preserve details from function result - ensure all steps that should have details get them
        if (message.function_result) {
          const result = message.function_result;
          const items = result.intent?.extractedItems || [];
          const shops = result.results || result.shops || [];
          
          // Always set details for understand_intent if we have intent data
          const thinkingStep = defaultSteps.find(s => s.id === 'understand_intent');
          if (thinkingStep) {
            thinkingStep.details = {
              reasoning: result.intent?.reasoning || result.reasoning || 'Intent analysis completed',
              extracted: items.length > 0 
                ? items.map((i: any) => `${i.name} (Qty: ${i.quantity || 1})`).join(', ')
                : 'Items extracted from query',
            };
          }
          
          // Always set details for find_shops
          const findShopsStep = defaultSteps.find(s => s.id === 'find_shops');
          if (findShopsStep) {
            findShopsStep.details = {
              found: shops.length > 0 
                ? `${shops.length} shop${shops.length !== 1 ? 's' : ''} in area`
                : 'Shops found in delivery area',
              shops: shops.length > 0 ? shops.map((shop: any) => ({
                id: shop.shop?.id || shop.id,
                name: shop.shop?.name || shop.name,
              })) : [],
            };
          }
          
          // Always set details for semantic_search
          const semanticStep = defaultSteps.find(s => s.id === 'semantic_search');
          if (semanticStep) {
            if (items.length > 0) {
              semanticStep.label = `Searching for ${items.map((i: any) => `"${i.name}"`).join(', ')}...`;
            }
            semanticStep.details = {
              primaryQuery: result.intent?.primaryQuery || 'Search query processed',
              expandedQueries: result.intent?.expandedQueries || [],
              extractedItems: items,
            };
          }
          
          // Always set details for expanding_search
          const expandingStep = defaultSteps.find(s => s.id === 'expanding_search');
          if (expandingStep) {
            const allItems: any[] = [];
            shops.forEach((shopResult: any) => {
              const shopItems = shopResult.items || shopResult.matchingItems || [];
              shopItems.forEach((item: any) => {
                allItems.push({
                  name: item.name || item.item_name,
                  price: item.price_cents ? `PKR ${(item.price_cents / 100).toFixed(2)}` : 'N/A',
                  shop: shopResult.shop?.name || shopResult.name || 'Unknown Shop',
                  similarity: item.similarity ? Math.round(item.similarity * 100) : null,
                });
              });
            });
            
            expandingStep.details = {
              totalFound: allItems.length,
              results: allItems.sort((a, b) => (b.similarity || 0) - (a.similarity || 0)).slice(0, 20),
    };
          }
          
          // Always set details for ranking
          const rankingStep = defaultSteps.find(s => s.id === 'ranking');
          if (rankingStep) {
            rankingStep.details = {
              shops: shops.map((shopResult: any) => ({
                name: shopResult.shop?.name || shopResult.name,
                shopName: shopResult.shop?.name || shopResult.name,
                id: shopResult.shop?.id || shopResult.id,
                relevance: shopResult.relevanceScore 
                  ? (shopResult.relevanceScore > 1 
                      ? Math.round(shopResult.relevanceScore * 10) / 10 
                      : Math.round(shopResult.relevanceScore * 100 * 10) / 10)
                  : null,
                relevanceScore: shopResult.relevanceScore,
              })),
            };
          }
        }
        
        stepsToShow = defaultSteps;
      }

      return (
        <View style={styles.functionCallContainer}>
          {stepsToShow.map((step, index) => {
            // Only show bubbles when step is completed (no loading state)
            // Bubbles appear only after completion as per user request
            if (step.status !== 'completed' && step.status !== 'error') {
              return null;
            }
            
            // No loading indicator - bubbles appear only after completion
            const isStepLoading = false;
            
            // Check if step has meaningful details - if details exist, show "View details"
            const hasDetails = step.details && Object.keys(step.details).length > 0;

            // Render details based on step type
            let detailsContent = null;
            if (hasDetails && step.details) {
              if (step.id === 'understand_intent') {
                // Thinking step - show LLM reasoning (matching debug logs)
                detailsContent = (
                  <View>
                    {step.details.reasoning && (
                      <>
                        <Text style={styles.detailSectionLabel}>💭 LLM REASONING:</Text>
                        <Text style={styles.detailText}>{step.details.reasoning}</Text>
                      </>
                    )}
                    {step.details.extracted && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>📊 EXTRACTED ITEMS:</Text>
                        <Text style={styles.detailText}>{step.details.extracted}</Text>
                      </>
                    )}
                    {step.details.extractedItems && Array.isArray(step.details.extractedItems) && step.details.extractedItems.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>Extracted Items ({step.details.extractedItems.length}):</Text>
                        {step.details.extractedItems.map((item: any, idx: number) => (
                          <Text key={idx} style={styles.detailText}>
                            {idx + 1}. {item.name}
                            {item.brand && ` (${item.brand})`}
                            {item.category && ` - Category: ${item.category}`}
                            {item.quantity && item.quantity > 1 && ` × ${item.quantity}`}
                            {item.searchTerms && item.searchTerms.length > 0 && (
                              <Text style={styles.detailSubText}>
                                {'\n   '}Search terms: {item.searchTerms.join(', ')}
                              </Text>
                            )}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>
                );
              } else if (step.id === 'find_shops') {
                // Finding shops step - show found shops info (matching debug logs)
                detailsContent = (
                  <View>
                    {step.details.found && (
                      <>
                        <Text style={styles.detailSectionLabel}>📍 Found:</Text>
                        <Text style={styles.detailText}>{step.details.found}</Text>
                      </>
                    )}
                    {step.details.shops && Array.isArray(step.details.shops) && step.details.shops.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>🏪 Shops ({step.details.shops.length}):</Text>
                        {step.details.shops.map((shop: any, idx: number) => (
                          <Text key={idx} style={styles.detailText}>
                            {idx + 1}. {shop.name || shop.id}
                            {shop.id && shop.id.length > 8 && (
                              <Text style={styles.detailSubText}> ({shop.id.substring(0, 8)}...)</Text>
                            )}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>
                );
              } else if (step.id === 'semantic_search') {
                // Searching step - show primary query and expanded queries (matching debug logs)
                detailsContent = (
                  <View>
                    {step.details.primaryQuery && (
                      <>
                        <Text style={styles.detailSectionLabel}>📝 Primary Query:</Text>
                        <Text style={styles.detailText}>"{step.details.primaryQuery}"</Text>
                      </>
                    )}
                    {step.details.expandedQueries && step.details.expandedQueries.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>🔍 Expanded Queries ({step.details.expandedQueries.length}):</Text>
                        <Text style={styles.detailText}>
                          {step.details.expandedQueries.map((q: string, idx: number) => `"${q}"`).join(', ')}
                        </Text>
                      </>
                    )}
                    {step.details.extractedItems && step.details.extractedItems.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>📊 Extracted Items ({step.details.extractedItems.length}):</Text>
                        {step.details.extractedItems.map((item: any, idx: number) => (
                          <Text key={idx} style={styles.detailText}>
                            {idx + 1}. {item.name}
                            {item.brand && ` (${item.brand})`}
                            {item.category && ` - Category: ${item.category}`}
                            {item.quantity && item.quantity > 1 && ` × ${item.quantity}`}
                            {item.searchTerms && item.searchTerms.length > 0 && (
                              <Text style={styles.detailSubText}>
                                {'\n   '}Search terms: {item.searchTerms.join(', ')}
                              </Text>
                            )}
                          </Text>
                        ))}
                      </>
                    )}
                  </View>
                );
              } else if (step.id === 'expanding_search') {
                // Expanding search step - show unified results (matching debug logs)
                detailsContent = (
                  <View>
                    {step.details.results && step.details.results.length > 0 && (
                      <>
                        <Text style={styles.detailSectionLabel}>
                          ✅ Found {step.details.totalFound || step.details.results.length} unique items:
                        </Text>
                        {step.details.results.slice(0, 10).map((item: any, idx: number) => (
                          <View key={idx} style={styles.resultItemRow}>
                            <Text style={styles.resultItemName} numberOfLines={2}>{item.name}</Text>
                            <View style={styles.resultItemMeta}>
                              {item.similarity && (
                                <Text style={styles.resultItemSimilarity}>{item.similarity}%</Text>
                              )}
                              <Text style={styles.resultItemPrice}>{item.price}</Text>
                              <Text style={styles.resultItemShop}>• {item.shop}</Text>
                            </View>
                          </View>
                        ))}
                        {step.details.results.length > 10 && (
                          <Text style={styles.detailText}>... and {step.details.results.length - 10} more items</Text>
                        )}
                      </>
                    )}
                    {(!step.details.results || step.details.results.length === 0) && step.details.totalFound === 0 && (
                      <Text style={styles.detailText}>No items found in this step</Text>
                    )}
                  </View>
                );
              } else if (step.id === 'ranking') {
                // Ranking step - show ranking details (matching debug logs)
                detailsContent = (
                  <View>
                    {step.details.shops && Array.isArray(step.details.shops) && step.details.shops.length > 0 && (
                      <>
                        <Text style={styles.detailSectionLabel}>🎯 Ranked Shops ({step.details.shops.length}):</Text>
                        {step.details.shops.map((shop: any, idx: number) => {
                          const relevance = shop.relevance || shop.relevanceScore;
                          const relevancePercent = relevance 
                            ? (relevance > 1 ? Math.round(relevance * 10) / 10 : Math.round(relevance * 100 * 10) / 10)
                            : 'N/A';
                          return (
                            <View key={idx} style={{ marginBottom: 12 }}>
                              <Text style={styles.detailText}>
                                {idx + 1}. {shop.name || shop.shopName || shop.id} - Relevance: {relevancePercent}%
                              </Text>
                              {shop.matchingItems !== undefined && (
                                <Text style={styles.detailSubText}>
                                  {'   '}Matching Items: {shop.matchingItems}
                                </Text>
                              )}
                              {shop.topItems && Array.isArray(shop.topItems) && shop.topItems.length > 0 && (
                                <>
                                  <Text style={[styles.detailSubText, { marginTop: 4 }]}>
                                    {'   '}Top Items:
                                  </Text>
                                  {shop.topItems.map((item: any, itemIdx: number) => {
                                    const pricePKR = item.price_cents 
                                      ? `PKR ${(item.price_cents / 100).toFixed(2)}` 
                                      : '';
                                    const similarityPercent = item.similarity 
                                      ? `${(item.similarity * 100).toFixed(1)}%` 
                                      : '';
                                    return (
                                      <Text key={itemIdx} style={styles.detailSubText}>
                                        {'     '}{itemIdx + 1}. {item.name || item.item_name}
                                        {pricePKR && ` - ${pricePKR}`}
                                        {similarityPercent && ` (${similarityPercent} match)`}
                                      </Text>
                                    );
                                  })}
                                </>
                              )}
                            </View>
                          );
                        })}
                      </>
                    )}
                    {step.details.items && Array.isArray(step.details.items) && step.details.items.length > 0 && (
                      <>
                        <Text style={[styles.detailSectionLabel, { marginTop: 12 }]}>Top Items:</Text>
                        {step.details.items.slice(0, 10).map((item: any, idx: number) => {
                          const similarityPercent = item.similarity 
                            ? `${Math.round(item.similarity * 100)}%` 
                            : '';
                          const pricePKR = item.price_cents 
                            ? `PKR ${(item.price_cents / 100).toFixed(2)}` 
                            : '';
                          return (
                            <Text key={idx} style={styles.detailText}>
                              {idx + 1}. {item.name || item.item_name}
                              {pricePKR && ` - ${pricePKR}`}
                              {similarityPercent && ` (${similarityPercent} match)`}
                            </Text>
                          );
                        })}
                        {step.details.items.length > 10 && (
                          <Text style={styles.detailText}>... and {step.details.items.length - 10} more items</Text>
                        )}
                      </>
                    )}
                    {!step.details.shops && !step.details.items && (
                      <Text style={styles.detailText}>
                        {JSON.stringify(step.details, null, 2)}
                      </Text>
                    )}
                  </View>
                );
              } else {
                // Generic fallback for any other step types
                detailsContent = (
                  <View>
                    <Text style={styles.detailText}>
                      {typeof step.details === 'string' 
                        ? step.details 
                        : JSON.stringify(step.details, null, 2)}
                    </Text>
                  </View>
                );
              }
            }

            return (
              <FunctionCallBubble
                key={step.id}
                label={step.label}
                isLoading={isStepLoading}
                hasDetails={hasDetails}
                defaultExpanded={false}
                status={step.status}
              >
                {detailsContent}
              </FunctionCallBubble>
            );
          })}
        </View>
      );
    }

    // Format cart function arguments to be more readable
    if (parsedArgs && (
      message.function_call.name === 'addItemsToCart' ||
      message.function_call.name === 'addItemToCart' ||
      message.function_call.name === 'updateItemQuantity' ||
      message.function_call.name === 'removeItemFromCart'
    )) {
      const items = parsedArgs.items || (parsedArgs.itemId ? [parsedArgs] : []);
      // Use CartItemsWithNames component to handle async name fetching
      return (
        <View style={styles.functionCallContainer}>
          <CartItemsWithNames
            functionName={message.function_call.name}
            items={items}
            isLoading={isLoading}
            defaultExpanded={showTechnicalDetails}
          />
        </View>
      );
    }

    // For other function calls, show simple bubble
    const dynamicDescription = getFunctionCallDescription(
      message.function_call.name,
      parsedArgs
    );

    const formattedDetails: any = {
      function: message.function_call.name,
      arguments: parsedArgs || {},
    };

    const hasDetails = formattedDetails && Object.keys(formattedDetails).length > 0;

    return (
      <View style={styles.functionCallContainer}>
        <FunctionCallBubble
          label={dynamicDescription}
          isLoading={isLoading}
          hasDetails={hasDetails}
          defaultExpanded={showTechnicalDetails || false}
        >
          {formattedDetails && (
            <Text style={styles.functionCallText}>
              {typeof formattedDetails === 'string' 
                ? formattedDetails 
                : JSON.stringify(formattedDetails, null, 2)}
            </Text>
          )}
        </FunctionCallBubble>
      </View>
    );
  }

  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bubbleOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.bubble,
      isUser ? styles.userBubble : styles.assistantBubble,
      { opacity: bubbleOpacity }
    ]}>
      {isUser ? (
        <Text style={styles.userText}>{message.content}</Text>
      ) : (
        <View style={styles.assistantContent}>
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
          {isStreaming && <StreamingCursor />}
        </View>
      )}
    </Animated.View>
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
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    width: '100%',
  },
  functionResultContainer: {
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 4,
    width: '100%',
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
  functionCallBubble: {
    marginBottom: 8,
  },
  functionCallLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  statusIcon: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  statusIconSuccess: {
    color: '#10b981',
  },
  statusIconError: {
    color: '#ef4444',
  },
  functionCallDetails: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  functionCallText: {
    fontSize: 11,
    color: '#4b5563',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  detailText: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: 'monospace',
    lineHeight: 16,
    marginBottom: 4,
  },
  detailSubText: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
  resultItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultItemName: {
    fontSize: 11,
    color: '#4b5563',
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 8,
  },
  resultItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  resultItemSimilarity: {
    fontSize: 10,
    color: '#10b981',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  resultItemPrice: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  resultItemShop: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  shopLinkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  shopLinkText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  shopItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  shopItemName: {
    fontSize: 11,
    color: '#4b5563',
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 12,
  },
  shopItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  shopItemConfidence: {
    fontSize: 10,
    color: '#10b981',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  shopItemPrice: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
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
  assistantContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  streamingIndicator: {
    marginLeft: 4,
    marginBottom: 2,
    alignSelf: 'flex-end',
  },
  cursor: {
    width: 2,
    height: 18,
    backgroundColor: '#2563eb',
    borderRadius: 1,
  },
  shopResultItem: {
    padding: 8,
    marginTop: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  shopResultName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  shopResultItems: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});

