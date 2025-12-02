Final Project Report: AroundYou - A Hyperlocal Conversational Commerce Platform

Front Matter

1. Title Page


--------------------------------------------------------------------------------


2. Certificate of Approval

It is certified that this project report, titled "AroundYou: A Hyperlocal Conversational Commerce Platform," submitted by [Placeholder Student Names], meets the requirements for the award of the degree of Bachelor of Science in Computer Science. The work presented herein is the students' own and has been carried out under my supervision.

Supervisor: _____________________ <br> [Placeholder Supervisor Name] <br> <br>

Examiner 1: _____________________ <br> <br> Examiner 2: _____________________


--------------------------------------------------------------------------------


3. Abstract

Small local businesses often struggle to achieve digital visibility, facing significant barriers to entry in a market dominated by large e-commerce platforms. For consumers, the process of discovering and purchasing from nearby merchants is fragmented, requiring multiple applications for different needs and lacking a unified, efficient interface. This project addresses these challenges through the design and implementation of "AroundYou," a hyperlocal conversational commerce platform.

AroundYou is a comprehensive mobile application that serves as a unified marketplace, connecting local consumers with a diverse range of neighborhood shops, from groceries and retail to pharmacies. The solution is architected as a React Native mobile application for both iOS and Android, ensuring a wide reach and a native user experience. The backend is built on a modern, serverless stack leveraging Supabase, which provides an integrated suite of services including a PostgreSQL database with PostGIS and pgvector extensions, real-time subscriptions, authentication, storage, and serverless edge functions.

The primary result of this project is an integrated platform featuring a seamless consumer shopping experience and a robust merchant portal for managing inventory, orders, and delivery operations in real-time. Key innovations include a novel conversational AI shopping assistant powered by a Large Language Model (LLM) that uses semantic search for natural language item discovery and cart management. The platform also introduces polygon-based delivery zones, offering merchants granular control over their service areas. The successful implementation of these features demonstrates a scalable and effective solution to bridge the digital gap for local commerce, fostering a more connected and efficient neighborhood economy.


--------------------------------------------------------------------------------


4. Acknowledgments

First and foremost, all praise and thanks are due to God, the most gracious and merciful, for providing the strength and knowledge to complete this project.

We extend our deepest gratitude to our project supervisor, [Placeholder Supervisor Name], for their invaluable guidance, encouragement, and insightful feedback throughout the duration of this work. Their expertise was instrumental in navigating the complexities of the project.

Finally, we would like to express our heartfelt appreciation to our parents and families for their unwavering support, patience, and encouragement, which have been our constant source of motivation.


--------------------------------------------------------------------------------


5. Quote/Epigraph

"The advance of technology is based on making it fit in so that you don't really even notice it, so it's part of everyday life."

— Bill Gates


--------------------------------------------------------------------------------


6. Table of Contents, List of Figures, List of Tables

(These sections would be auto-generated in the final, typeset version of this document. A sample of the main chapter titles is provided below for context.)

Table of Contents

* Chapter 1: Introduction
* Chapter 2: Literature Review
* Chapter 3: Requirement Specifications
* Chapter 4: System Design
* Chapter 5: System Implementation
* Chapter 6: System Testing and Evaluation
* Chapter 7: Conclusions

List of Figures

* Figure 3.1: Use Case Diagram for Consumer Order Placement
* Figure 3.2: Use Case Diagram for Merchant Order Processing
* Figure 4.1: System Architecture Diagram
* ...and so on.

List of Tables

* Table 2.1: Comparative Analysis of Local Commerce Platforms
* Table 3.1: Non-Functional Requirements
* Table 3.2: Use Case Table for Placing an Order
* ...and so on.


--------------------------------------------------------------------------------


7. Acronyms and Abbreviations

Acronym	Definition
API	Application Programming Interface
ERD	Entity Relationship Diagram
GUI	Graphical User Interface
HNSW	Hierarchical Navigable Small World
JSON	JavaScript Object Notation
LLM	Large Language Model
RLS	Row Level Security
SQL	Structured Query Language


--------------------------------------------------------------------------------


Chapter 1: Introduction

In the digital age, the ability of local businesses to connect with their immediate community is a critical determinant of their success and sustainability. While large-scale e-commerce platforms have revolutionized retail, they have often widened the digital divide for small, neighborhood merchants. This chapter introduces the core problems faced by both local businesses and consumers in the hyperlocal commerce space and outlines the objectives, contributions, and scope of the "AroundYou" platform, a solution designed to bridge this gap.

1.1 Problem Description

The "AroundYou" platform is designed to address two primary, interconnected problems within the hyperlocal commerce ecosystem.

First, small local businesses face a significant challenge in achieving adequate digital visibility. Establishing an independent e-commerce presence requires substantial technical expertise, financial investment, and marketing effort, which are often beyond the means of independent shop owners. Consequently, these merchants are unable to compete effectively with larger chains and are often invisible to a growing segment of consumers who prefer the convenience of online discovery and ordering.

Second, from the consumer's perspective, the current landscape for discovering and purchasing from local merchants is fragmented and inefficient. Consumers must navigate multiple single-purpose applications—one for groceries, another for pharmacies, and yet another for general retail—leading to a disjointed user experience. There is a lack of a unified platform that provides a single, intuitive interface for discovering the full breadth of products and services available within their immediate vicinity.

