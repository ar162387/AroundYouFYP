/**
 * Function Schemas for OpenAI Function Calling
 * 
 * Defines the function schemas that the LLM can call to perform actions
 * like searching shops, adding items to cart, placing orders, etc.
 */

export const FUNCTION_SCHEMAS = [
  {
    name: 'intelligentSearch',
    description: 'Intelligently search for items across all shops in the user\'s area. Uses LLM to understand intent, handles brand variations (e.g., "lays" matches "Lay\'s"), matches categories (e.g., "chips" matches "Munchies"), and returns items ready to add to cart. This is the primary search function for conversational shopping.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "lays", "cold drink", "chips", "snacks")',
        },
        maxShops: {
          type: 'number',
          description: 'Maximum number of shops to search (default: 10)',
          default: 10,
        },
        itemsPerShop: {
          type: 'number',
          description: 'Maximum number of items to return per shop (default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'searchItemsInShop',
    description: 'Search for specific items within a shop using natural language. Useful when user is already viewing a shop.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop to search in',
        },
        query: {
          type: 'string',
          description: 'Natural language search query for items (e.g., "Lays chips", "coca cola", "wavy")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 5)',
          default: 5,
        },
      },
      required: ['shopId', 'query'],
    },
  },
  {
    name: 'addItemsToCart',
    description: 'Add multiple items to cart at once. Use this after intelligentSearch to add all found items. Each item should have shopId, itemId, and quantity. IMPORTANT: Extract quantities from the user query (e.g., "2 always" means quantity 2, "3 shampoo" means quantity 3). If no quantity is mentioned, default to 1.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of items to add to cart. MUST include the quantity extracted from user query or default to 1.',
          items: {
            type: 'object',
            properties: {
              shopId: {
                type: 'string',
                description: 'The UUID of the shop',
              },
              itemId: {
                type: 'string',
                description: 'The UUID of the merchant item to add',
              },
              quantity: {
                type: 'number',
                description: 'Quantity to add. Extract from user query (e.g., "2 always" = 2, "3 shampoo" = 3). Default: 1 if not specified.',
                default: 1,
              },
            },
            required: ['shopId', 'itemId'],
          },
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'addItemToCart',
    description: 'Add a single item to the shopping cart. Validates stock before adding.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop',
        },
        itemId: {
          type: 'string',
          description: 'The UUID of the merchant item to add',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (default: 1)',
          default: 1,
        },
      },
      required: ['shopId', 'itemId'],
    },
  },
  {
    name: 'removeItemFromCart',
    description: 'Remove an item from the shopping cart or reduce its quantity.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop',
        },
        itemId: {
          type: 'string',
          description: 'The UUID of the merchant item to remove',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to remove (if not specified, removes all of this item)',
        },
      },
      required: ['shopId', 'itemId'],
    },
  },
  {
    name: 'updateItemQuantity',
    description: 'Update the quantity of an item in the cart.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop',
        },
        itemId: {
          type: 'string',
          description: 'The UUID of the merchant item',
        },
        quantity: {
          type: 'number',
          description: 'New quantity (must be at least 1)',
        },
      },
      required: ['shopId', 'itemId', 'quantity'],
    },
  },
  {
    name: 'getCart',
    description: 'Get the current shopping cart for a specific shop. Use this when user asks to see their cart, view cart, show cart, or check cart for a particular shop.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop',
        },
      },
      required: ['shopId'],
    },
  },
  {
    name: 'getAllCarts',
    description: 'Get all shopping carts across all shops. Use this when user asks to see their cart, view cart, show cart, check cart, or "show my cart" without specifying a shop. This shows all items in all carts.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'placeOrder',
    description: 'Place an order from a shop\'s cart. Uses the user\'s saved address and Cash on Delivery payment.',
    parameters: {
      type: 'object',
      properties: {
        shopId: {
          type: 'string',
          description: 'The UUID of the shop',
        },
        addressId: {
          type: 'string',
          description: 'The UUID of the delivery address (uses default if not provided)',
        },
        specialInstructions: {
          type: 'string',
          description: 'Optional special delivery instructions',
        },
      },
      required: ['shopId'],
    },
  },
] as const;

