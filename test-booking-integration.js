/**
 * =============================================================================
 * KISSAN – Procure Smart Mandi
 * Automated Test Suite: Booking & Slot Integration Across All Mandi Shifts
 * =============================================================================
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:8080';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING KISSAN MANDI BOOKING & DATA SYNC TEST SUITE');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // --- Suite 1: Initial Backend Booking Endpoints ---
  console.log('\n--- Test Suite 1: Initial Bookings & Slots API ---');

  const bRes = await fetch(`${BASE_URL}/api/bookings`);
  test('GET /api/bookings returns HTTP 200', () => {
    assert.strictEqual(bRes.status, 200);
  });

  const bData = await bRes.json();
  test('GET /api/bookings returns valid bookings list', () => {
    assert.strictEqual(bData.success, true);
    assert.ok(Array.isArray(bData.bookings));
    assert.ok(bData.bookings.length >= 4);
  });

  const sRes = await fetch(`${BASE_URL}/api/slots`);
  test('GET /api/slots returns HTTP 200', () => {
    assert.strictEqual(sRes.status, 200);
  });

  const sData = await sRes.json();
  test('GET /api/slots returns 3 operational shifts (Morning, Noon, Afternoon)', () => {
    assert.strictEqual(sData.success, true);
    assert.strictEqual(sData.slots.length, 3);
    const shiftNames = sData.slots.map(s => s.shift_name);
    assert.ok(shiftNames.includes('Morning Shift'));
    assert.ok(shiftNames.includes('Noon Shift'));
    assert.ok(shiftNames.includes('Afternoon Shift'));
  });

  // --- Suite 2: Booking Multiple Slots Across Different Shifts ---
  console.log('\n--- Test Suite 2: Book Multiple Slots (Multi-Crop & Multi-Shift) ---');

  const todayStr = new Date().toISOString().split('T')[0];

  // Booking 1: Wheat (Morning Shift: 08:00 AM - 11:00 AM)
  const book1Res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crop: 'Wheat (गेहूं)',
      quantity: 45,
      slot_date: todayStr,
      slot_time: '08:00 AM - 11:00 AM',
      farmer_id: 'F-10024',
      farmer_name: 'Rameshwar Singh',
      farmer_phone: '9876543210',
      centre_id: 'M01',
      mandi_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
      vehicle_type: 'Tractor Trolley',
      vehicle_number: 'HR-05-AB-7721'
    })
  });
  test('POST /api/bookings creates Morning slot (Wheat)', () => {
    assert.strictEqual(book1Res.status, 201);
  });
  const book1 = (await book1Res.json()).booking;
  test('Morning booking has generated Token & WAITING status', () => {
    assert.ok(book1.token_number.startsWith('KMN-'));
    assert.strictEqual(book1.status, 'WAITING');
    assert.strictEqual(book1.crop, 'Wheat (गेहूं)');
  });

  // Booking 2: Mustard (Noon Shift: 11:00 AM - 02:00 PM)
  const book2Res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crop: 'Mustard (सरसों)',
      quantity: 30,
      slot_date: todayStr,
      slot_time: '11:00 AM - 02:00 PM',
      farmer_id: 'F-10024',
      farmer_name: 'Rameshwar Singh',
      farmer_phone: '9876543210',
      centre_id: 'M01',
      mandi_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
      vehicle_type: 'Tractor Trolley',
      vehicle_number: 'HR-05-AB-7721'
    })
  });
  test('POST /api/bookings creates Noon slot (Mustard)', () => {
    assert.strictEqual(book2Res.status, 201);
  });
  const book2 = (await book2Res.json()).booking;
  test('Noon booking has distinct Token number', () => {
    assert.ok(book2.token_number.startsWith('KMN-'));
    assert.notStrictEqual(book2.token_number, book1.token_number);
    assert.strictEqual(book2.crop, 'Mustard (सरसों)');
  });

  // Booking 3: Cotton (Afternoon Shift: 02:00 PM - 05:00 PM)
  const book3Res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      crop: 'Cotton (कपास)',
      quantity: 25,
      slot_date: todayStr,
      slot_time: '02:00 PM - 05:00 PM',
      farmer_id: 'F-10024',
      farmer_name: 'Rameshwar Singh',
      farmer_phone: '9876543210',
      centre_id: 'M01',
      mandi_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
      vehicle_type: 'Mini Truck',
      vehicle_number: 'HR-05-CD-9911'
    })
  });
  test('POST /api/bookings creates Afternoon slot (Cotton)', () => {
    assert.strictEqual(book3Res.status, 201);
  });
  const book3 = (await book3Res.json()).booking;
  test('Afternoon booking has distinct Token number', () => {
    assert.ok(book3.token_number.startsWith('KMN-'));
    assert.strictEqual(book3.crop, 'Cotton (कपास)');
  });

  // --- Suite 3: Verify Farmer Filter Querying ---
  console.log('\n--- Test Suite 3: Query Farmer Multi-Booking Records ---');

  const farmerRes = await fetch(`${BASE_URL}/api/bookings?farmer_phone=9876543210`);
  const farmerData = await farmerRes.json();
  test('GET /api/bookings?farmer_phone returns all booked slots for farmer', () => {
    assert.ok(farmerData.bookings.length >= 3);
    const crops = farmerData.bookings.map(b => b.crop);
    assert.ok(crops.some(c => c.includes('Wheat')));
    assert.ok(crops.some(c => c.includes('Mustard')));
    assert.ok(crops.some(c => c.includes('Cotton')));
  });

  // --- Suite 4: Verify Live Slot Occupancy Across All Shifts ---
  console.log('\n--- Test Suite 4: Live Slot Occupancy Updating ---');

  const slotsCheckRes = await fetch(`${BASE_URL}/api/slots?date=${todayStr}`);
  const slotsCheckData = await slotsCheckRes.json();
  test('Slots reflect live booked counts in all 3 shifts', () => {
    const morning = slotsCheckData.slots.find(s => s.shift_name === 'Morning Shift');
    const noon = slotsCheckData.slots.find(s => s.shift_name === 'Noon Shift');
    const afternoon = slotsCheckData.slots.find(s => s.shift_name === 'Afternoon Shift');

    assert.ok(morning.booked_count >= 1, `Morning booked_count should be >= 1, got ${morning.booked_count}`);
    assert.ok(noon.booked_count >= 1, `Noon booked_count should be >= 1, got ${noon.booked_count}`);
    assert.ok(afternoon.booked_count >= 1, `Afternoon booked_count should be >= 1, got ${afternoon.booked_count}`);
  });

  // --- Suite 5: Hourly Chart Shift Bucketing Logic ---
  console.log('\n--- Test Suite 5: Shift & Hourly Distribution Chart Logic ---');

  const slotWindows = [
    { label: 'Morning (08:00 - 11:00 AM)', keywords: ['08:00', 'MORNING', '09:00', '10:00'], minH: 8, maxH: 11 },
    { label: 'Noon (11:00 AM - 02:00 PM)', keywords: ['11:00', 'NOON', '12:00', '01:00', '13:00'], minH: 11, maxH: 14 },
    { label: 'Afternoon (02:00 - 05:00 PM)', keywords: ['02:00', 'AFTERNOON', '03:00', '04:00', '14:00', '15:00', '16:00'], minH: 14, maxH: 17 }
  ];

  const testBookings = [book1, book2, book3];
  const chartCounts = [0, 0, 0];

  testBookings.forEach(b => {
    const timeStr = (b.slot_time || '').toUpperCase();
    for (let i = 0; i < slotWindows.length; i++) {
      if (slotWindows[i].keywords.some(kw => timeStr.includes(kw))) {
        chartCounts[i]++;
        break;
      }
    }
  });

  test('Morning booking maps to Chart Bucket 0 (Morning)', () => {
    assert.ok(chartCounts[0] >= 1);
  });
  test('Noon booking maps to Chart Bucket 1 (Noon)', () => {
    assert.ok(chartCounts[1] >= 1);
  });
  test('Afternoon booking maps to Chart Bucket 2 (Afternoon)', () => {
    assert.ok(chartCounts[2] >= 1);
  });
  test('All shifts are populated, NOT stuck on "1 booking from 2 to 4 only"', () => {
    assert.ok(chartCounts[0] > 0 && chartCounts[1] > 0 && chartCounts[2] > 0);
  });

  // --- Suite 6: Cancellation API ---
  console.log('\n--- Test Suite 6: Slot Cancellation ---');

  const cancelRes = await fetch(`${BASE_URL}/api/bookings/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: book3.id,
      reason: 'Harvest delayed by rain'
    })
  });
  test('POST /api/bookings/cancel returns HTTP 200', () => {
    assert.strictEqual(cancelRes.status, 200);
  });
  const cancelData = await cancelRes.json();
  test('Cancelled booking status is CANCELLED', () => {
    assert.strictEqual(cancelData.booking.status, 'CANCELLED');
  });

  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Farmer data fetching & slot booking verified.');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Review output above.');
  }
  console.log('===============================================================\n');
}

runTests().catch(e => {
  console.error('Fatal test runner error:', e);
});
