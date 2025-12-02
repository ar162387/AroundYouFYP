/**
 * Conversation Context
 * 
 * React Context for managing conversational shopping interface state.
 * Provides conversation manager instance and message history.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConversationManager, type Message, type ConversationOptions } from '../services/ai/conversationManager';
import { FUNCTION_SCHEMAS } from '../services/ai/functionSchemas';

const CONVERSATION_STORAGE_KEY = 'aroundyou_conversation';
const ORDER_COMPLETED_FLAG_KEY = 'aroundyou_order_completed';

interface ConversationContextType {
  conversationManager: ConversationManager;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string, additionalContext?: string, onStreamChunk?: (chunk: string) => void) => Promise<{ response: string | null; functionCall?: { name: string; arguments: string }; error: string | null } | undefined>;
  continueConversation: () => Promise<{ response: string | null; functionCall?: { name: string; arguments: string }; error: string | null } | undefined>;
  clearConversation: () => Promise<void>;
  addSystemContext: (context: string) => void;
  refreshMessages: () => void;
  checkAndResetIfNeeded: () => Promise<boolean>; // Returns true if reset was needed
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

interface ConversationProviderProps {
  children: ReactNode;
  options?: ConversationOptions;
}

export function ConversationProvider({ children, options }: ConversationProviderProps) {
  const defaultSystemPrompt = options?.systemPrompt ||
    `You are an intelligent shopping assistant for the AroundYou app, a Pakistani FMCG marketplace. 
Your workflow for helping users:

1. When a user asks for items (e.g., "I want lays", "get me chips", "cold drink", OR multiple items like "order 2 oreo mini, 3 rio biscuit, one mustard oil and a capstan"):
   - ALWAYS call intelligentSearch ONCE with the FULL user query, even if they mention multiple items
   - For multi-item queries (e.g., "order 2 oreo mini, 3 rio biscuit, one mustard oil and a capstan"), pass the entire query to intelligentSearch in a single call
   - The intelligentSearch function automatically extracts all items, quantities, and searches for them efficiently
   - DO NOT call intelligentSearch multiple times - one call handles everything
   - This function intelligently handles brand variations (e.g., "lays" matches "Lay's")
   - It matches categories (e.g., "chips" matches "Munchies" category)
   - It searches semantically across all available shops

2. After getting search results:
   - Review the items found (the result includes extractedItems with quantities)
   - Use addItemsToCart to add all relevant items to cart at once with their quantities
   - Show the user what was added

3. If user wants to modify the cart:
   - Use removeItemFromCart or updateItemQuantity as needed
   - Show updated cart using getCart

4. When user says "place order" or similar:
   - Use placeOrder to complete the purchase

Key behaviors:
- Always use intelligentSearch first when user asks for items
- For multi-item queries, call intelligentSearch ONCE with the full query - never call it multiple times
- Add multiple items at once using addItemsToCart when appropriate
- Be conversational and helpful
- Understand Pakistani market context (brands, categories, local terms)
- Confirm actions with the user before placing orders
- IMPORTANT: When cart information is displayed in the UI (after addItemsToCart, addItemToCart, removeItemFromCart, updateItemQuantity, or getCart), keep your response extremely brief (5-15 words maximum). Examples: "Ready to place order?" or "Would you like to adjust anything?" The UI already shows all cart details, so do not repeat them.`;

  const [conversationManager] = useState(() => {
    return new ConversationManager({
      ...options,
      functions: FUNCTION_SCHEMAS as any,
      systemPrompt: defaultSystemPrompt,
    });
  });

  const [messages, setMessages] = useState<Message[]>(conversationManager.getMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load persisted conversation on mount
  useEffect(() => {
    loadPersistedConversation();
  }, []);

  // Save conversation whenever messages change
  useEffect(() => {
    if (isInitialized) {
      saveConversation();
    }
  }, [messages, isInitialized]);

  const loadPersistedConversation = async () => {
    try {
      const stored = await AsyncStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        conversationManager.restoreState(state);
        setMessages(conversationManager.getMessages());
      }
    } catch (error) {
      console.error('[ConversationContext] Error loading persisted conversation:', error);
    } finally {
      setIsInitialized(true);
    }
  };

  const saveConversation = async () => {
    try {
      const state = conversationManager.getState();
      await AsyncStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[ConversationContext] Error saving conversation:', error);
    }
  };

  const checkAndResetIfNeeded = async (): Promise<boolean> => {
    try {
      const orderCompleted = await AsyncStorage.getItem(ORDER_COMPLETED_FLAG_KEY);
      if (orderCompleted === 'true') {
        // Reset conversation
        conversationManager.clearHistory();
        setMessages(conversationManager.getMessages());
        await AsyncStorage.removeItem(ORDER_COMPLETED_FLAG_KEY);
        await saveConversation();
        return true;
      }
      return false;
    } catch (error) {
      console.error('[ConversationContext] Error checking reset flag:', error);
      return false;
    }
  };

  const sendMessage = useCallback(async (message: string, additionalContext?: string, onStreamChunk?: (chunk: string) => void) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await conversationManager.sendMessage(message, additionalContext, onStreamChunk);

      // Update messages from manager (streaming updates happen in real-time)
      setMessages(conversationManager.getMessages());

      if (result.error) {
        setError(result.error);
      }

      // Handle function calls will be done by the caller
      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to send message';
      setError(errorMessage);
      console.error('[ConversationContext] Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationManager]);

  const clearConversation = useCallback(async () => {
    conversationManager.clearHistory();
    setMessages(conversationManager.getMessages());
    setError(null);
    try {
      await AsyncStorage.removeItem(CONVERSATION_STORAGE_KEY);
      await AsyncStorage.removeItem(ORDER_COMPLETED_FLAG_KEY);
    } catch (error) {
      console.error('[ConversationContext] Error clearing persisted conversation:', error);
    }
  }, [conversationManager]);

  const addSystemContext = useCallback((context: string) => {
    const currentPrompt = conversationManager.getState().metadata?.systemPrompt || '';
    conversationManager.updateSystemPrompt(`${currentPrompt}\n\nAdditional context: ${context}`);
  }, [conversationManager]);

  const refreshMessages = useCallback(() => {
    setMessages(conversationManager.getMessages());
  }, [conversationManager]);

  const continueConversation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await conversationManager.continueConversation();

      // Update messages from manager
      setMessages(conversationManager.getMessages());

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to continue conversation';
      setError(errorMessage);
      console.error('[ConversationContext] Error continuing conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, [conversationManager]);

  const value: ConversationContextType = {
    conversationManager,
    messages,
    isLoading,
    error,
    sendMessage,
    continueConversation,
    clearConversation,
    addSystemContext,
    refreshMessages,
    checkAndResetIfNeeded,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation(): ConversationContextType {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}