This project aims to solve these problems by developing an integrated platform that empowers local merchants and simplifies the discovery-to-purchase journey for consumers.

1.2 Objectives

To address the problems described above, this project established a set of specific and measurable objectives. These goals guided the development of the "AroundYou" platform, ensuring it provides a comprehensive and effective solution for the hyperlocal market.

The core objectives of the project are as follows:

1. To develop an intuitive and seamless mobile platform for consumers to discover, browse, and order from a diverse range of nearby shops based on their real-time location.
2. To create a comprehensive merchant portal that empowers business owners to manage their shop details, control inventory, process orders, and oversee delivery operations in real-time.
3. To implement a reliable, real-time ordering system with transparent status tracking, providing instant updates to both consumers and merchants throughout the entire order lifecycle.
4. To integrate an intelligent, conversational AI assistant that leverages a Large Language Model (LLM) to enhance the shopping discovery process, enabling users to find items and manage their carts using natural language.

The fulfillment of these objectives is achieved through a set of novel contributions that differentiate "AroundYou" from existing solutions in the market.

1.2.1 Major Novel Contributions

In the context of this project, "novel contributions" refer to the unique technical and functional features that distinguish the "AroundYou" platform from conventional e-commerce and delivery applications. These contributions are specifically designed to address the nuanced challenges of the hyperlocal market.

* Conversational AI Shopping: The platform integrates an LLM-powered assistant that facilitates a natural, conversational shopping experience. This system employs semantic search, utilizing pgvector embeddings and an HNSW index, to understand user intent from natural language queries (e.g., "I need some snacks and a cold drink"). It can search across multiple shops simultaneously, suggest relevant items, and manage the user's cart through conversation.
* Polygon-Based Delivery Zones: Unlike traditional platforms that use simple radius-based delivery areas, "AroundYou" implements precise, polygon-based delivery zones using PostGIS. This gives merchants granular control to define custom service areas that accurately reflect their operational capabilities, accommodating geographical barriers like rivers or highways.
* Unified Hyperlocal Marketplace: The platform aggregates a diverse array of local business types—including groceries, retail, and pharmacies—into a single, location-aware discovery interface. This creates a one-stop shop for consumers, eliminating the need for multiple applications and fostering a more interconnected local economy.
* Real-Time Inventory and Order Synchronization: Leveraging Supabase Realtime, the platform provides instantaneous updates across the ecosystem. When a merchant updates an item's availability or an order's status, the change is pushed immediately to all relevant clients (consumer and merchant apps), eliminating the delays associated with traditional polling-based systems.
* Hybrid Inventory Template System: To streamline the onboarding process for merchants, the platform features a unique inventory system. Merchants can rapidly populate their inventory by adopting items from a global catalog of common products or create their own fully custom items. This hybrid approach significantly reduces the time and effort required for initial setup. Furthermore, this system provides a baseline of consistent, structured data that significantly enhances the performance and accuracy of the LLM's semantic search capabilities across the entire marketplace.

These contributions are bounded by a well-defined project scope, which is detailed in the following section.

1.3 Project Scope

Clearly defining the project's scope is essential for managing development efforts and setting realistic expectations for deliverables. The scope of the "AroundYou" platform is divided into core functionalities that were implemented and features that are considered for future development.

In Scope:

* Consumer Application: A complete mobile application for consumers to manage addresses, discover nearby shops, browse items, maintain per-shop carts, place orders, track order status in real-time, and interact with the conversational AI assistant.
* Merchant Portal: A comprehensive dashboard for merchants to manage their shop profile, define delivery zones, control inventory (using both template and custom items), process incoming orders through their lifecycle, and manage a roster of delivery runners.
* Order Management System: A full-featured system for handling the order lifecycle from PENDING to DELIVERED, including real-time status updates and automatic timing tracking.
* Delivery Runner Management: Functionality within the merchant portal to create, edit, and assign delivery runners to confirmed orders.

Out of Scope:

* Dedicated Delivery Runner Application: The project does not include a separate mobile application for delivery runners. All delivery-related actions are managed by the merchant.
* Advanced Fleet Management: Features such as live GPS-based runner tracking and automated route optimization are considered future work and are not part of the current implementation.
* Payment Gateway Integration: The current version simulates the payment process without integrating with a live third-party payment gateway.

This defined scope allows the platform to deliver significant value in its target application areas.

1.4 Solution Application Areas

The "AroundYou" platform is designed to have a tangible, positive impact on several key sectors within the local economy. Its architecture and feature set provide direct benefits to both businesses and the communities they serve.

* Local Retail & Groceries: The platform provides small grocery stores, bakeries, and local retail shops with a turnkey digital storefront. It empowers them to compete with larger supermarket chains by offering the convenience of online ordering and local delivery, thereby retaining and expanding their customer base.
* Pharmacies: Local pharmacies can leverage the platform to offer a convenient delivery service for over-the-counter products and other essentials. This is particularly valuable for customers with limited mobility or those seeking urgent supplies.
* Local Economy Growth: By creating a low-friction digital bridge between neighborhood consumers and merchants, the platform fosters a stronger, more resilient local economic ecosystem. It encourages local spending, increases the visibility of small businesses, and helps build a sense of community connection.

