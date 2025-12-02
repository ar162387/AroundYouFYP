# System Architecture - Complete Documentation

## Overview

AroundYou is a React Native mobile application with a Supabase backend, providing location-based grocery delivery services with conversational AI shopping assistance.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Mobile App"
        A[React Native App]
        B[Consumer Interface]
        C[Merchant Interface]
        D[LLM Conversational Interface]
    end
    
    subgraph "Backend Services"
        E[Supabase Backend]
        F[PostgreSQL Database]
        G[Supabase Realtime]
        H[Supabase Storage]
        I[Edge Functions]
    end
    
    subgraph "External Services"
        J[OpenAI API]
        K[Google Maps API]
        L[Push Notifications]
    end
    
    A --> B
    A --> C
    A --> D
    B --> E
    C --> E
    D --> E
    D --> J
    E --> F
    E --> G
    E --> H
    E --> I
    B --> K
    C --> K
    E --> L
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## Application Architecture

### Component Hierarchy

```mermaid
graph TD
    A[App.tsx] --> B[AppNavigator]
    B --> C[AuthContext]
    B --> D[CartContext]
    B --> E[LocationContext]
    B --> F[ConversationContext]
    
    B --> G[Consumer Stack]
    B --> H[Merchant Stack]
    
    G --> I[HomeScreen]
    G --> J[ShopScreen]
    G --> K[CheckoutScreen]
    G --> L[OrderStatusScreen]
    G --> M[ShoppingAssistantScreen]
    
    H --> N[MerchantDashboard]
    N --> O[MerchantShopsScreen]
    N --> P[MerchantOrdersScreen]
    O --> Q[MerchantShopPortalScreen]
    Q --> R[InventorySection]
    Q --> S[OrdersSection]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style N fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style O fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style P fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style Q fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style R fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style S fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## Database Architecture

### Core Tables

```mermaid
erDiagram
    USERS ||--o{ SHOPS : owns
    USERS ||--o{ ORDERS : places
    USERS ||--o{ CONSUMER_ADDRESSES : has
    SHOPS ||--o{ MERCHANT_ITEMS : contains
    SHOPS ||--o{ ORDERS : receives
    SHOPS ||--o{ DELIVERY_RUNNERS : employs
    SHOPS ||--o{ DELIVERY_ZONES : defines
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS }o--|| DELIVERY_RUNNERS : assigned_to
    MERCHANT_ITEMS }o--|| ITEM_TEMPLATES : linked_to
    MERCHANT_ITEMS }o--o{ MERCHANT_CATEGORIES : belongs_to
    MERCHANT_ITEMS ||--o{ MERCHANT_ITEM_EMBEDDINGS : has
    
    USERS {
        uuid id PK
        string email
        string role
    }
    
    SHOPS {
        uuid id PK
        uuid merchant_id FK
        string name
        point location
        jsonb delivery_zones
    }
    
    ORDERS {
        uuid id PK
        uuid shop_id FK
        uuid user_id FK
        uuid delivery_runner_id FK
        string order_number
        enum status
        integer total_cents
    }
    
    MERCHANT_ITEMS {
        uuid id PK
        uuid shop_id FK
        uuid template_id FK
        string sku
        integer price_cents
        boolean is_active
    }
    
    DELIVERY_RUNNERS {
        uuid id PK
        uuid shop_id FK
        string name
        string phone_number
    }
```

## Service Layer Architecture

### Service Organization

```mermaid
graph LR
    subgraph "Consumer Services"
        A[shopService]
        B[orderService]
        C[addressService]
        D[stockValidationService]
    end
    
    subgraph "Merchant Services"
        E[shopService]
        F[orderService]
        G[inventoryService]
        H[deliveryRunnerService]
    end
    
    subgraph "AI Services"
        I[conversationManager]
        J[intelligentSearchService]
        K[inventorySearchRAG]
        L[embeddingService]
        M[functionRouter]
    end
    
    subgraph "Shared Services"
        N[authService]
        O[supabase]
        P[notificationService]
    end
    
    A --> O
    B --> O
    C --> O
    D --> O
    E --> O
    F --> O
    G --> O
    H --> O
    I --> O
    J --> O
    K --> O
    L --> O
    M --> O
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style N fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style O fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style P fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## Data Flow Architecture

### Order Placement Flow

```mermaid
sequenceDiagram
    participant C as Consumer App
    participant CS as Cart Service
    participant OS as Order Service
    participant DB as Database
    participant RT as Realtime
    participant M as Merchant App
    
    C->>CS: Add items to cart
    CS->>CS: Store in AsyncStorage
    C->>OS: Place order
    OS->>DB: Validate address
    OS->>DB: Calculate totals
    OS->>DB: Create order
    OS->>DB: Create order items
    DB->>RT: Emit order created event
    RT->>M: Notify merchant
    OS->>CS: Clear cart
    OS->>C: Return order confirmation
    
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style CS fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style OS fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style DB fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style RT fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

### Real-Time Order Updates

```mermaid
sequenceDiagram
    participant M as Merchant App
    participant DB as Database
    participant RT as Realtime
    participant C as Consumer App
    
    M->>DB: Update order status
    DB->>DB: Trigger status change
    DB->>RT: Emit status update
    RT->>C: Push status change
    RT->>M: Push status change
    C->>C: Update UI
    M->>M: Update UI
    
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style DB fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style RT fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## LLM Architecture

### Conversational Flow

```mermaid
graph TD
    A[User Message] --> B[ConversationManager]
    B --> C[Add User Message]
    C --> D[Get User Preferences]
    D --> E[Send to OpenAI]
    E --> F{Function Call?}
    F -->|Yes| G[FunctionRouter]
    F -->|No| H[Display Response]
    G --> I{Function Type}
    I -->|Search| J[IntelligentSearch]
    I -->|Cart| K[Cart Operations]
    I -->|Order| L[Order Operations]
    J --> M[Add Function Result]
    K --> M
    L --> M
    M --> E
    H --> N[User Sees Response]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style N fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

### Semantic Search Architecture

```mermaid
graph TD
    A[User Query] --> B[Generate Embedding]
    B --> C[OpenAI Embedding API]
    C --> D[Vector: 1536 dimensions]
    D --> E[PostgreSQL pgvector]
    E --> F[HNSW Index Search]
    F --> G[Similarity Scores]
    G --> H[Rank Results]
    H --> I[Return Top Items]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## State Management Architecture

### Context Providers

```mermaid
graph TD
    A[App Root] --> B[AuthContext]
    A --> C[CartContext]
    A --> D[LocationContext]
    A --> E[ConversationContext]
    
    B --> F[User Authentication]
    B --> G[User Profile]
    
    C --> H[Cart State]
    C --> I[AsyncStorage]
    
    D --> J[Current Location]
    D --> K[Saved Addresses]
    
    E --> L[Conversation History]
    E --> M[LLM State]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style M fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

### React Query Integration

```mermaid
graph LR
    A[React Query] --> B[Query Cache]
    A --> C[Mutation Cache]
    B --> D[Shop Data]
    B --> E[Order Data]
    B --> F[Inventory Data]
    C --> G[Create Operations]
    C --> H[Update Operations]
    C --> I[Delete Operations]
    
    D --> J[Auto Refetch]
    E --> K[Real-time Updates]
    F --> L[Optimistic Updates]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style I fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style J fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style K fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style L fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

## Security Architecture

### Authentication & Authorization

```mermaid
graph TD
    A[User Login] --> B[Supabase Auth]
    B --> C[JWT Token]
    C --> D[API Requests]
    D --> E[Row Level Security]
    E --> F{Authorized?}
    F -->|Yes| G[Access Data]
    F -->|No| H[Access Denied]
    
    style A fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style B fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style C fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style D fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style E fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style F fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style G fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
    style H fill:#1e293b,stroke:#475569,stroke-width:3px,color:#f1f5f9
```

### Row Level Security Policies

- **Consumers:** Can only access their own orders, addresses, and cart data
- **Merchants:** Can only access their own shops, orders, inventory, and runners
- **Shop-scoped:** All merchant data is scoped to shop ownership
- **User-scoped:** All consumer data is scoped to user ownership

## Deployment Architecture

### Mobile App Deployment

- **Platforms:** iOS and Android
- **Build:** React Native with native modules
- **Distribution:** App Store and Google Play Store
- **Updates:** Over-the-air updates via CodePush (future)

### Backend Deployment

- **Hosting:** Supabase Cloud
- **Database:** PostgreSQL on Supabase
- **Storage:** Supabase Storage for images
- **Functions:** Supabase Edge Functions for serverless operations
- **Realtime:** Supabase Realtime for live updates

## Performance Architecture

### Caching Strategy

- **React Query:** Client-side data caching
- **AsyncStorage:** Cart persistence
- **Image Caching:** React Native image caching
- **Embedding Cache:** LLM embedding cache

### Optimization Techniques

- **Vector Search:** HNSW index for fast similarity search
- **Pagination:** Cursor-based pagination for large lists
- **Debouncing:** Search query debouncing
- **Lazy Loading:** Image and component lazy loading
- **Real-time Efficiency:** Targeted subscriptions

## Monitoring & Analytics

### Application Monitoring

- **Error Tracking:** Error boundaries and logging
- **Performance:** React Query devtools
- **Analytics:** Custom analytics events
- **User Behavior:** Event tracking

### Database Monitoring

- **Query Performance:** PostgreSQL query analysis
- **Index Usage:** Index optimization
- **Connection Pooling:** Supabase connection management
- **Realtime Performance:** Subscription monitoring

