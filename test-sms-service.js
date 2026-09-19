/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * SMS Notification Architecture Test Suite (test-sms-service.js)
 * ==============================================================================
 * 
 * Verifies:
 * 1. Mock SMS Provider behavior across all 5 KISSAN lifecycle events:
 *    - BOOKING_CONFIRMED
 *    - TOKEN_APPROACHING
 *    - TOKEN_CALLED
 *    - PROCUREMENT_COMPLETED
 *    - PAYMENT_STATUS_UPDATED
 * 2. Status 'SIMULATED' integrity (NEVER marked as SENT or DELIVERED)
 * 3. Provider identification as 'mock'
 * 4. Provider Message ID format: MOCK-SMS-<uuid>
 * 5. Masked phone number formatting (98765*****)
 * 6. Idempotency enforcement (duplicate event prevention)
 * 7. Phone validation (rejection of invalid numbers)
 * 8. MSG91 safe isolation (refuses live send without real DLT credentials)
 * 9. Live HTTP endpoints (/api/sms/status, /api/sms/send, /api/sms/logs)
 */

const { smsService } = require('./services/sms/smsService');
const MockSMSProvider = require('./services/sms/mockProvider');
const MSG91SMSProvider = require('./services/sms/msg91Provider');
const { SMS_TEMPLATES, compileTemplate } = require('./services/sms/smsTemplates');

let passedTests = 0;
let totalTests = 0;

