/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * Mock SMS Provider (services/sms/mockProvider.js)
 * Zero-Cost Development / Hackathon Mode
 * ==============================================================================
 * 
 * IMPORTANT:
 * - This provider simulates SMS dispatch without making any external telecom calls.
 * - It strictly returns status 'SIMULATED'.
 * - It NEVER marks messages as SENT or DELIVERED.
 * - Does NOT require or use any MSG91 credentials, DLT Entity IDs, or Sender IDs.
 * - Generates unique mock message IDs in format: MOCK-SMS-<uuid>.
 */

const crypto = require('crypto');
const SMSProvider = require('./smsProvider');

class MockSMSProvider extends SMSProvider {
  constructor(options = {}) {
    super('mock');
    this.simulatedLatencyMs = options.simulatedLatencyMs || 60;
  }

  isConfigured() {
    return {
      ready: true,
      mode: 'mock',
      provider: 'MOCK',
      description: 'Zero-Cost Simulation Mode (Hackathon / Dev Safe)'
    };
  }

  /**
   * Validate Indian phone number (10 digits, optional +91 or 0 prefix)
   * @param {string} phone
   * @returns {boolean}
   */
  isValidPhoneNumber(phone) {
    if (!phone) return false;
    const clean = phone.toString().replace(/[\s\-()]/g, '');
    return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(clean);
  }

  /**
   * Send simulated SMS
   * @param {Object} options
   */
  async sendSMS({ to, message, variables = {}, metadata = {} }) {
    // 1. Simulate network hop
    if (this.simulatedLatencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulatedLatencyMs));
    }

    // 2. Validate phone number
    if (!this.isValidPhoneNumber(to)) {
      console.warn(`[MockSMSProvider] Invalid Indian phone number format: "${to}"`);
      return {
        success: false,
        status: 'FAILED',
        provider: 'mock',
        providerMessageId: null,
        error: `Invalid Indian mobile number format: ${to}. Expected 10 digits starting with 6-9.`,
        sentAt: null,
        deliveredAt: null
      };
    }

    // 3. Generate mock message ID: MOCK-SMS-<uuid>
    const uuid = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + '-' + Date.now().toString(36));
    const providerMessageId = `MOCK-SMS-${uuid}`;
    const timestamp = new Date().toISOString();

    // 4. Log simulated SMS to server console
    console.log(`\n======================================================`);
    console.log(`📱 [SMS SIMULATION — DEMO MODE (Zero-Cost)]`);
    console.log(`   Provider:   MOCK`);
    console.log(`   Status:     SIMULATED`);
    console.log(`   To:         ${to}`);
    console.log(`   Event:      ${metadata.eventType || 'SMS_NOTIFICATION'}`);
    console.log(`   Message ID: ${providerMessageId}`);
    console.log(`   Message:    "${message}"`);
    console.log(`   Timestamp:  ${timestamp}`);
    console.log(`======================================================\n`);

    return {
      success: true,
      status: 'SIMULATED',
      provider: 'mock',
      providerMessageId,
      sentAt: null,        // Never mark as SENT
      deliveredAt: null,   // Never mark as DELIVERED
      simulatedAt: timestamp,
      rawResponse: {
        simulated: true,
        notice: 'DEMO MODE — SMS SIMULATED. No telecom charges incurred.'
      }
    };
  }

  /**
   * Query delivery status
   */
  async getDeliveryStatus(providerMessageId) {
    return {
      status: 'SIMULATED',
      provider: 'mock',
      providerMessageId,
      deliveredAt: null,
      rawResponse: { simulated: true }
    };
  }
}

module.exports = MockSMSProvider;
