/**
 * Script to check notification setup status
 * Run with: node scripts/check-notification-setup.js
 * 
 * This script checks:
 * 1. If device tokens are registered
 * 2. If notification preferences exist
 * 3. If the Edge Function is accessible
 * 4. If the webhook trigger exists
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNotificationSetup() {
  console.log('🔍 Checking notification setup...\n');

  // 1. Check device tokens
  console.log('1. Checking device tokens...');
  const { data: tokens, error: tokensError } = await supabase
    .from('device_tokens')
    .select('*')
    .limit(10);

  if (tokensError) {
    console.error('   ❌ Error fetching device tokens:', tokensError.message);
  } else {
    console.log(`   ✅ Found ${tokens?.length || 0} device token(s)`);
    if (tokens && tokens.length > 0) {
      tokens.forEach(token => {
        console.log(`      - User: ${token.user_id.substring(0, 8)}... | Platform: ${token.platform}`);
      });
    }
  }

  // 2. Check notification preferences
  console.log('\n2. Checking notification preferences...');
  const { data: preferences, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('*')
    .limit(10);

  if (prefsError) {
    console.error('   ❌ Error fetching preferences:', prefsError.message);
  } else {
    console.log(`   ✅ Found ${preferences?.length || 0} preference(s)`);
    if (preferences && preferences.length > 0) {
      preferences.forEach(pref => {
        console.log(`      - User: ${pref.user_id.substring(0, 8)}... | Role: ${pref.role} | Enabled: ${pref.allow_push_notifications}`);
      });
    } else {
      console.log('   ⚠️  No preferences found (defaults to enabled)');
    }
  }

  // 3. Check Edge Function (test endpoint)
  console.log('\n3. Testing Edge Function...');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-order-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: 'test',
        status: 'test',
        event_type: 'UPDATE',
      }),
    });

    if (response.status === 404) {
      console.log('   ❌ Edge Function not found (404) - Function may not be deployed');
    } else if (response.status === 400) {
      console.log('   ✅ Edge Function exists (returned 400 as expected for invalid request)');
    } else {
      console.log(`   ⚠️  Edge Function returned status: ${response.status}`);
    }
  } catch (error) {
    console.error('   ❌ Error testing Edge Function:', error.message);
  }

  // 4. Check webhook trigger
  console.log('\n4. Checking webhook trigger...');
  const { data: triggerData, error: triggerError } = await supabase.rpc('exec_sql', {
    query: `
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgname = 'order_notification_trigger';
    `,
  }).catch(() => ({ data: null, error: { message: 'Cannot check trigger via RPC' } }));

  if (triggerError) {
    console.log('   ⚠️  Cannot verify trigger status via API');
    console.log('   💡 Run this SQL query manually:');
    console.log('      SELECT * FROM pg_trigger WHERE tgname = \'order_notification_trigger\';');
  } else {
    console.log('   ✅ Trigger check completed (run SQL query to verify)');
  }

  console.log('\n✅ Setup check completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Check app logs for notification initialization');
  console.log('   2. Verify Edge Function is deployed');
  console.log('   3. Check Edge Function logs in Supabase Dashboard');
  console.log('   4. Verify Firebase credentials in Edge Function secrets');
}

checkNotificationSetup().catch(console.error);