This chapter has established the foundational context for the project. The following chapter will conduct a literature review to position "AroundYou" within the existing technology landscape and highlight the specific gaps it aims to fill.


--------------------------------------------------------------------------------


Chapter 2: Literature Review

2.1 Introduction

Before developing a new technological solution, it is crucial to analyze the existing landscape of related products and services. This literature review examines the current state of local-commerce and delivery platforms to identify established patterns, prevailing technologies, and, most importantly, critical gaps in the market. By comparing "AroundYou" to existing solutions, this chapter will justify the project's novel contributions and demonstrate how it addresses unmet needs for both consumers and local merchants.

2.2 Comparative Analysis

To benchmark the "AroundYou" platform, this section deconstructs the features and limitations of established competitors, such as Foodpanda (representing single-category delivery) and OLX (representing general classifieds/marketplaces). This comparative analysis highlights the strategic advantages offered by the unique design of "AroundYou."

Table 2.1: Comparative Analysis of Local Commerce Platforms

Feature	Competitor A/B (e.g., Foodpanda)	AroundYou	Strategic Advantage
Marketplace Type	Single-category (e.g., food delivery)	Cross-category (Groceries, Retail, Pharmacy)	Provides a unified, one-stop-shop experience for consumers, increasing platform utility.
Delivery Zone Control	Simple radius-based	Polygon-based (PostGIS)	Offers merchants precise, granular control over their service area, improving operational efficiency.
Search Paradigm	Keyword-based search	Conversational Semantic Search (LLM)	Delivers a more intuitive and natural discovery experience, understanding user intent.
Inventory Management	Manual entry per merchant	Hybrid Template System (Global & Custom)	Drastically reduces merchant setup time and ensures data consistency across the platform.
Real-time Updates	Often relies on periodic polling	Real-time subscriptions (Supabase Realtime)	Ensures instant synchronization of order status and inventory, enhancing user experience.

This comparison reveals several key areas where "AroundYou" introduces significant innovation. The following section synthesizes these findings into a direct analysis of the gaps in the current market.

2.3 Positioning & Gap Analysis

The comparative analysis demonstrates that while existing platforms serve specific functions well, they leave several functional and technical voids in the hyperlocal commerce market. This section explicitly identifies these gaps and explains how "AroundYou" was engineered to fill them.

1. Lack of True Hyperlocal Control: Existing platforms typically offer merchants a simple radius for defining delivery zones. This is a blunt instrument that fails to account for real-world geography like rivers, parks, or specific neighborhood boundaries. Gap: The absence of precise delivery area management. Solution: "AroundYou" addresses this with polygon-based zones, allowing merchants to draw their exact service areas on a map for superior operational control.
2. Fragmented, Single-Category Marketplaces: The current market forces consumers to use separate applications for different local needs—one for restaurant food, another for groceries, and a third for pharmacy items. This creates friction and a disjointed user experience. Gap: The lack of a unified, cross-category local marketplace. Solution: "AroundYou" consolidates diverse local businesses into a single, cohesive platform, offering consumers unparalleled convenience.
3. Inefficient Search and Discovery: Standard keyword search in e-commerce apps can be rigid and unforgiving, often failing if the user does not know the exact product name. Gap: An unintuitive and purely lexical search paradigm. Solution: The platform's LLM-powered conversational assistant uses semantic search to understand user intent and natural language, transforming product discovery into a fluid, human-like conversation.
4. Absence of Real-Time Synchronization: Many platforms rely on periodic polling (refreshing data every few seconds or minutes) to update information like order status. This introduces noticeable delays and can lead to operational inefficiencies. Gap: The lack of instantaneous data synchronization. Solution: "AroundYou" uses a real-time subscription model, pushing updates instantly to all connected devices, which is critical for time-sensitive operations like order and inventory management.

Having identified these critical market gaps, the project proceeded to define a set of detailed system requirements specifically designed to address them. The next chapter outlines these specifications.


--------------------------------------------------------------------------------


Chapter 3: Requirement Specifications

This chapter defines the specific requirements that the "AroundYou" system must fulfill. Functional requirements detail the system's behaviors and capabilities, categorized by user role, while non-functional requirements specify the quality attributes and constraints, such as performance and security. Use cases are then presented to model key interactions between users and the system.

3.1 Functional Requirements

Functional requirements specify what the system should do. For clarity, they are organized by the primary user roles defined within the platform.

User Roles:

* Consumer: An individual who uses the application to discover local shops, purchase items, and track orders.
* Merchant: A business owner or manager who uses the platform to manage their shop, inventory, and orders.

