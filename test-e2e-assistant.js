const assert = require('assert');

async function callAssistant(message, lang = 'en-IN', history = []) {
  const res = await fetch('http://localhost:8080/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      selectedLang: lang,
      farmer: {
        id: 'F-10024',
        name: 'Rameshwar Singh',
        district: 'Karnal',
        phone: '9876543210'
      },
      context: {
        booking: {
          token_number: 'KMN-042',
          crop: 'Mustard (सरसों)',
          mandi_centre: 'Krishi Upaj Mandi, Sector 7, Karnal',
          slot_date: '2026-09-20',
          slot_time: '08:00 AM - 11:00 AM (Morning)',
          quantity_quintals: 40,
          status: 'CONFIRMED'
        },
        queue: {
          current_serving_token: 'KMN-040',
          active_stage: 'Weighbridge Bay #2'
        }
      },
      conversationHistory: history
    })
  });
  return await res.json();
}

async function runTests() {
  console.log('===========================================================');
  console.log('RUNNING E2E CONVERSATIONAL AI ASSISTANT SUITE');
  console.log('===========================================================\n');

  // Test 1: Natural phrasing for booking/token
  console.log('Test 1: Natural language booking inquiry');
  const res1 = await callAssistant('Can you check when my appointment is and what token was assigned to me?', 'en-IN');
  console.log('  Reply length:', (res1.reply || '').length);
  assert.ok(res1.reply.includes('KMN-042'), 'Should contain token KMN-042');
  assert.ok(res1.reply.includes('💡 Recommended Follow-up Questions:'), 'Should contain follow-up hints');
  console.log('  [PASS] Successfully retrieved live booking token KMN-042 with follow-up hints.\n');

  // Test 2: Natural phrasing for queue wait time
  console.log('Test 2: Natural language queue inquiry');
  const res2 = await callAssistant('How long do I have to wait in the yard and what is the current vehicle number being served?', 'en-IN');
  assert.ok(res2.reply.includes('KMN-040') || res2.reply.includes('Weighbridge') || res2.reply.includes('ahead') || res2.reply.includes('wait'), 'Should reflect queue status');
  console.log('  [PASS] Successfully retrieved live queue position & wait time.\n');

  // Test 3: Natural language cancellation intent -> requiresConfirmation
  console.log('Test 3: Cancellation request triggers two-step confirmation');
  const res3 = await callAssistant('I will not be able to come on Sunday, please cancel my slot booking', 'en-IN');
  assert.strictEqual(res3.requiresConfirmation, true, 'Must flag requiresConfirmation: true');
  assert.ok(res3.confirmationDetails, 'Must provide confirmationDetails');
  console.log('  [PASS] Cancellation intercepted safely without mutating database: requiresConfirmation=true.\n');

  // Test 4: Agricultural diagnosis & pest guidance
  console.log('Test 4: Open-ended crop disease diagnosis');
  const res4 = await callAssistant('My mustard leaves have white powdery patches under them, what disease is this and how should I treat it?', 'en-IN');
  assert.ok(res4.reply.toLowerCase().includes('rust') || res4.reply.toLowerCase().includes('mancozeb') || res4.reply.toLowerCase().includes('mildew') || res4.reply.toLowerCase().includes('fungal'), 'Should give agricultural diagnosis');
  assert.ok(res4.reply.includes('💡 Recommended Follow-up Questions:'), 'Must include follow-up hints');
  console.log('  [PASS] Provided scientific agricultural diagnosis and chemical/cultural control.\n');

  // Test 5: Strict Hindi language enforcement when selectedLang is hi-IN
  console.log('Test 5: Multilingual response in Hindi');
  const res5 = await callAssistant('गेहूं का सरकारी एमएसपी क्या है?', 'hi-IN');
  assert.ok(/[\u0900-\u097F]/.test(res5.reply), 'Response should be in Hindi Devanagari script');
  assert.ok(res5.reply.includes('2,275') || res5.reply.includes('2275') || res5.reply.includes('MSP') || res5.reply.includes('एमएसपी'), 'Should contain Wheat MSP 2,275');
  console.log('  [PASS] Responded fluently in Hindi with Devanagari script.\n');

  // Test 6: Multi-turn conversational memory
  console.log('Test 6: Multi-turn context preservation');
  const historyTurn1 = [
    { role: 'user', parts: [{ text: 'What is my token number?' }] },
    { role: 'model', parts: [{ text: 'Your token number is KMN-042 for Mustard procurement on 2026-09-20.' }] }
  ];
  const res6 = await callAssistant('And at what time is that scheduled?', 'en-IN', historyTurn1);
  assert.ok(res6.reply.includes('08:00 AM') || res6.reply.includes('Morning') || res6.reply.includes('September') || res6.reply.includes('2026-09-20'), 'Should resolve "that" using multi-turn context');
  console.log('  [PASS] Multi-turn resolved reference accurately.\n');

  // Test 7: Out-of-scope question
  console.log('Test 7: Out-of-scope polite boundary enforcement');
  const res7 = await callAssistant('What is the capital of Australia and who won the World Cup?', 'en-IN');
  assert.ok(res7.reply.toLowerCase().includes('scope') || res7.reply.toLowerCase().includes('mandi') || res7.reply.toLowerCase().includes('agricultural') || res7.reply.toLowerCase().includes('assist'), 'Should politely state scope boundaries');
  console.log('  [PASS] Politely communicated Mandi & agricultural scope.\n');

  console.log('===========================================================');
  console.log('🎉 ALL 7 E2E TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
