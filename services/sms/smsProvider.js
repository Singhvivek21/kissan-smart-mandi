/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * SMS Provider Base Interface (services/sms/smsProvider.js)
 * ==============================================================================
 */

class SMSProvider {
  /**
   * @param {string} name - Provider identifier ('mock' or 'msg91')
   */
  constructor(name) {
    if (new.target === SMSProvider) {
      throw new TypeError("Cannot instantiate abstract class SMSProvider directly.");
    }
    this.name = name;
  }

  /**
   * Send an SMS notification
   * @param {Object} options
   * @param {string} options.to - Recipient phone number (e.g. +919876543210 or 9876543210)
   * @param {string} options.message - Fully compiled message text
   * @param {string} options.templateId - DLT template ID or identifier
   * @param {Object} [options.variables] - Key-value variables for template substitution
   * @param {Object} [options.metadata] - Extra context (bookingId, userId, eventType)
   * @returns {Promise<{ success: boolean, providerMessageId: string, status: string, error?: string, rawResponse?: any }>}
   */
  async sendSMS(options) {
    throw new Error("Method sendSMS() must be implemented by provider subclass.");
  }

  /**
   * Query delivery status for a message ID
   * @param {string} providerMessageId
   * @returns {Promise<{ status: string, deliveredAt?: string, rawResponse?: any }>}
   */
  async getDeliveryStatus(providerMessageId) {
    throw new Error("Method getDeliveryStatus() must be implemented by provider subclass.");
  }

  /**
   * Check if provider is properly configured
   * @returns {{ ready: boolean, reason?: string }}
   */
  isConfigured() {
    return { ready: true };
  }
}

module.exports = SMSProvider;
