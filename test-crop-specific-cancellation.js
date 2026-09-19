const assert = require('assert');

async function testCropSpecificCancellation() {
  console.log('===========================================================');
  console.log('TESTING CROP-SPECIFIC CANCELLATION (COTTON vs GRAM)');
  console.log('===========================================================\n');

  const multiBookingContext = {
    active_bookings: [
      {
        booking_id: 'BK-GRAM-101',
        token_number: 'KMN-041',
        crop: 'Gram / Chana (चना)',
        quantity_quintals: 35,
        slot_date: '2026-09-21',
        slot_time: '08:00 AM - 11:00 AM (Morning)',
        status: 'CONFIRMED'
      },
      {
        booking_id: 'BK-COTTON-202',
        token_number: 'KMN-044',
        crop: 'Cotton / Kapas (कपास)',
        quantity_quintals: 50,
        slot_date: '2026-09-22',
        slot_time: '11:00 AM - 02:00 PM (Noon)',
        status: 'CONFIRMED'
      }
    ],
    booking: {
      token_number: 'KMN-041',
      crop: 'Gram / Chana (चना)',
      slot_date: '2026-09-21'
    }
  };

  // Test 1: User explicitly asks "cancel for cotton"
  console.log('Test 1: User asks "cancel for cotton"');
  const res1 = await fetch('http://localhost:8080/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'cancel for cotton',
      selectedLang: 'en-IN',
      farmer: { id: 'F-10024', name: 'Rameshwar Singh', district: 'Karnal', phone: '9876543210' },
      context: multiBookingContext
    })
  });
  const data1 = await res1.json();
  console.log('  Reply:', data1.reply?.substring(0, 150));
  console.log('  Confirmation details:', data1.confirmationDetails);

  assert.strictEqual(data1.requiresConfirmation, true, 'Should require confirmation');
  assert.ok(data1.confirmationDetails, 'Should have confirmationDetails');
  assert.ok(
    data1.confirmationDetails.crop.toLowerCase().includes('cotton'),
    `Crop should be Cotton, but got: ${data1.confirmationDetails.crop}`
  );
  assert.strictEqual(
    data1.confirmationDetails.token_number,
    'KMN-044',
    `Token should be KMN-044, but got: ${data1.confirmationDetails.token_number}`
  );
  console.log('  [PASS] Correctly selected Cotton (KMN-044) and NOT Gram!\n');

  // Test 2: User explicitly asks "cancel for gram"
  console.log('Test 2: User asks "cancel for gram"');
  const res2 = await fetch('http://localhost:8080/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'cancel for gram',
      selectedLang: 'en-IN',
      farmer: { id: 'F-10024', name: 'Rameshwar Singh', district: 'Karnal', phone: '9876543210' },
      context: multiBookingContext
    })
  });
  const data2 = await res2.json();
  console.log('  Reply:', data2.reply?.substring(0, 150));
  console.log('  Confirmation details:', data2.confirmationDetails);

  assert.strictEqual(data2.requiresConfirmation, true, 'Should require confirmation');
  assert.ok(
    data2.confirmationDetails.crop.toLowerCase().includes('gram') || data2.confirmationDetails.crop.toLowerCase().includes('chana'),
    `Crop should be Gram, but got: ${data2.confirmationDetails.crop}`
  );
  assert.strictEqual(
    data2.confirmationDetails.token_number,
    'KMN-041',
    `Token should be KMN-041, but got: ${data2.confirmationDetails.token_number}`
  );
  console.log('  [PASS] Correctly selected Gram (KMN-041) and NOT Cotton!\n');

  // Test 3: User specifies token number "I want to cancel token KMN-044"
  console.log('Test 3: User specifies token number "cancel token KMN-044"');
  const res3 = await fetch('http://localhost:8080/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I want to cancel token KMN-044',
      selectedLang: 'en-IN',
      farmer: { id: 'F-10024', name: 'Rameshwar Singh', district: 'Karnal', phone: '9876543210' },
      context: multiBookingContext
    })
  });
  const data3 = await res3.json();
  assert.strictEqual(data3.requiresConfirmation, true, 'Should require confirmation');
  assert.strictEqual(data3.confirmationDetails.token_number, 'KMN-044');
  console.log('  [PASS] Correctly targeted KMN-044 by token number!\n');

  console.log('===========================================================');
  console.log('🎉 ALL CROP-SPECIFIC CANCELLATION TESTS PASSED!');
  console.log('===========================================================');
}

testCropSpecificCancellation().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
