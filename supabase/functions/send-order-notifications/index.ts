// Supabase Edge Function: Send Order Notifications
// Sends push notifications to consumers and merchants when order status changes
// This function is called by Supabase Database Webhooks when orders table changes

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { initializeApp, getApps, cert } from 'npm:firebase-admin@12.0.0/app';
import { getMessaging } from 'npm:firebase-admin@12.0.0/messaging';

console.info('send-order-notifications Edge Function started');

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    order_number?: string;
    shop_id: string;
    user_id: string;
    status: string;
    customer_name?: string;
    customer_email?: string;
    delivery_runner_id?: string;
    delivery_address?: any;
  };
  old_record?: {
    status?: string;
  };
}

interface OrderData {
  id: string;
  order_number: string;
  shop_id: string;
  user_id: string;
  status: string;
  customer_name?: string;
  customer_email?: string;
  shop?: {
    id: string;
    name: string;
  };
  delivery_runner?: {
    id: string;
    name: string;
    phone_number: string;
  };
  order_items?: Array<{
    item_name: string;
    quantity: number;
  }>;
  delivery_address?: {
    landmark?: string;
  };
}

interface NotificationToSend {
  userId: string;
  role: 'consumer' | 'merchant';
  title: string;
  body: string;
  data: Record<string, string>;
}

/**
 * Validate webhook secret from custom header
 */
function validateWebhookSecret(req: Request): boolean {
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('WEBHOOK_SECRET not configured, skipping validation');
    return true; // Allow if not configured (for backwards compatibility)
  }

  const providedSecret = req.headers.get('x-supabase-webhook-secret');
  if (!providedSecret) {
    console.warn('Webhook secret header missing');
    return false;
  }

  return providedSecret === webhookSecret;
}

/**
 * Generate unique event ID for idempotency
 */
function generateEventId(orderId: string, eventType: string, timestamp: string): string {
  return `${orderId}:${eventType}:${timestamp}`;
}

/**
 * Check if webhook event was already processed (idempotency)
 */
async function isEventProcessed(
  supabase: any,
  eventId: string
): Promise<{ processed: boolean; existingEvent?: any }> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking event idempotency:', error);
    return { processed: false };
  }

  if (data && data.status === 'completed') {
    console.info(`Event ${eventId} already processed, skipping`);
    return { processed: true, existingEvent: data };
  }

  return { processed: false };
}

/**
 * Record webhook event for idempotency tracking
 */
async function recordWebhookEvent(
  supabase: any,
  eventId: string,
  orderId: string,
  eventType: string,
  payload: any,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .upsert({
      event_id: eventId,
      order_id: orderId,
      event_type: eventType,
      status,
      payload,
      processed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
      error_message: errorMessage || null,
    }, {
      onConflict: 'event_id',
    });

  if (error) {
    console.error('Error recording webhook event:', error);
  }
}

/**
 * Store failed webhook in dead-letter queue
 */
async function storeDeadLetter(
  supabase: any,
  orderId: string,
  eventType: string,
  payload: any,
  errorMessage: string,
  errorStack?: string
): Promise<void> {
  const { error } = await supabase
    .from('webhook_dead_letters')
    .insert({
      order_id: orderId,
      event_type: eventType,
      payload,
      error_message: errorMessage,
      error_stack: errorStack,
      retry_count: 0,
    });

  if (error) {
    console.error('Error storing dead letter:', error);
  } else {
    console.error(`Stored failed webhook in dead-letter queue for order ${orderId}`);
  }
}

/**
 * Log notification attempt to audit log
 */
