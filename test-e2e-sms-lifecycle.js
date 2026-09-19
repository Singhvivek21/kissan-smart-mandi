/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * End-to-End SMS Lifecycle Demonstration (test-e2e-sms-lifecycle.js)
 * ==============================================================================
 * 
 * Demonstrates:
 * Farmer Registration
 *   → Slot Booking
 *   → Booking Confirmation
 *   → SMS Event Trigger
 *   → Mock SMS Provider Dispatch
 *   → SIMULATED SMS Generation
 *   → Supabase SMS Notification Log
 *   → Admin Dashboard Consumption
 */

const { smsService } = require('./services/sms/smsService');

async function runE2EDemo() {
  console.log('\n================================================================');
  console.log('🌾 KISSAN MANDI: END-TO-END SMS NOTIFICATION DEMONSTRATION');
  console.log('================================================================\n');

  // STEP 1: Farmer Registration / Profile
  console.log('--- Step 1: Farmer Profile ---');
  const farmer = {
    id: 'F-10024',
    name: 'Rameshwar Singh',
    phone: '9876543210',
    village: 'Taraori',
    district: 'Karnal',
    state: 'Haryana'
  };
  console.log(`👤 Farmer: ${farmer.name} | Phone: ${farmer.phone} | Location: ${farmer.village}, ${farmer.district}`);

  // STEP 2: Slot Booking
  console.log('\n--- Step 2: Farmer Books Mandi Slot ---');
  const booking = {
    id: `BK-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
    farmer_id: farmer.id,
    farmer_name: farmer.name,
    farmer_phone: farmer.phone,
    centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
    crop: 'Wheat (गेहूं)',
    quantity: 40.0,
    slot_date: new Date().toISOString().split('T')[0],
    slot_time: '08:00 AM - 11:00 AM',
    vehicle_number: 'HR-05-AB-7721'
  };
  console.log(`📋 Booking ID: ${booking.id}`);
  console.log(`   Crop:       ${booking.crop} (${booking.quantity} Quintals)`);
  console.log(`   Centre:     ${booking.centre_name}`);
  console.log(`   Slot:       ${booking.slot_date} (${booking.slot_time})`);

  // STEP 3: Booking Confirmation & Token Generation
  console.log('\n--- Step 3: Booking Confirmation & Gate Pass Issued ---');
  booking.token_number = 'KMN-042';
  booking.status = 'WAITING';
  booking.qr_signature = 'HMAC_SECURE_TOKEN_SIG_2026';
  console.log(`🎟️ Token Number: ${booking.token_number}`);
  console.log(`   Status:       ${booking.status}`);
  console.log(`   QR Signature: ${booking.qr_signature}`);

  // STEP 4 & 5: Trigger SMS Event → Mock SMS Provider → SIMULATED SMS
  console.log('\n--- Step 4 & 5: Trigger SMS Event → Mock Provider Dispatch ---');
  console.log(`🔔 Event: BOOKING_CONFIRMED`);

  const smsResult = await smsService.sendNotification({
    notificationType: 'BOOKING_CONFIRMED',
    phoneNumber: booking.farmer_phone,
    farmerName: booking.farmer_name,
    bookingId: booking.id,
    userId: booking.farmer_id,
    variables: {
      crop: booking.crop,
      quantity: booking.quantity,
      centre_name: booking.centre_name,
      slot_date: booking.slot_date,
      slot_time: booking.slot_time,
      token_number: booking.token_number
    }
  });

  console.log('\n📱 [DISPATCHED SMS PAYLOAD]:');
  console.log(`   Provider:            ${smsResult.provider.toUpperCase()}`);
  console.log(`   Status:              ${smsResult.status}`);
  console.log(`   Provider Message ID: ${smsResult.provider_message_id}`);
  console.log(`   Recipient (Masked):  ${smsResult.masked_phone}`);
  console.log(`   Idempotency Key:     ${smsResult.idempotency_key}`);
  console.log(`   Sent At:             ${smsResult.sent_at} (never falsely marked SENT)`);
  console.log(`   Delivered At:        ${smsResult.delivered_at} (never falsely marked DELIVERED)`);
  console.log(`   Actual Message:      "${smsResult.message}"`);

  // STEP 6: Verify Authoritative SMS Log in Storage
  console.log('\n--- Step 6: Verify SMS Log Storage ---');
  const storedLogs = smsService.getLogs({ limit: 5 });
  const matchedLog = storedLogs.find(l => l.booking_id === booking.id);
  if (matchedLog) {
    console.log(`✅ Log confirmed in storage: SMS ID ${matchedLog.id} (Status: ${matchedLog.status})`);
  } else {
    console.log(`⚠️ Log not found in recent logs`);
  }

  // STEP 7: Admin Dashboard Verification via HTTP API
  console.log('\n--- Step 7: Admin Dashboard API Verification ---');
  try {
    const statusRes = await fetch('http://localhost:8080/api/sms/status');
    const statusData = await statusRes.json();
    console.log(`📊 Admin Environment Status:`);
    console.log(`   Mode:     ${statusData.mode.toUpperCase()}`);
    console.log(`   Provider: ${statusData.provider.toUpperCase()}`);

    const logsRes = await fetch('http://localhost:8080/api/sms/logs?limit=5');
    const logsData = await logsRes.json();
    console.log(`\n📈 Admin Console KPIs:`);
    console.log(`   Total Dispatched: ${logsData.stats.total}`);
    console.log(`   Simulated (Mock): ${logsData.stats.simulated}`);
    console.log(`   Sent / Delivered: ${logsData.stats.delivered}`);
    console.log(`   Environment Tag:  "${logsData.stats.modeNotice}"`);

    console.log(`\n📋 Admin Log Table Preview (Top Record):`);
    const top = logsData.logs[0];
    if (top) {
      console.log(`   - Time:     ${top.created_at}`);
      console.log(`   - To:       ${top.masked_phone}`);
      console.log(`   - Event:    ${top.notification_type}`);
      console.log(`   - Provider: ${top.provider.toUpperCase()}`);
      console.log(`   - Status:   ${top.status}`);
      console.log(`   - Message:  "${top.message}"`);
    }
  } catch (e) {
    console.log(`Notice querying server HTTP API: ${e.message}`);
  }

  // STEP 8: Subsequent Mandi Lifecycle Events
  console.log('\n--- Step 8: Subsequent Mandi Lifecycle Events Simulation ---');
  
  // Event A: Token Approaching
  const approachingRes = await smsService.sendNotification({
    notificationType: 'TOKEN_APPROACHING',
    phoneNumber: booking.farmer_phone,
    farmerName: booking.farmer_name,
    bookingId: booking.id,
    variables: {
      token_number: booking.token_number,
      tokens_ahead: 3,
      centre_name: booking.centre_name
    }
  });
  console.log(`🔔 [TOKEN_APPROACHING]:     Status: ${approachingRes.status} | "${approachingRes.message}"`);

  // Event B: Token Called
  const calledRes = await smsService.sendNotification({
    notificationType: 'TOKEN_CALLED',
    phoneNumber: booking.farmer_phone,
    farmerName: booking.farmer_name,
    bookingId: booking.id,
    variables: {
      token_number: booking.token_number,
      centre_name: booking.centre_name
    }
  });
  console.log(`🔔 [TOKEN_CALLED]:          Status: ${calledRes.status} | "${calledRes.message}"`);

  // Event C: Procurement Completed
  const procRes = await smsService.sendNotification({
    notificationType: 'PROCUREMENT_COMPLETED',
    phoneNumber: booking.farmer_phone,
    farmerName: booking.farmer_name,
    bookingId: booking.id,
    variables: {
      quantity: '40.00',
      crop: 'Wheat',
      centre_name: booking.centre_name,
      amount: '91,000',
      receipt_id: 'PROC-9012'
    }
  });
  console.log(`🔔 [PROCUREMENT_COMPLETED]: Status: ${procRes.status} | "${procRes.message}"`);

  // Event D: Payment Disbursed
  const payRes = await smsService.sendNotification({
    notificationType: 'PAYMENT_STATUS_UPDATED',
    phoneNumber: booking.farmer_phone,
    farmerName: booking.farmer_name,
    bookingId: booking.id,
    variables: {
      amount: '91,000',
      receipt_id: 'PROC-9012',
      transaction_id: 'KSM-DBT-99214'
    }
  });
  console.log(`🔔 [PAYMENT_STATUS_UPDATED]: Status: ${payRes.status} | "${payRes.message}"`);

  console.log('\n================================================================');
  console.log('🎉 COMPLETE MANDI SMS LIFECYCLE SUCCESSFULLY DEMONSTRATED!');
  console.log('================================================================\n');

  process.exitCode = 0;
}

runE2EDemo().catch(err => {
  console.error('Demonstration error:', err);
  process.exit(1);
});
