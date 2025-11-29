/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Please ensure these are set in your .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Verify a merchant by their email address
 * This script updates the merchant_accounts table to set status to 'verified'
 * 
 * Usage: node scripts/verify-merchant-by-email.js <email>
 * Example: node scripts/verify-merchant-by-email.js merchant@example.com
 */
async function verifyMerchantByEmail(email) {
  if (!email) {
    console.error('Error: Email address is required.');
    console.log('\nUsage: node scripts/verify-merchant-by-email.js <email>');
    console.log('Example: node scripts/verify-merchant-by-email.js merchant@example.com');
    process.exit(1);
  }

  console.log(`\n🔍 Looking up merchant with email: ${email}...\n`);

  try {
    // First, find the user by email in user_profiles table
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    if (profileError || !userProfile) {
      console.error(`❌ Error: Could not find user with email "${email}"`);
      console.error('   Make sure the email is correct and the user exists.');
      if (profileError) {
        console.error('   Error details:', profileError.message);
      }
      process.exit(1);
    }

    console.log(`✅ Found user: ${userProfile.email} (ID: ${userProfile.id})`);

    // Find the merchant account for this user
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('*')
      .eq('user_id', userProfile.id)
      .single();

    if (merchantError || !merchantAccount) {
      console.error(`❌ Error: No merchant account found for user "${email}"`);
      console.error('   This user may not have a merchant account yet.');
      process.exit(1);
    }

    console.log(`\n📋 Current merchant account status: ${merchantAccount.status}`);
    if (merchantAccount.name_as_per_cnic) {
      console.log(`   Name as per CNIC: ${merchantAccount.name_as_per_cnic}`);
    }
    if (merchantAccount.cnic) {
      console.log(`   CNIC: ${merchantAccount.cnic}`);
    }
    if (merchantAccount.cnic_expiry) {
      console.log(`   CNIC Expiry: ${merchantAccount.cnic_expiry}`);
    }

    // Check if already verified
    if (merchantAccount.status === 'verified') {
      console.log('\n✅ This merchant is already verified.');
      process.exit(0);
    }

    // Update the merchant account status to verified
    const { data: updatedAccount, error: updateError } = await supabase
      .from('merchant_accounts')
      .update({ 
        status: 'verified',
        updated_at: new Date().toISOString()
      })
      .eq('id', merchantAccount.id)
      .select()
      .single();

    if (updateError || !updatedAccount) {
      console.error(`❌ Error: Failed to update merchant account`);
      console.error('   Error details:', updateError);
      process.exit(1);
    }

    console.log('\n✅ Success! Merchant account has been verified.');
    console.log(`   Status changed from "${merchantAccount.status}" to "verified"`);
    console.log(`   Merchant ID: ${updatedAccount.id}`);
    console.log(`\n🎉 Shops belonging to this merchant are now visible to consumers.`);

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

// Run the verification
verifyMerchantByEmail(email);