async function logNotification(
  supabase: any,
  orderId: string,
  userId: string,
  role: 'consumer' | 'merchant',
  notificationType: string,
  title: string,
  body: string,
  fcmToken: string | null,
  platform: string | null,
  status: 'sent' | 'failed' | 'pending',
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('notification_audit_log')
    .insert({
      order_id: orderId,
      user_id: userId,
      role,
      notification_type: notificationType,
      title,
      body,
      fcm_token: fcmToken,
      platform,
      status,
      error_message: errorMessage || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });

  if (error) {
    console.error('Error logging notification:', error);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-webhook-secret',
      } 
    });
  }

  let eventId: string | null = null;
  let orderId: string | null = null;
  let eventType: string | null = null;

  try {
    // Validate webhook secret (security)
    if (!validateWebhookSecret(req)) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' }
        }
      );
    }

    // Initialize Supabase Admin client (using service role key)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Firebase Admin
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');

    if (!firebaseProjectId || !firebasePrivateKey || !firebaseClientEmail) {
      throw new Error('Missing Firebase configuration');
    }

    let app;
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          privateKey: firebasePrivateKey,
          clientEmail: firebaseClientEmail,
        }),
      });
    } else {
      app = getApps()[0];
    }

    const messaging = getMessaging(app);

    // Parse webhook payload from Supabase Database Webhook
    const payload: WebhookPayload = await req.json();
    const { type, record, old_record } = payload;

    if (!record || !record.id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: record.id' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' }
        }
      );
    }

    orderId = record.id;
    eventType = type;
    const timestamp = new Date().toISOString();
    eventId = generateEventId(orderId, eventType, timestamp);

    console.info(`Received ${eventType} event for order ${orderId}`);

    // Check idempotency - skip if already processed
    const { processed, existingEvent } = await isEventProcessed(supabase, eventId);
    if (processed) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Event already processed',
          eventId: existingEvent?.id 
        }),
        { 
          headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' }
        }
      );
    }

    // Record event as processing
    await recordWebhookEvent(supabase, eventId, orderId, eventType, payload, 'processing');

    const status = record.status;
    const previous_status = old_record?.status;

    // Filter UPDATE events - only process if status actually changed
    if (eventType === 'UPDATE') {
      if (!previous_status || previous_status === status) {
        console.info(`Status unchanged for order ${orderId}, skipping notification`);
        await recordWebhookEvent(supabase, eventId, orderId, eventType, payload, 'completed');
        return new Response(
          JSON.stringify({ success: true, message: 'Status unchanged, no notification needed' }),
          { 
            headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' }
          }
        );
      }
    }

    // Fetch order details with relations
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        shop_id,
        user_id,
        status,
        customer_name,
        customer_email,
        delivery_runner_id,
        shop:shops(id, name),
        delivery_runner:delivery_runners(id, name, phone_number),
        order_items(id, item_name, quantity),
        delivery_address
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      const errorMsg = `Order not found: ${orderError?.message || 'Unknown error'}`;
      console.error(errorMsg);
      await recordWebhookEvent(supabase, eventId, orderId, eventType, payload, 'failed', errorMsg);
      await storeDeadLetter(supabase, orderId, eventType, payload, errorMsg);
      
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            'Connection': 'keep-alive',
          }
        }
      );
    }

    const orderData = order as unknown as OrderData;

    // Determine notification recipients and format messages
    const notifications: NotificationToSend[] = [];

    // Consumer notifications (for status changes)
    if (eventType === 'UPDATE' && previous_status && previous_status !== status) {
      const { data: consumerPref } = await supabase
        .from('notification_preferences')
        .select('allow_push_notifications')
        .eq('user_id', orderData.user_id)
        .eq('role', 'consumer')
        .single();

      if (consumerPref?.allow_push_notifications !== false) {
        let title = '';
        let body = '';
        const data: Record<string, string> = {
          type: 'order_status',
          orderId: orderData.id,
          status: status,
        };

        if (status === 'confirmed' && previous_status === 'pending') {
          title = 'Order Accepted';
          body = 'Your order is being prepared';
        } else if (status === 'out_for_delivery' && previous_status === 'confirmed') {
          const runnerName = orderData.delivery_runner?.name || 'Your delivery runner';
          title = 'Order Out for Delivery';
          body = `${runnerName} is on the way with your order`;
          if (orderData.delivery_runner?.phone_number) {
            data.runnerPhone = orderData.delivery_runner.phone_number;
          }
          if (orderData.delivery_runner?.name) {
            data.runnerName = orderData.delivery_runner.name;
          }
        } else if (status === 'delivered' && previous_status === 'out_for_delivery') {
          title = 'Order Delivered';
          body = 'Your order has been delivered. Enjoy!';
        } else if (status === 'cancelled') {
          title = 'Order Cancelled';
          body = 'Your order has been cancelled';
        }

        if (title && body) {
          notifications.push({
            userId: orderData.user_id,
            role: 'consumer',
            title,
            body,
            data,
          });
        }
      }
    }

    // Merchant notifications
    if (eventType === 'INSERT' || (status === 'cancelled' && previous_status !== 'cancelled')) {
      const { data: shop } = await supabase
        .from('shops')
        .select('merchant_id')
        .eq('id', orderData.shop_id)
        .single();

      if (shop && shop.merchant_id) {
        const { data: merchantAccount } = await supabase
          .from('merchant_accounts')
          .select('user_id')
          .eq('id', shop.merchant_id)
          .single();

        if (!merchantAccount) {
          console.error('Merchant account not found for shop:', orderData.shop_id);
        } else {
          const merchantUserId = merchantAccount.user_id;

          const { data: merchantPref } = await supabase
            .from('notification_preferences')
            .select('allow_push_notifications')
            .eq('user_id', merchantUserId)
            .eq('role', 'merchant')
            .single();

          if (merchantPref?.allow_push_notifications !== false) {
            let title = '';
            let body = '';
            const data: Record<string, string> = {
              orderId: orderData.id,
              shopId: orderData.shop_id,
            };

            if (eventType === 'INSERT') {
              const shopName = orderData.shop?.name || 'Your shop';
              const customerName = orderData.customer_name || orderData.customer_email || 'Customer';
              
              let itemSummary = 'Items: ';
              if (orderData.order_items && orderData.order_items.length > 0) {
                const items = orderData.order_items.slice(0, 5);
                itemSummary += items.map(item => `${item.item_name} (${item.quantity})`).join(', ');
                if (orderData.order_items.length > 5) {
                  itemSummary += ` and ${orderData.order_items.length - 5} more`;
                }
              } else {
                itemSummary += 'N/A';
              }

              const landmark = (orderData.delivery_address as any)?.landmark;
              if (landmark) {
                body = `Customer: ${customerName} | Landmark: ${landmark} | ${itemSummary}`;
              } else {
                body = `Customer: ${customerName} | ${itemSummary}`;
              }

              title = `New Order: ${shopName}`;
              data.type = 'new_order';
              if (customerName) data.customerName = customerName;
              if (landmark) data.landmark = landmark;
            } else if (status === 'cancelled') {
              title = 'Order Cancelled';
              body = `Order ${orderData.order_number} cancelled by customer`;
              data.type = 'order_cancelled';
            }

            if (title && body) {
              notifications.push({
                userId: merchantUserId,
                role: 'merchant',
                title,
                body,
                data,
              });
            }
          }
        }
      }
    }

    // Send notifications to all recipients
    const results = [];
    for (const notification of notifications) {
      const { data: tokens, error: tokensError } = await supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', notification.userId);

      if (tokensError || !tokens || tokens.length === 0) {
        console.log(`No device tokens found for user ${notification.userId}`);
        await logNotification(
          supabase,
          orderId,
          notification.userId,
          notification.role,
          notification.data.type || 'unknown',
          notification.title,
          notification.body,
          null,
          null,
          'failed',
          'No device tokens found'
        );
        continue;
      }

      for (const tokenData of tokens) {
        try {
          const message: any = {
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: {
              ...Object.fromEntries(
                Object.entries(notification.data).map(([k, v]) => [k, String(v)])
              ),
            },
            token: tokenData.token,
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'order_notifications',
              },
            },
          };

          await messaging.send(message);
          results.push({ success: true, userId: notification.userId, token: tokenData.token });
          
          await logNotification(
            supabase,
            orderId,
            notification.userId,
            notification.role,
            notification.data.type || 'unknown',
            notification.title,
            notification.body,
            tokenData.token,
            tokenData.platform,
            'sent'
          );
        } catch (error: any) {
          console.error(`Error sending notification to token ${tokenData.token}:`, error);
          results.push({ success: false, userId: notification.userId, error: String(error) });
          
          await logNotification(
            supabase,
            orderId,
            notification.userId,
            notification.role,
            notification.data.type || 'unknown',
            notification.title,
            notification.body,
            tokenData.token,
            tokenData.platform,
            'failed',
            error.message || String(error)
          );
        }
      }
    }

    // Mark event as completed
    await recordWebhookEvent(supabase, eventId!, orderId!, eventType!, payload, 'completed');

    const data = {
      success: true,
      notificationsSent: results.filter(r => r.success).length,
      totalNotifications: notifications.length,
      results,
    };

    console.info(`Sent ${data.notificationsSent} notification(s) for order ${orderId}`);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          'Content-Type': 'application/json', 
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  } catch (error: any) {
    console.error('Error in send-order-notifications:', error);
    
    // Record failure and store in dead-letter queue
    if (eventId && orderId && eventType) {
      const errorMsg = error.message || 'Unknown error occurred';
      const errorStack = error.stack;
      
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const payload = await req.clone().json().catch(() => ({}));
        
        await recordWebhookEvent(supabase, eventId, orderId, eventType, payload, 'failed', errorMsg);
        await storeDeadLetter(supabase, orderId, eventType, payload, errorMsg, errorStack);
      } catch (logError) {
        console.error('Error logging failure:', logError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
});