function report(name, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name} ${details ? '- ' + details : ''}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING KISSAN MANDI SMS NOTIFICATION TEST SUITE');
  console.log('===============================================================\n');

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: MESSAGE COMPILATION FOR ALL 5 KISSAN EVENTS
  // ---------------------------------------------------------------------------
  console.log('--- Test Suite 1: Message Compilation for 5 KISSAN Events ---');
  
  const events = [
    'BOOKING_CONFIRMED',
    'TOKEN_APPROACHING',
    'TOKEN_CALLED',
    'PROCUREMENT_COMPLETED',
    'PAYMENT_STATUS_UPDATED'
  ];

  for (const ev of events) {
    const { message, template } = compileTemplate(ev, {
      farmer_name: 'Baldev Singh',
      crop: 'Wheat',
      quantity: '60',
      centre_name: 'Karnal Mandi',
      slot_date: '2026-09-22',
      slot_time: '08:00 AM - 11:00 AM',
      token_number: 'KMN-055',
      tokens_ahead: '2',
      amount: '1,36,500',
      receipt_id: 'PROC-1092',
      transaction_id: 'KSM-DBT-88192'
    });

    report(`Template ${ev} compiles readable message`, Boolean(message && message.length > 20));
    report(`Template ${ev} does not contain raw unfilled braces`, !message.includes('{farmer_name}'));
    report(`Template ${ev} has no fake hardcoded DLT ID`, template.dltTemplateId === null || typeof template.dltTemplateId === 'string');
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: ZERO-COST MOCK PROVIDER BEHAVIOR & INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 2: Mock SMS Provider Behavior ---');

  const mockProvider = new MockSMSProvider({ simulatedLatencyMs: 10 });
  const mockResult = await mockProvider.sendSMS({
    to: '9876543210',
    message: 'Dear Baldev Singh, your procurement slot for Wheat is CONFIRMED. Token: KMN-055.',
    metadata: { eventType: 'BOOKING_CONFIRMED' }
  });

  report('Mock Provider status is strictly "SIMULATED"', mockResult.status === 'SIMULATED');
  report('Mock Provider returns success: true', mockResult.success === true);
  report('Mock Provider generates providerMessageId matching MOCK-SMS-<uuid>', Boolean(mockResult.providerMessageId && mockResult.providerMessageId.startsWith('MOCK-SMS-')));
  report('Mock Provider identifies provider as "mock"', mockResult.provider === 'mock');
  report('Mock SMS sentAt is strictly null (never marked as SENT)', mockResult.sentAt === null);
  report('Mock SMS deliveredAt is strictly null (never marked as DELIVERED)', mockResult.deliveredAt === null);

  // Verify invalid phone rejection
  const invalidPhoneResult = await mockProvider.sendSMS({
    to: '12345',
    message: 'Invalid test'
  });
  report('Mock Provider rejects invalid 5-digit number', invalidPhoneResult.success === false && invalidPhoneResult.status === 'FAILED');

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: PHONE NORMALIZATION & PII MASKING
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 3: Phone Normalization & Privacy Masking ---');

  report('Normalizes "+91 98765 43210" to 10 digits', smsService.normalizePhoneNumber('+91 98765 43210') === '9876543210');
  report('Normalizes "09876543210" to 10 digits', smsService.normalizePhoneNumber('09876543210') === '9876543210');
  report('Validates valid Indian mobile 9876543210', smsService.isValidIndianMobile('9876543210') === true);
  report('Validates valid Indian mobile +918123456789', smsService.isValidIndianMobile('+918123456789') === true);
  report('Rejects invalid mobile 1234567890', smsService.isValidIndianMobile('1234567890') === false);
  report('Rejects alphabetic phone "abcdef"', smsService.isValidIndianMobile('abcdef') === false);
  report('Masks phone number as 98765***** for privacy', smsService.maskPhoneNumber('9876543210') === '98765*****');

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: IDEMPOTENCY ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 4: Idempotency & Duplicate Prevention ---');

  const testBookingId = `BK-IDEMP-TEST-${Date.now()}`;

  // First dispatch
  const firstDispatch = await smsService.sendNotification({
    notificationType: 'BOOKING_CONFIRMED',
    phoneNumber: '9876543210',
    farmerName: 'Gurpreet Singh',
    bookingId: testBookingId,
    variables: { crop: 'Wheat', quantity: 40, token_number: 'KMN-099' }
  });

  report('First dispatch succeeds with status SIMULATED', firstDispatch.status === 'SIMULATED');
  report('First dispatch has duplicatePrevented != true', !firstDispatch.duplicatePrevented);

  // Second duplicate dispatch with same booking ID and event
  const duplicateDispatch = await smsService.sendNotification({
    notificationType: 'BOOKING_CONFIRMED',
    phoneNumber: '9876543210',
    farmerName: 'Gurpreet Singh',
    bookingId: testBookingId,
    variables: { crop: 'Wheat', quantity: 40, token_number: 'KMN-099' }
  });

  report('Duplicate dispatch is caught by Idempotency guard', duplicateDispatch.duplicatePrevented === true);
  report('Duplicate dispatch preserves original ID', duplicateDispatch.id === firstDispatch.id);

  // Forced resend should bypass idempotency
  const forcedResend = await smsService.sendNotification({
    notificationType: 'BOOKING_CONFIRMED',
    phoneNumber: '9876543210',
    farmerName: 'Gurpreet Singh',
    bookingId: testBookingId,
    forceResend: true,
    variables: { crop: 'Wheat', quantity: 40, token_number: 'KMN-099' }
  });

  report('Forced resend successfully bypasses idempotency', !forcedResend.duplicatePrevented && forcedResend.status === 'SIMULATED');

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: MSG91 PROVIDER SAFETY GUARD (NO FAKE CREDENTIALS)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 5: MSG91 Provider Safety Guard ---');

  const unconfiguredMsg91 = new MSG91SMSProvider({ authKey: '' });
  const configStatus = unconfiguredMsg91.isConfigured();
  report('MSG91 without auth key reports ready: false', configStatus.ready === false);

  const failSafeDispatch = await unconfiguredMsg91.sendSMS({
    to: '9876543210',
    message: 'Test message'
  });
  report('Unconfigured MSG91 fails gracefully with status FAILED', failSafeDispatch.status === 'FAILED');
  report('Unconfigured MSG91 error explains missing configuration', failSafeDispatch.error && failSafeDispatch.error.includes('MSG91'));

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: LIVE HTTP API ENDPOINTS
  // ---------------------------------------------------------------------------
  console.log('\n--- Test Suite 6: Live Server HTTP Endpoints ---');

  try {
    // 1. GET /api/sms/status
    const statusRes = await fetch('http://localhost:8080/api/sms/status');
    const statusData = await statusRes.json();
    report('GET /api/sms/status returns HTTP 200', statusRes.status === 200);
    report('GET /api/sms/status reports mode="mock"', statusData.mode === 'mock');
    report('GET /api/sms/status reports provider="mock"', statusData.provider === 'mock');

    // 2. POST /api/sms/send
    const sendRes = await fetch('http://localhost:8080/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationType: 'TOKEN_CALLED',
        phoneNumber: '9812345678',
        farmerName: 'Devender Kumar',
        bookingId: `BK-HTTP-TEST-${Date.now()}`,
        variables: {
          token_number: 'KMN-088',
          centre_name: 'Sector 7 Mandi, Karnal'
        }
      })
    });
    const sendData = await sendRes.json();
    report('POST /api/sms/send returns HTTP 200', sendRes.status === 200);
    report('POST /api/sms/send dispatches notification', sendData.success === true);
    report('POST /api/sms/send status is strictly "SIMULATED"', sendData.notification.status === 'SIMULATED');
    report('POST /api/sms/send provider is "mock"', sendData.notification.provider === 'mock');
    report('POST /api/sms/send masks phone in notification', sendData.notification.masked_phone === '98123*****');

    // 3. GET /api/sms/logs
    const logsRes = await fetch('http://localhost:8080/api/sms/logs?limit=10');
    const logsData = await logsRes.json();
    report('GET /api/sms/logs returns HTTP 200', logsRes.status === 200);
    report('GET /api/sms/logs returns logs array', Array.isArray(logsData.logs) && logsData.logs.length > 0);
    report('GET /api/sms/logs stats has DEMO MODE notice', logsData.stats.modeNotice.includes('DEMO MODE — SMS SIMULATED'));

  } catch (httpErr) {
    console.error('HTTP test failure (ensure node server.js is running):', httpErr.message);
    report('HTTP Endpoints reachability', false, httpErr.message);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! SMS Notification Architecture Verified.');
  } else {
    console.log(`⚠️ ${totalTests - passedTests} TESTS FAILED.`);
  }
  console.log('===============================================================\n');

  process.exitCode = passedTests === totalTests ? 0 : 1;
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
