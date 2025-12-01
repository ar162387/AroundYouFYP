/**
 * Conversation Manager
 * 
 * Manages conversation state and context across multiple messages.
 * Maintains message history and orchestrates LLM interactions.
 */

import { createChatCompletion, createChatCompletionStream } from './openAIService';
import type { OpenAI } from 'openai';

export type MessageRole = 'system' | 'user' | 'assistant' | 'function';
export type Message = {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  function_result?: any;
  timestamp: number;
};

export interface ConversationState {
  messages: Message[];
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface ConversationOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

/**
 * Conversation Manager Class
 */
export class ConversationManager {
  private messages: Message[] = [];
  private systemPrompt: string;
  private temperature: number;
  private maxTokens: number;
  private functions?: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;

  constructor(options: ConversationOptions = {}) {
    this.systemPrompt = options.systemPrompt || 'You are a helpful shopping assistant for the AroundYou app. Help users find and order items through natural conversation. You can use Markdown for your responses (bold, italics, lists). The UI will automatically display detailed item cards, images, delivery fees, and address information when you add items to cart or view cart. Do not repeat this information in your text response. IMPORTANT: When cart information is displayed in the UI (after cart operations), keep your response extremely brief (5-15 words maximum). Examples: "Ready to place order?" or "Would you like to adjust anything?" CRITICAL: When user asks to "show my cart", "view cart", "check cart", or similar, ALWAYS call getAllCarts() function immediately. Do NOT ask if they want to place an order - just show the cart.';
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 2000;
    this.functions = options.functions;

    // Add system message if provided
    if (this.systemPrompt) {
      this.addMessage('system', this.systemPrompt);
    }
  }

  /**
   * Add a message to the conversation
   */
  addMessage(
    role: MessageRole,
    content: string,
    functionCall?: { name: string; arguments: string },
    functionResult?: any,
    name?: string
  ): void {
    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
      ...(name && { name }),
      ...(functionCall && { function_call: functionCall }),
      ...(functionResult !== undefined && { function_result: functionResult }),
    };

    this.messages.push(message);
  }

  /**
   * Add user message
   */
  addUserMessage(content: string): void {
    this.addMessage('user', content);
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string, functionCall?: { name: string; arguments: string }): void {
    this.addMessage('assistant', content, functionCall);
  }

  /**
   * Add function result message
   */
  addFunctionResult(functionName: string, result: any): void {
    // Add function result with 'function' role
    this.addMessage('function', JSON.stringify(result), undefined, result, functionName);
  }

  /**
   * Get conversation messages in OpenAI format
   */
  getOpenAIMessages(): Array<{
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
    function_call?: any;
  }> {
    return this.messages
      .filter((msg) => msg.role !== 'system' || msg === this.messages[0]) // Keep only first system message
      .map((msg) => {
        const openAIMessage: any = {
          role: msg.role,
          content: msg.content,
        };

        if (msg.name) {
          openAIMessage.name = msg.name;
        }

        if (msg.function_call) {
          openAIMessage.function_call = {
            name: msg.function_call.name,
            arguments: msg.function_call.arguments,
          };
        }

        return openAIMessage;
      });
  }

  /**
   * Get all messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get conversation state for persistence
   */
  getState(): ConversationState {
    return {
      messages: this.messages,
      metadata: {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        functionCount: this.functions?.length || 0,
        systemPrompt: this.systemPrompt,
      },
    };
  }

  /**
   * Restore conversation state
   */
  restoreState(state: ConversationState): void {
    if (state.messages && Array.isArray(state.messages)) {
      this.messages = state.messages;
    }
    if (state.metadata?.systemPrompt) {
      this.systemPrompt = state.metadata.systemPrompt;
      // Update system message if it exists
      const systemIndex = this.messages.findIndex((msg) => msg.role === 'system');
      if (systemIndex >= 0) {
        this.messages[systemIndex] = {
          role: 'system',
          content: state.metadata.systemPrompt,
          timestamp: this.messages[systemIndex].timestamp || Date.now(),
        };
      }
    }
  }

  /**
   * Clear conversation history (keeping system prompt)
   */
  clearHistory(): void {
    const systemMessage = this.messages.find((msg) => msg.role === 'system');
    this.messages = systemMessage ? [systemMessage] : [];
  }

  /**
   * Get last N messages for context window management
   */
  getRecentMessages(count: number = 10): Message[] {
    // Always include system message if present
    const systemMessage = this.messages.find((msg) => msg.role === 'system');
    const recentMessages = this.messages.slice(-count);

    if (systemMessage && !recentMessages.includes(systemMessage)) {
      return [systemMessage, ...recentMessages.slice(1)];
    }

    return recentMessages;
  }

