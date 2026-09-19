/**
 * =============================================================================
 * KISSAN – Procure Smart Mandi
 * Automated Integration Test Suite: Procurement, Payout, Privacy & Admin Stats
 * =============================================================================
 */

const BASE_URL = 'http://localhost:8080';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 RUNNING PROCUREMENT, PAYOUT, PRIVACY & ADMIN STATS TEST SUITE');
  console.log('===============================================================');

  // --- Test Suite 1: Initial Admin Stats & Endpoints Readiness ---
  console.log('\n--- Test Suite 1: Admin Stats & Endpoints Readiness ---');
  const statsRes = await fetch(`${BASE_URL}/api/procurements/stats`);
  test('GET /api/procurements/stats returns HTTP 200', () => {
    assert(statsRes.status === 200, `Expected 200, got ${statsRes.status}`);
  });

  const statsJson = await statsRes.json();
  test('Admin stats contains totalPaidAmount and totalPendingAmount in rupees', () => {
    assert(statsJson.success === true, 'Expected success: true');
    assert(typeof statsJson.stats.totalPaidAmount === 'number', 'totalPaidAmount must be numeric');
    assert(typeof statsJson.stats.totalPendingAmount === 'number', 'totalPendingAmount must be numeric');
    assert(typeof statsJson.stats.completedPaymentsCount === 'number', 'completedPaymentsCount must be numeric');
  });

  const initialPaid = statsJson.stats.totalPaidAmount;
  const initialPending = statsJson.stats.totalPendingAmount;
  console.log(`     Initial Admin Stats: Paid = ₹${initialPaid}, Pending = ₹${initialPending}`);

  // --- Test Suite 2: Admin Records New Procurement & Pending Payout ---
  console.log('\n--- Test Suite 2: Admin Records New Procurement ---');
  const farmerA_Phone = '9876543210';
  const farmerA_Id = 'F-10024';
  const farmerA_Name = 'Rameshwar Singh';

  const newProcPayload = {
    farmer_id: farmerA_Id,
    farmer_name: farmerA_Name,
    farmer_phone: farmerA_Phone,
    crop: 'Wheat (गेहूं)',
    quantity: 50.0,
    gross_weight: 52.5,
    tare_weight: 2.5,
    quality: 'FAQ Grade A (11.2% Moisture)',
    msp_rate: 2275,
    amount: 113750,
    status: 'COMPLETED',
    payment_status: 'Direct DBT Initiated'
  };

  const createProcRes = await fetch(`${BASE_URL}/api/procurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newProcPayload)
  });

  test('POST /api/procurements returns HTTP 201', () => {
    assert(createProcRes.status === 201, `Expected 201, got ${createProcRes.status}`);
  });

  const createProcJson = await createProcRes.json();
  const createdProc = createProcJson.procurement;
  const createdPay = createProcJson.payment;

  test('Procurement record generated with valid ID and status COMPLETED', () => {
    assert(createdProc && createdProc.id.startsWith('PROC-'), 'Expected valid PROC- ID');
    assert(createdProc.amount === 113750, 'Expected amount: 113750');
    assert(createdProc.status === 'COMPLETED', 'Expected status: COMPLETED');
  });

  test('Corresponding payment record automatically generated with status PENDING', () => {
    assert(createdPay && createdPay.id.startsWith('PAY-'), 'Expected valid PAY- ID');
    assert(createdPay.amount === 113750, 'Expected payment amount: 113750');
    assert(createdPay.status === 'PENDING', 'Expected payment status: PENDING');
    assert(createdPay.transaction_id === null, 'Pending payment must not have transaction_id yet');
  });

  // --- Test Suite 3: Admin Payment Tracking Updates ("How much payment is done") ---
  console.log('\n--- Test Suite 3: Admin Payment Tracking ("How much payment is done") ---');
  const postProcStatsRes = await fetch(`${BASE_URL}/api/procurements/stats`);
  const postProcStats = (await postProcStatsRes.json()).stats;

  test('Admin stats reflect newly added pending payout in rupees', () => {
    assert(postProcStats.totalPendingAmount === initialPending + 113750, 
      `Expected totalPendingAmount = ₹${initialPending + 113750}, got ₹${postProcStats.totalPendingAmount}`);
  });

  // Admin marks payment as PAID
  const payRes = await fetch(`${BASE_URL}/api/payments/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_id: createdPay.id })
  });

  test('POST /api/payments/pay returns HTTP 200', () => {
    assert(payRes.status === 200, `Expected 200, got ${payRes.status}`);
  });

  const payJson = await payRes.json();
  test('Payment disbursal generates KSM-DBT transaction reference and updates status to PAID', () => {
    assert(payJson.success === true, 'Expected success: true');
    assert(payJson.status === 'PAID', 'Expected status: PAID');
    assert(payJson.transaction_id && payJson.transaction_id.startsWith('KSM-DBT-'), 
      `Expected KSM-DBT- reference, got ${payJson.transaction_id}`);
    assert(payJson.payment.payment_date !== null, 'payment_date must be recorded');
  });

  const postPayStatsRes = await fetch(`${BASE_URL}/api/procurements/stats`);
  const postPayStats = (await postPayStatsRes.json()).stats;

  test('Admin Portal immediately updates "How much payment is done" (totalPaidAmount increased)', () => {
    assert(postPayStats.totalPaidAmount === initialPaid + 113750,
      `Expected totalPaidAmount = ₹${initialPaid + 113750}, got ₹${postPayStats.totalPaidAmount}`);
    assert(postPayStats.totalPendingAmount === initialPending,
      `Expected pending amount to decrease back to ₹${initialPending}`);
    assert(postPayStats.completedPaymentsCount >= 2, 'Completed payments count increased');
  });

  // --- Test Suite 4: Strict Farmer Portal Privacy Isolation ---
  console.log('\n--- Test Suite 4: Strict Farmer Portal Privacy Isolation ---');
  
  // Farmer A (Rameshwar Singh) queries their procurements
  const farmerA_Res = await fetch(`${BASE_URL}/api/procurements?farmer_phone=${farmerA_Phone}&farmer_id=${farmerA_Id}`);
  const farmerA_Data = await farmerA_Res.json();

  test('Farmer A sees only their own procurements', () => {
    assert(farmerA_Data.success === true, 'Expected success');
    assert(farmerA_Data.count >= 2, `Expected at least 2 records for Farmer A, got ${farmerA_Data.count}`);
    farmerA_Data.procurements.forEach(p => {
      assert(p.farmer_phone === farmerA_Phone || p.farmer_id === farmerA_Id, 
        `Farmer A received another farmer's record: ${p.farmer_name} (${p.farmer_phone})`);
    });
  });

  // Farmer B (Baldev Yadav) queries their procurements
  const farmerB_Phone = '9812345678';
  const farmerB_Id = 'F-10088';
  const farmerB_Res = await fetch(`${BASE_URL}/api/procurements?farmer_phone=${farmerB_Phone}&farmer_id=${farmerB_Id}`);
  const farmerB_Data = await farmerB_Res.json();

  test('Farmer B sees only their own produce and payout (Mustard: ₹1,97,750)', () => {
    assert(farmerB_Data.success === true, 'Expected success');
    assert(farmerB_Data.count === 1, `Expected exactly 1 record for Farmer B, got ${farmerB_Data.count}`);
    assert(farmerB_Data.procurements[0].farmer_name === 'Baldev Yadav', 'Expected Baldev Yadav record');
    assert(farmerB_Data.procurements[0].amount === 197750, 'Expected ₹1,97,750 for Baldev Yadav');
  });

  test('Farmer B CANNOT see Farmer A\'s Wheat or ₹1,13,750 payout', () => {
    const hasFarmerARecord = farmerB_Data.procurements.some(p => p.farmer_phone === farmerA_Phone || p.farmer_id === farmerA_Id);
    assert(!hasFarmerARecord, 'CRITICAL PRIVACY BREACH: Farmer B saw Farmer A\'s procurement!');
  });

  // Farmer C (New / Unrelated Farmer who has not sold produce)
  const farmerC_Phone = '9330727021';
  const farmerC_Id = '9c6ada52-3043-4075-a948-cd6e2077988f';
  const farmerC_Res = await fetch(`${BASE_URL}/api/procurements?farmer_phone=${farmerC_Phone}&farmer_id=${farmerC_Id}`);
  const farmerC_Data = await farmerC_Res.json();

  test('Farmer C with no sales receives 0 records and ₹0 payout (privacy secured)', () => {
    assert(farmerC_Data.count === 0, `Expected 0 records for Farmer C, got ${farmerC_Data.count}`);
    assert(farmerC_Data.procurements.length === 0, 'Procurements array must be empty');
  });

  test('Farmer C CANNOT see Farmer A or Farmer B sales amount', () => {
    const totalC = farmerC_Data.procurements.reduce((sum, p) => sum + p.amount, 0);
    assert(totalC === 0, `Expected total payout ₹0 for Farmer C, got ₹${totalC}`);
  });

  // --- Test Suite 5: Payment Records Privacy Scoping ---
  console.log('\n--- Test Suite 5: Payment Records Privacy Scoping ---');
  const payA_Res = await fetch(`${BASE_URL}/api/payments?farmer_phone=${farmerA_Phone}`);
  const payA_Data = await payA_Res.json();

  test('Farmer A payments query returns only Farmer A payments', () => {
    assert(payA_Data.count >= 2, `Expected at least 2 payments for Farmer A`);
    payA_Data.payments.forEach(p => {
      assert(p.farmer_phone === farmerA_Phone || p.farmer_id === farmerA_Id, 'Payment privacy leaked');
    });
  });

  const payC_Res = await fetch(`${BASE_URL}/api/payments?farmer_phone=${farmerC_Phone}`);
  const payC_Data = await payC_Res.json();

  test('Farmer C payments query returns 0 payments (never leaks others)', () => {
    assert(payC_Data.count === 0, 'Farmer C must have 0 payments');
  });

  // --- Summary ---
  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED! Procurement, Payout, Privacy & Admin Stats Verified.');
  } else {
    console.error('⚠️ SOME TESTS FAILED. Please review output above.');
    process.exit(1);
  }
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