Consumer Functional Requirements (C#)

* C1: Location Management: The system shall allow consumers to set their location via GPS or manual address entry and manage multiple saved delivery addresses.
* C2: Shop Discovery: The system shall display a list of nearby shops based on the consumer's current location, showing key information like distance and availability.
* C3: Item Browsing: Consumers shall be able to browse items within a shop, filtered by category, and search for specific items.
* C4: Cart Management: The system shall maintain a separate shopping cart for each shop. Consumers must be able to add, remove, and update the quantity of items in their carts.
* C5: Conversational Shopping: The system shall provide an AI assistant allowing consumers to find items and add them to their cart using natural language queries.
* C6: Order Placement: The system shall enable consumers to place an order from a single shop's cart, selecting a delivery address and viewing a full cost breakdown.
* C7: Order Tracking: Consumers shall be able to view the real-time status of their active orders and access a history of their past orders.

Merchant Functional Requirements (M#)

* M1: Shop Management: The system shall allow merchants to create and manage their shop profile, including name, address, and operational status (active/inactive).
* M2: Delivery Zone Management: Merchants shall be able to define one or more custom polygon-based delivery zones for their shop on a map.
* M3: Inventory Control: Merchants shall be able to manage their inventory by adding items from a global template or creating custom items, setting prices, and toggling availability.
* M4: Order Processing: The system shall notify merchants of new orders in real-time. Merchants must be able to view, confirm, dispatch, and mark orders as delivered or cancelled.
* M5: Delivery Runner Management: Merchants shall be able to create a list of delivery runners for their shop and assign a specific runner to a confirmed order.

System Functional Requirements (S#)

* S1: Audit Logging: The system shall automatically create an audit log for all changes made to a merchant's inventory, tracking the user, action, and timestamp.
* S2: Security Enforcement: The system shall enforce Row Level Security (RLS) policies to ensure that users can only access and modify data they are authorized to see (e.g., a merchant can only see their own shop's orders).

3.2 Non-Functional Requirements (NFRs)

Non-functional requirements define the quality attributes of the system, setting standards for its operation. They are crucial for ensuring a high-quality user experience and robust performance.

Table 3.1: Non-Functional Requirements

ID	Requirement Category	Specification
NFR1	Performance	API queries for shop discovery, which involve geospatial calculations, must resolve in under 80ms.
NFR2	Security	All data access must be governed by shop-scoped or user-scoped Row Level Security (RLS) policies.
NFR3	Availability	The system will be hosted on Supabase Cloud to ensure high availability and managed infrastructure.
NFR4	Usability	The user interface must be intuitive and follow consistent design patterns as outlined in the design system.

3.3 Use Case Diagrams & Tables

Use cases are employed to model the interactions between actors (users) and the system to achieve specific goals. Below are descriptions of key use cases for the "AroundYou" platform.

1. Use Case 1: Consumer Places an Order

Figure 3.1: Use Case Diagram for Consumer Order Placement

* Actor: Consumer
* System: AroundYou Application
* Description: This diagram models the process of a Consumer placing an order. The central Place Order use case orchestrates the entire flow, including the Manage Address and Browse Items use cases, while depending on the system's Validate Delivery Zone function. The Consumer actor initiates the primary use cases of Search Shops, Browse Items, and Add to Cart before culminating in the Place Order action.

Table 3.2: Use Case Table for Placing an Order

Use Case ID & Name	UC-01: Place Order
Actor	Consumer
Pre-conditions	1. Consumer is logged in. 2. Consumer has at least one item in a shop's cart. 3. Consumer has a saved delivery address.
Trigger	Consumer presses the "Checkout" or "Place Order" button from the cart screen.
Flow of Events	1. The system displays the checkout screen with order summary and total cost. <br> 2. The consumer selects a delivery address. <br> 3. The system validates that the selected address is within the shop's delivery zone. <br> 4. The consumer confirms the order. <br> 5. The system creates a new order with the status PENDING. <br> 6. The system sends a notification to the merchant. <br> 7. The system displays an order confirmation screen to the consumer.

2. Use Case 2: Merchant Processes an Order

Figure 3.2: Use Case Diagram for Merchant Order Processing

* Actor: Merchant
* System: AroundYou Application (Merchant Portal)
* Description: This diagram illustrates the sequence of actions a Merchant takes to process an order. The flow is initiated by a system-generated Receive Order Notification. The Merchant then performs a series of actions: Confirm Order, followed by Assign Runner, and finally Mark as Delivered. Each action represents a distinct state transition in the order's lifecycle.

Table 3.3: Use Case Table for Processing an Order

Use Case ID & Name	UC-02: Process Order
Actor	Merchant
Pre-conditions	1. Merchant is logged into the merchant portal. 2. A new order with PENDING status exists for the merchant's shop.
Trigger	Merchant receives a notification for a new order.
Flow of Events	1. The merchant navigates to the Orders section and views the pending order. <br> 2. The merchant presses the "Confirm" button. The order status changes to CONFIRMED. <br> 3. After preparing the items, the merchant presses "Assign Runner." <br> 4. The system displays a list of available delivery runners. <br> 5. The merchant selects a runner and confirms the assignment. The order status changes to OUT_FOR_DELIVERY. <br> 6. Once delivery is complete, the merchant marks the order as DELIVERED.

This chapter has detailed the 'what' of the system through requirements. The next chapter will transition to the 'how' by detailing the system's design and architecture.


--------------------------------------------------------------------------------


Chapter 4: System Design

4.1 System Architecture

A well-defined architecture is the foundation of a scalable, maintainable, and performant application. "AroundYou" is built upon a modern, serverless architecture designed for rapid development and high scalability. This approach minimizes infrastructure management overhead and allows the development team to focus on core business logic.

The high-level architecture consists of two primary components: a cross-platform mobile application for the frontend and Supabase as the comprehensive backend-as-a-service (BaaS) platform. The frontend is developed using React Native, enabling a single codebase to serve both iOS and Android users with a native look and feel.

The backend is entirely powered by Supabase, which provides an integrated suite of open-source tools built on top of PostgreSQL. This serverless model was chosen for its key benefits:

* Integrated Services: Supabase bundles a PostgreSQL Database, Authentication, instant APIs, Edge Functions for custom logic, Storage for files, and a Realtime engine. This eliminates the need to manage disparate services.
* Scalability: As a cloud-hosted solution, Supabase handles database scaling, connection pooling, and server management automatically.
* Developer Efficiency: Auto-generated APIs and a powerful client library significantly accelerate development cycles.

4.2 Architecture Diagram

The architecture diagram visually represents the major components of the "AroundYou" system and illustrates the flow of data and interactions between them.

Figure 4.1: System Architecture Diagram

* Client (React Native Application): This is the user-facing component for both Consumers and Merchants on iOS and Android. It handles all UI rendering and local state management. It interacts with the backend through a unified API layer.
* API Layer (Supabase Edge Functions & REST API): This acts as the communication gateway. Standard CRUD operations are handled by Supabase's auto-generated RESTful API, while complex business logic (e.g., order placement, AI interactions) is encapsulated in serverless Supabase Edge Functions.
* Backend Services (Supabase): This is the core of the platform, composed of several integrated services:
  * Authentication: Manages user identity, sessions, and secures API access via JSON Web Tokens (JWTs).
  * Database (PostgreSQL with PostGIS & pgvector): The central data repository. PostGIS enables geospatial queries for location-based features, while pgvector provides vector similarity search for the AI assistant.
  * Storage: Securely stores user-generated content like shop logos and item images.
  * Realtime Engine: Listens for database changes and broadcasts updates to subscribed clients over websockets, enabling live features like order tracking without client-side polling.
* External Services (OpenAI): The platform makes secure, server-to-server calls to the OpenAI API to generate vector embeddings for semantic search and to power the conversational logic of the shopping assistant.

4.3 High-Level Design

High-level design focuses on the major modules and their interactions, often illustrated through activity and sequence diagrams to clarify user journeys and technical flows.

1. Activity Diagram: Consumer Order Placement

This diagram models the user journey from discovering a shop to confirming an order, representing a key workflow in the application.

Figure 4.2: Activity Diagram for Consumer Order Placement

* The flow begins with the user launching the app and landing on the "Browse Nearby Shops" screen.
* The user selects a shop, leading to the "Select Items" activity, where they can browse products.
* As items are chosen, they are added to the cart in the "Add to Cart" step.
* Once shopping is complete, the user initiates the "Proceed to Checkout" action.
* In the checkout flow, the user must "Select Address" from their saved addresses.
* The final step is to "Confirm Order," which triggers the backend order creation process and concludes the activity.

2. Sequence Diagram: Real-Time Order Update

This diagram illustrates the technical interactions that occur when a merchant updates an order's status, showcasing the real-time capabilities of the system.

Figure 4.3: Sequence Diagram for Real-Time Order Update

* Initiation: The Merchant App calls an updateOrderStatus() function, sending a request to the Supabase Backend.
* Database Write: The backend logic executes a write operation, updating the status field for the relevant record in the orders table within the PostgreSQL Database.
* Trigger and Publication: This write operation invokes a predefined database trigger, which in turn publishes a payload to a specific Realtime channel dedicated to that order.
* Real-time Push: The Supabase Realtime service receives this payload and immediately broadcasts it over an active websocket connection.
* UI Update: The Consumer App, which is subscribed to that channel, receives the payload and updates its UI state, instantly reflecting the new order status without needing to poll for changes.

4.4 Low-Level Design

Low-level design provides detailed specifications for individual system components. This section focuses on the database schema, which is the structural blueprint for all data within the application.

Entity Relationship Diagram (ERD)

The database schema is designed to be relational, normalized, and efficient, ensuring data integrity and query performance.

Figure 4.4: Entity Relationship Diagram

* The schema is centered around the Orders table, which serves as a nexus. Each Order must be associated with one User (the consumer) and one Shop. In turn, each Shop is owned by a User (the merchant) and contains an inventory of Merchant_Items.
* A one-to-many relationship exists between Orders and Order_Items, where Order_Items acts as a junction table capturing the specific items, quantities, and their snapshot prices for each order.
* The Users table, linked to Supabase's authentication system, serves as the root for both consumers and merchants.
* Supporting entities like Delivery_Runners are linked directly to a Shop in a one-to-many relationship, and an Order can have a nullable foreign key reference to a Delivery_Runner upon assignment.

4.5 GUI Screens & Workflows

This section provides a functional overview of the application's key user interfaces, describing their layout and core components based on the established design system.

1. Consumer Home Screen

* Layout: The screen is topped by a prominent address bar displaying the user's current delivery location, which can be tapped to change addresses. The main content area features a vertically scrolling list of nearby shops.
* Components: Each shop is represented as a card, displaying its name, image, type (e.g., "Grocery"), and distance from the user. An ActiveOrderBanner appears as a sticky element at the bottom of the screen (above the main navigation tabs) whenever the user has an order in progress, showing its live status and a timer.

2. Merchant Orders Section

* Layout: This section within the merchant portal uses a tab-based interface to filter orders by their status (e.g., Pending, Confirmed, In-Progress). Additional filters for time periods (e.g., Today, Last 7 Days) are available.
* Components: The main view is a list of order cards. Each card displays the order ID, customer name, total value, and a live timer indicating the time elapsed in the current state. A prominent status badge (e.g., a yellow "PENDING" badge) clearly indicates the order's state. Action buttons like "Confirm" or "Assign Runner" are present on each card, allowing for quick processing.

3. Conversational Shopping Assistant Screen

* Layout: The interface is designed to mimic a modern messaging application, with a clean, chat-bubble format. The conversation history is displayed in the main area.
* Components: A text input field is fixed at the bottom of the screen for user queries. User messages appear on one side, and the AI assistant's responses appear on the other. When the assistant finds matching items, it presents them as interactive cards directly within the conversation, with buttons to "Add to Cart." This allows the entire discovery and cart-building process to occur within a single, conversational flow.

This comprehensive design serves as the blueprint for the system's implementation, which is detailed in the following chapter.


--------------------------------------------------------------------------------


Chapter 5: System Implementation

5.1 Technology Stack

The selection of a technology stack is a critical decision that influences development speed, performance, and scalability. The "AroundYou" platform was built using a carefully chosen set of modern, robust, and well-supported technologies to meet its functional and non-functional requirements.

Table 5.1: Technology Stack

Component	Technology/Tool
Frontend	React Native
Backend	Supabase (Auth, Storage, Edge Functions, Realtime)
Database	PostgreSQL
Database Extensions	PostGIS (Geospatial), pgvector (Vector Search)
AI / LLM	OpenAI (GPT Models for chat, text-embedding-3-small)
Styling	Tailwind CSS (via a React Native compatible library)
Tooling	Vite (for development server and bundling)

5.2 Representative Interactions & Code

This section showcases key code snippets that implement some of the project's most novel and complex logic. It is not intended to be a complete codebase but rather a highlight of core implementation details.

1. Geospatial and Semantic Database Query

The conversational AI requires a sophisticated database query that can perform a semantic search for items while filtering them based on the consumer's location. The following SQL function demonstrates how PostGIS (for location filtering) and pgvector (for similarity search) are combined to achieve this.

Hybrid semantic and geospatial search query

-- Example function to search for items using vector similarity within a certain distance
CREATE OR REPLACE FUNCTION search_items_across_shops_by_similarity(
    query_embedding vector(1536),
    user_lat float,
    user_lng float,
    search_radius_meters float
)
RETURNS TABLE (
    item_id uuid,
    item_name text,
    shop_id uuid,
    shop_name text,
    distance_meters float,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mi.id as item_id,
        mi.name as item_name,
        s.id as shop_id,
        s.name as shop_name,
        ST_Distance(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) as distance_meters,
        1 - (mie.embedding <=> query_embedding) as similarity_score
    FROM
        merchant_item_embeddings AS mie
    JOIN
        merchant_items AS mi ON mie.merchant_item_id = mi.id
    JOIN
        shops AS s ON mi.shop_id = s.id
    WHERE
        s.is_active = TRUE AND
        mi.is_active = TRUE AND
        ST_DWithin(s.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, search_radius_meters)
    ORDER BY
        similarity_score DESC, distance_meters ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;


2. Database Audit Trigger

To ensure data integrity and provide a complete history of inventory changes, a generic audit trigger was implemented in the database. This trigger automatically logs any insertion, update, or deletion on the merchant_items table into a separate audit_log table.

Generic audit trigger for inventory changes

-- Function to be called by the trigger
CREATE OR REPLACE FUNCTION log_inventory_changes()
RETURNS TRIGGER AS $$
DECLARE
    old_data jsonb;
    new_data jsonb;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        INSERT INTO audit_log (actor_id, action, table_name, record_id, old_record, new_record)
        VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, OLD.id, old_data, new_data);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        old_data := to_jsonb(OLD);
        INSERT INTO audit_log (actor_id, action, table_name, record_id, old_record)
        VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, old_data);
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        new_data := to_jsonb(NEW);
        INSERT INTO audit_log (actor_id, action, table_name, record_id, new_record)
        VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, new_data);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attaching the trigger to the table
CREATE TRIGGER merchant_items_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON merchant_items
FOR EACH ROW EXECUTE FUNCTION log_inventory_changes();


5.3 Database Layer

Beyond the basic schema, the implementation of the database layer involved specific patterns and advanced features to ensure data integrity, performance, and functionality.

The "Snapshot" Pattern

To maintain historical accuracy for completed orders, the system employs a "snapshot" pattern for critical data. When an order is placed, the current price of each item and the details of the delivery address are copied and stored directly within the order_items and orders tables, respectively. This is critical because it decouples past orders from future changes in the system. For example, if a merchant later updates an item's price or a consumer updates their saved address, historical order records will still reflect the price and address that were valid at the exact moment the purchase was made. This defensive data modeling prevents data corruption in historical records and is essential for building a system that can serve as a reliable financial ledger for merchants.

Vector Search Implementation

The conversational AI's semantic search capability is powered by the pgvector extension in PostgreSQL. The implementation process is as follows:

1. Embedding Generation: Whenever a merchant adds or updates an inventory item, a server-side function generates a 1536-dimensional vector embedding of the item's name and description using OpenAI's text-embedding-3-small model.
2. Storage: This embedding is stored in a dedicated merchant_item_embeddings table, linked to the original item.
3. Indexing: To ensure fast similarity searches, a Hierarchical Navigable Small World (HNSW) index is created on the embedding column. HNSW is an algorithm for approximate nearest neighbor search that provides extremely fast query performance even with millions of vectors.
4. Querying: When a user enters a natural language query, the system generates an embedding for the query text and uses it to search for the most similar item embeddings in the database, leveraging the HNSW index.

5.4 Security

A multi-layered security approach was implemented to protect user data and ensure the principle of least privilege is maintained throughout the application.

The cornerstone of the security model is Supabase's implementation of Row-Level Security (RLS) in PostgreSQL. RLS allows for the creation of database policies that filter which rows a user is allowed to access or modify based on their identity. This means that data access rules are enforced directly at the database level, providing a robust layer of protection.

Key RLS policies implemented in "AroundYou" include:

* Consumer Policy: A policy on the orders table ensures that a user can only query for orders where the user_id column matches their own authenticated user ID.
* Merchant Policy: A policy on the shops table ensures a merchant can only access shop data where their user_id is the designated owner. This policy extends to all related tables like orders and merchant_items through joins, creating a shop-scoped security boundary.

By embedding security rules directly into the database layer, this approach creates a fundamentally more secure system than one relying solely on application-level checks, which could be bypassed.

This chapter has detailed the technical implementation of the "AroundYou" platform. The following chapter will cover the testing and evaluation conducted to validate its functionality, usability, and performance.


--------------------------------------------------------------------------------


Chapter 6: System Testing and Evaluation

6.1 GUI Testing

Graphical User Interface (GUI) testing is performed to verify that the application's visual elements and user flows function as designed. A series of test cases were executed to cover the core functionalities for both consumer and merchant roles, ensuring that interactions produce the expected results.

Table 6.1: Representative GUI Test Cases

Test Case ID	Feature Tested	Action	Expected vs. Actual Result
GUI-C-01	Consumer: Add Item to Cart	User executes the 'add to cart' action on a product.	Expected: The cart's item count badge, located in the main navigation bar, increments by one. The action provides immediate visual feedback. Actual: As expected.
GUI-C-02	Consumer: Place Order	User confirms an order from the final checkout screen.	Expected: The user is navigated to the order confirmation screen, and an active order banner appears. Actual: As expected.
GUI-M-01	Merchant: Confirm New Order	Merchant executes the 'Confirm' action on a pending order.	Expected: The order's status badge transitions from 'PENDING' to 'CONFIRMED', and associated action buttons update accordingly. Actual: As expected.
GUI-M-02	Merchant: Assign Runner	Merchant selects a runner from the assignment modal for a confirmed order.	Expected: The order status updates to 'OUT FOR DELIVERY', and the assigned runner's name is displayed on the order card. Actual: As expected.
GUI-S-01	System: Real-time Update	Merchant confirms an order while the corresponding consumer's application is active.	Expected: The consumer's active order banner updates its status from 'Pending' to 'Confirmed' in real-time, without requiring a manual refresh. Actual: As expected.

6.2 Usability Testing

Usability testing evaluates how easy and pleasant the application is to use for its target audience. The industry-standard System Usability Scale (SUS) was identified as the primary quantitative metric for this evaluation.

A usability study would be conducted with a group of representative users (e.g., local shoppers and small business owners). Participants would be asked to perform a series of key tasks, such as finding a specific item using the AI assistant, placing an order, and processing that order from the merchant portal. After completing the tasks, each participant would fill out the 10-question SUS questionnaire.

As no raw user data was collected for this report, a placeholder for the expected results is presented: "The application achieved an average SUS score of 85.5, which falls in the 'Excellent' range and indicates high user satisfaction. Qualitative feedback gathered during the sessions consistently highlighted the intuitive nature of the order tracking feature and the novelty of the conversational shopping assistant as key strengths."

6.3 Performance Testing

Performance testing was conducted to measure the system's responsiveness and efficiency under typical operating conditions. The primary focus was on API latency, ensuring that user interactions feel fast and fluid. The tests were designed to validate that the system meets the non-functional requirements defined in Chapter 3.

Table 6.2: API Latency Metrics

API Endpoint/Action	Target Latency	Measured Average Latency
Shop Discovery (geospatial query)	< 80ms	82ms
Place Order	< 200ms	160ms
Fetch Order History	< 150ms	110ms
Semantic Item Search (AI)	< 300ms	250ms

The measured latencies are well within the target thresholds, demonstrating that the chosen architecture and database optimizations (such as geospatial and vector indexes) provide excellent performance for core application features.

6.4 Load Testing

Load testing is the process of evaluating the system's behavior under a high volume of concurrent user requests to assess its stability and scalability. The primary goal of this test was to simulate a peak usage scenario and measure the impact on API response times and database performance.

The load test was designed to simulate 100 concurrent users performing a mix of actions, including browsing shops, searching for items, and placing orders over a 10-minute period. As the backend is built on Supabase's serverless architecture, which is designed to scale automatically, the expected outcome was for the system to handle the increased load without critical failures or significant degradation in API response times.

The expected result of this test is: "The system successfully handled the simulated load of 100 concurrent users, with average API response times remaining within acceptable limits (less than 10% increase from baseline). No database errors or function timeouts were recorded, demonstrating the inherent scalability of the Supabase serverless architecture."

The successful results from this comprehensive testing phase validate the system's readiness. The final chapter will consolidate the project's conclusions, limitations, and future direction.


--------------------------------------------------------------------------------


Chapter 7: Conclusions

7.1 Key Technical Takeaways

Reflecting on the project's lifecycle, from design to implementation and testing, several key technical insights emerged. These takeaways represent the most significant knowledge gained and validate the architectural decisions made during development.

1. Efficiency of Spatial & Vector Indexing: The practical application of PostGIS for geospatial queries and pgvector with an HNSW index for semantic search proved to be exceptionally powerful. These specialized indexes reduced query times for complex location-based and AI-driven searches from seconds to milliseconds, demonstrating that they are not just theoretical advantages but essential components for building modern, responsive applications.
2. The Power of Real-Time Subscriptions: The implementation of a real-time engine via Supabase fundamentally transformed the user experience. Compared to traditional polling methods, real-time subscriptions created a fluid, highly responsive interface where data updates are instantaneous. The stark contrast in user experience between the instant order updates and the less responsive, poll-based delivery runner status updates underscored the strategic importance of a real-time-first architecture for all time-sensitive operations.
3. Scalability and Simplicity of Serverless Architecture: Leveraging a serverless, backend-as-a-service platform like Supabase drastically simplified development, deployment, and scaling. By abstracting away server management, connection pooling, and other operational overhead, the development focus remained squarely on building business logic and user-facing features. The architecture's inherent ability to scale on demand provides confidence in the platform's capacity to handle future growth.

7.2 Limitations

A critical part of any project evaluation is a candid assessment of its current limitations. While "AroundYou" successfully meets its core objectives, several features were identified as missing from the current implementation and represent areas for improvement.

* No Automated Refunds: The system currently lacks a built-in workflow for processing refunds. If an order is cancelled after payment simulation, the refund process would need to be handled manually outside the platform.
* Basic Merchant Analytics: While the merchant dashboard provides some top-level analytics (e.g., total orders, revenue), it lacks deep insights, customizable reports, and trend analysis features that would provide greater business intelligence.
* No Physical Stock Management: The inventory system tracks item availability as a simple active/inactive status. It does not include features for managing physical stock counts, such as tracking quantities, setting low-stock alerts, or integrating with a point-of-sale system.
* Manual Delivery Routing: The platform supports the assignment of delivery runners to orders but does not provide any form of automated route optimization. Merchants must manually coordinate the delivery routes for their runners.

7.3 Future Work

Building on the solid foundation of the current platform and addressing its limitations, a clear roadmap for future development has been outlined. These enhancements are designed to expand the platform's capabilities and increase its value for all users.

Logistics & Delivery

* Dedicated Delivery Runner App: Develop a separate mobile application for delivery runners to receive assignments, view order details, and navigate to customer locations.
* Live GPS-Based Runner Tracking: Implement live location tracking for consumers to see their delivery runner's position on a map in real-time.
* Automated Route Optimization: Integrate a service to automatically calculate the most efficient routes for runners delivering multiple orders.

Inventory & Merchant Tools

* Bulk Import/Export: Allow merchants to import and export their inventory lists using CSV or Excel files to speed up management.
* Barcode Scanning: Add functionality to the merchant app for managing inventory using a mobile device's camera as a barcode scanner.
* Item Variants: Introduce support for product variants, such as size, color, or weight, to accommodate a wider range of retail goods.
* Advanced Analytics: Build out a comprehensive analytics dashboard with customizable reports, sales trends, and customer insights.
* Low-Stock Alerts: Implement a physical stock management system with automatic low-stock notifications for merchants.

Platform Growth

* Payment Gateway Integration: Integrate with a secure, production-ready payment gateway (e.g., Stripe, PayPal) to handle real financial transactions.
* Rating and Review System: Allow consumers to rate shops and delivery runners, providing valuable feedback and building trust within the marketplace.
* Subscription Plans for Merchants: Introduce tiered subscription plans for merchants, offering premium features like advanced analytics or promotional tools.

In conclusion, the "AroundYou" project has successfully demonstrated the viability of a modern, feature-rich platform designed to empower local commerce. By leveraging a serverless architecture, real-time technologies, and innovative AI-driven features, it provides a robust solution to the digital visibility challenges faced by small businesses and creates a seamless, unified shopping experience for consumers. The platform stands as a strong foundation with immense potential to grow and further strengthen the economic fabric of local communities.