  /**
   * Continue conversation (generate response based on current history)
   * Useful after adding function results
   */
  async continueConversation(): Promise<{
    response: string | null;
    functionCall?: { name: string; arguments: string };
    error: string | null;
  }> {
    try {
      // Build messages for OpenAI
      const openAIMessages = this.getOpenAIMessages();

      // Call OpenAI
      const result = await createChatCompletion(openAIMessages, {
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        functions: this.functions,
        function_call: this.functions ? 'auto' : undefined,
      });

      if (result.error) {
        return { response: null, error: result.error };
      }

      if (!result.data) {
        return { response: null, error: 'No response from OpenAI' };
      }

      const choice = result.data.choices[0];
      if (!choice) {
        return { response: null, error: 'No choice in OpenAI response' };
      }

      const message = choice.message;

      // Handle function calling
      if (message.function_call) {
        const functionCall = {
          name: message.function_call.name,
          arguments: message.function_call.arguments || '{}',
        };

        this.addAssistantMessage(message.content || '', functionCall);

        return {
          response: null,
          functionCall,
          error: null,
        };
      }

      // Regular response
      const responseText = message.content || '';

      this.addAssistantMessage(responseText);

      return {
        response: responseText,
        error: null,
      };
    } catch (error: any) {
      console.error('[ConversationManager] Error continuing conversation:', error);
      return {
        response: null,
        error: error?.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Send a message and get LLM response with streaming support
   */
  async sendMessage(
    userMessage: string,
    additionalContext?: string,
    onStreamChunk?: (chunk: string) => void
  ): Promise<{
    response: string | null;
    functionCall?: { name: string; arguments: string };
    error: string | null;
  }> {
    try {
      // Add user message
      this.addUserMessage(userMessage);

      // Build messages for OpenAI
      const openAIMessages = this.getOpenAIMessages();

      // Add additional context if provided
      if (additionalContext) {
        openAIMessages.push({
          role: 'user',
          content: `Additional context: ${additionalContext}`,
        });
      }

      // Use streaming if onStreamChunk is provided
      // Note: OpenAI streaming doesn't support function calling, so if functions are available,
      // we'll use non-streaming to allow function calls. However, for better UX, we can still
      // use streaming for regular text responses and handle function calls in subsequent iterations.
      // For now, we use streaming only when no functions are configured to avoid complexity.
      // In practice, most responses will be text, so this provides a good balance.
      if (onStreamChunk && (!this.functions || this.functions.length === 0)) {
        // Create a placeholder assistant message that we'll update as chunks arrive
        const streamingMessageIndex = this.messages.length;
        this.addAssistantMessage('');

        let fullResponse = '';

        const streamResult = await createChatCompletionStream(
          openAIMessages,
          (chunk: string) => {
            fullResponse += chunk;
            // Update the message in real-time
            if (this.messages[streamingMessageIndex]) {
              this.messages[streamingMessageIndex].content = fullResponse;
            }
            onStreamChunk(chunk);
          },
          {
            temperature: this.temperature,
            max_tokens: this.maxTokens,
          }
        );

        if (streamResult.error) {
          // Remove the placeholder message on error
          this.messages.pop();
          return { response: null, error: streamResult.error };
        }

        // Final message is already updated
        return {
          response: fullResponse,
          error: null,
        };
      }
      
      // For function calling scenarios, we need to use non-streaming
      // but we can still provide a smooth UX by showing the function call immediately

      // Regular non-streaming completion (required for function calling)
      const result = await createChatCompletion(openAIMessages, {
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        functions: this.functions,
        function_call: this.functions ? 'auto' : undefined,
      });

      if (result.error) {
        return { response: null, error: result.error };
      }

      if (!result.data) {
        return { response: null, error: 'No response from OpenAI' };
      }

      const choice = result.data.choices[0];
      if (!choice) {
        return { response: null, error: 'No choice in OpenAI response' };
      }

      const message = choice.message;

      // Handle function calling
      if (message.function_call) {
        const functionCall = {
          name: message.function_call.name,
          arguments: message.function_call.arguments || '{}',
        };

        this.addAssistantMessage(message.content || '', functionCall);

        return {
          response: null,
          functionCall,
          error: null,
        };
      }

      // Regular response
      const responseText = message.content || '';

      this.addAssistantMessage(responseText);

      return {
        response: responseText,
        error: null,
      };
    } catch (error: any) {
      console.error('[ConversationManager] Error sending message:', error);
      return {
        response: null,
        error: error?.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Update system prompt
   */
  updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;

    // Update or add system message
    const systemIndex = this.messages.findIndex((msg) => msg.role === 'system');
    const systemMessage: Message = {
      role: 'system',
      content: newPrompt,
      timestamp: Date.now(),
    };

    if (systemIndex >= 0) {
      this.messages[systemIndex] = systemMessage;
    } else {
      this.messages.unshift(systemMessage);
    }
  }
}

