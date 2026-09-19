/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * MSG91 SMS Provider (services/sms/msg91Provider.js)
 * Production Telecom Integration with MSG91 Flow API & DLT
 * ==============================================================================
 * 
 * SECURITY & DLT COMPLIANCE:
 * - Credentials (MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_DLT_ENTITY_ID) reside
 *   EXCLUSIVELY in backend server environment variables.
 * - ZERO secrets are exposed to the client-side JavaScript.
 * - This provider is inactive by default (SMS_MODE=mock).
 * - It will NOT send telecom SMS until real approved DLT Entity ID, approved Sender ID,
 *   and MSG91 Flow IDs are supplied in environment variables.
 * - NEVER creates fake DLT IDs or fake Sender IDs.
 */

const https = require('https');
const SMSProvider = require('./smsProvider');

class MSG91SMSProvider extends SMSProvider {
  constructor(config = {}) {
    super('msg91');
    this.authKey = config.authKey || process.env.MSG91_AUTH_KEY || '';
    this.senderId = config.senderId || process.env.MSG91_SENDER_ID || '';
    this.dltEntityId = config.dltEntityId || process.env.MSG91_DLT_ENTITY_ID || '';
    this.timeoutMs = config.timeoutMs || 8000;
  }

  /**
   * Check if MSG91 is ready for live telecom dispatch
   */
  isConfigured() {
    const hasKey = Boolean(this.authKey && this.authKey.trim().length > 10);
    const hasSender = Boolean(this.senderId && this.senderId.trim().length >= 3);
    const hasDlt = Boolean(this.dltEntityId && this.dltEntityId.trim().length > 5);

    if (!hasKey) {
      return {
        ready: false,
        mode: 'msg91',
        reason: 'MSG91_AUTH_KEY is missing from server environment.'
      };
    }

    if (!hasSender) {
      return {
        ready: false,
        mode: 'msg91',
        reason: 'Approved MSG91_SENDER_ID is not configured in server environment.'
      };
    }

    if (!hasDlt) {
      return {
        ready: false,
        mode: 'msg91',
        reason: 'Indian TRAI MSG91_DLT_ENTITY_ID is not configured in server environment.'
      };
    }

    return {
      ready: true,
      mode: 'msg91',
      senderId: this.senderId,
      dltEntityId: this.dltEntityId
    };
  }

  /**
   * Normalize phone number to 12-digit international format (919876543210)
   */
  normalizePhoneNumber(phone) {
    if (!phone) return '';
    let digits = phone.toString().replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.substring(1)}`;
    return digits;
  }

  /**
   * Send SMS via MSG91 Flow API
   */
  async sendSMS({ to, message, templateId, variables = {}, metadata = {} }) {
    const configCheck = this.isConfigured();
    if (!configCheck.ready) {
      console.warn(`[MSG91SMSProvider] Cannot send live SMS: ${configCheck.reason}`);
      return {
        success: false,
        status: 'FAILED',
        provider: 'msg91',
        providerMessageId: null,
        error: `MSG91 not activated: ${configCheck.reason}`,
        sentAt: null
      };
    }

    const formattedMobile = this.normalizePhoneNumber(to);
    if (!formattedMobile || formattedMobile.length !== 12) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'msg91',
        providerMessageId: null,
        error: `Invalid Indian mobile number: "${to}". Expected 10 digits.`,
        sentAt: null
      };
    }

    const payload = {
      template_id: templateId,
      sender: this.senderId,
      short_url: '0',
      dlt_pe_id: this.dltEntityId,
      recipients: [
        {
          mobiles: formattedMobile,
          ...variables
        }
      ]
    };

    try {
      const result = await this.makeHttpsRequest({
        hostname: 'control.msg91.com',
        path: '/api/v5/flow/',
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (result.type === 'success' || result.status === 'success' || result.message_id) {
        return {
          success: true,
          status: 'SENT',
          provider: 'msg91',
          providerMessageId: result.message_id || `MSG91-${Date.now()}`,
          sentAt: new Date().toISOString(),
          rawResponse: result
        };
      } else {
        return {
          success: false,
          status: 'FAILED',
          provider: 'msg91',
          providerMessageId: null,
          error: result.message || 'MSG91 API rejected request',
          rawResponse: result
        };
      }
    } catch (err) {
      return {
        success: false,
        status: 'FAILED',
        provider: 'msg91',
        providerMessageId: null,
        error: `MSG91 connection failed: ${err.message}`,
        sentAt: null
      };
    }
  }

  makeHttpsRequest(options) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: options.hostname,
        port: 443,
        path: options.path,
        method: options.method || 'POST',
        headers: options.headers,
        timeout: this.timeoutMs
      }, (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { responseBody += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve({ rawText: responseBody, statusCode: res.statusCode });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`MSG91 request timed out after ${this.timeoutMs}ms`));
      });

      req.on('error', (e) => reject(e));

      if (options.body) req.write(options.body);
      req.end();
    });
  }

  async getDeliveryStatus(providerMessageId) {
    if (!this.authKey || !providerMessageId) {
      return { status: 'UNKNOWN' };
    }

    try {
      const result = await this.makeHttpsRequest({
        hostname: 'control.msg91.com',
        path: `/api/v5/report/sms?requestId=${encodeURIComponent(providerMessageId)}`,
        method: 'GET',
        headers: {
          'authkey': this.authKey,
          'accept': 'application/json'
        }
      });

      const deliveryStatus = result?.data?.[0]?.status || 'SENT';
      return {
        status: deliveryStatus.toUpperCase(),
        providerMessageId,
        deliveredAt: deliveryStatus.toUpperCase() === 'DELIVERED' ? new Date().toISOString() : null,
        rawResponse: result
      };
    } catch (e) {
      return {
        status: 'SENT',
        providerMessageId,
        error: e.message
      };
    }
  }
}

module.exports = MSG91SMSProvider;
