/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * SMS Orchestration Service (services/sms/smsService.js)
 * ==============================================================================
 * 
 * CORE RESPONSIBILITIES:
 * 1. Provider routing: Seamless switching between 'mock' (dev/hackathon) and 'msg91' (prod)
 * 2. Idempotency enforcement: Prevents duplicate SMS for the same event
 * 3. Phone validation & normalization (+91 / standard 10-digit)
 * 4. PII Masking: 98765***** for dashboard security
 * 5. Automatic retry mechanism (up to 3 attempts)
 * 6. Dual storage: Supabase PostgreSQL + Resilient local fallback buffer
 * 7. Non-blocking async execution guarantee
 */

const MockSMSProvider = require('./mockProvider');
const MSG91SMSProvider = require('./msg91Provider');
const { SMS_TEMPLATES, compileTemplate } = require('./smsTemplates');

class SMSService {
  constructor(options = {}) {
    this.mode = (process.env.SMS_MODE || options.mode || 'mock').toLowerCase();
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 400;

    // In-memory ring buffer for resilient auditing & demo mode
    this.inMemoryLogs = [];
    this.maxMemoryLogs = 250;

    // Initialize Active Provider
    this.initProvider();
  }

  /**
   * Instantiate SMS provider based on configured mode
   */
  initProvider() {
    if (this.mode === 'msg91') {
      this.provider = new MSG91SMSProvider();
      console.log('📡 [SMSService] Initialized in PRODUCTION Mode: MSG91 Provider');
    } else {
      this.provider = new MockSMSProvider();
      console.log('🧪 [SMSService] Initialized in ZERO-COST Mode: Mock Provider (Development/Hackathon)');
    }
  }

  /**
   * Switch mode dynamically (e.g. from admin panel or environment change)
   */
  setMode(newMode) {
    this.mode = (newMode || 'mock').toLowerCase();
    this.initProvider();
    return this.getStatus();
  }

  /**
   * Current service readiness and status
   */
  getStatus() {
    const providerCheck = this.provider.isConfigured();
    return {
      service: 'KISSAN Mandi SMS Notification Engine',
      mode: this.mode,
      provider: this.provider.name,
      ready: providerCheck.ready,
      providerDetails: providerCheck,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Normalize phone number to 10 digits
   * @param {string} phone
   * @returns {string}
   */
  normalizePhoneNumber(phone) {
    if (!phone) return '';
    const clean = phone.toString().replace(/[\s\-\(\)\+]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      return clean.substring(2);
    }
    if (clean.length === 11 && clean.startsWith('0')) {
      return clean.substring(1);
    }
    return clean;
  }

  /**
   * Validate Indian 10-digit mobile number starting with 6-9
   */
  isValidIndianMobile(phone) {
    const normalized = this.normalizePhoneNumber(phone);
    return /^[6-9]\d{9}$/.test(normalized);
  }

  /**
   * Mask phone number for UI display & privacy (e.g. 98765***** or 98***43210)
   */
  maskPhoneNumber(phone) {
    const norm = this.normalizePhoneNumber(phone);
    if (!norm || norm.length < 10) return '**********';
    return `${norm.substring(0, 5)}*****`;
  }

  /**
   * Generate idempotency key for an event
   */
  generateIdempotencyKey(bookingId, notificationType) {
    if (!bookingId || !notificationType) return null;
    return `IDEMP_${bookingId}_${notificationType}`;
  }

  /**
   * Send notification with idempotency, validation, and retries
   * @param {Object} params
   * @param {string} params.notificationType - Event name (e.g. 'BOOKING_CONFIRMED')
   * @param {string} params.phoneNumber - Recipient mobile
   * @param {string} [params.farmerName]
   * @param {string} [params.bookingId]
   * @param {string} [params.userId]
   * @param {Object} [params.variables] - Template variables
   * @param {boolean} [params.forceResend=false] - Bypass idempotency check
   * @returns {Promise<Object>} Notification log record
   */
  async sendNotification(params) {
    const {
      notificationType,
      phoneNumber,
      farmerName = 'Farmer',
      bookingId = null,
      userId = null,
      variables = {},
      forceResend = false
    } = params;

    // 1. Validate Notification Type
    if (!SMS_TEMPLATES[notificationType]) {
      const errMessage = `Unsupported notificationType: ${notificationType}`;
      console.error(`[SMSService] ${errMessage}`);
      return this.recordLog({
        userId,
        bookingId,
        phoneNumber,
        notificationType: notificationType || 'UNKNOWN',
        templateId: 'UNKNOWN',
        provider: this.provider.name,
        message: 'Invalid notification event',
        status: 'FAILED',
        errorMessage: errMessage,
        attemptCount: 1
      });
    }

    // 2. Validate Phone Number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    if (!this.isValidIndianMobile(normalizedPhone)) {
      const errMessage = `Invalid recipient mobile number: "${phoneNumber}". Expected valid 10-digit Indian number.`;
      console.warn(`[SMSService] ${errMessage}`);
      return this.recordLog({
        userId,
        bookingId,
        phoneNumber: phoneNumber || 'INVALID',
        notificationType,
        templateId: SMS_TEMPLATES[notificationType].dltTemplateId,
        provider: this.provider.name,
        message: 'Message not dispatched due to invalid phone format',
        status: 'FAILED',
        errorMessage: errMessage,
        attemptCount: 1
      });
    }

    // 3. Check Idempotency (prevent duplicate dispatch for same booking event)
    const idempotencyKey = this.generateIdempotencyKey(bookingId, notificationType);
    if (idempotencyKey && !forceResend) {
      const existing = this.findExistingByIdempotency(idempotencyKey);
      if (existing && (existing.status === 'SENT' || existing.status === 'SIMULATED' || existing.status === 'DELIVERED')) {
        console.log(`[SMSService] Idempotency Hit: SMS for ${idempotencyKey} already dispatched (Status: ${existing.status}). Skipping.`);
        return {
          ...existing,
          duplicatePrevented: true
        };
      }
    }

    // 4. Compile Template Message
    const mergedVars = {
      farmer_name: farmerName,
      phone_number: normalizedPhone,
      time: new Date().toLocaleTimeString('en-IN'),
      ...variables
    };

    const { message, template } = compileTemplate(notificationType, mergedVars);

    // 5. Execute Provider Dispatch with Retry Loop
    let lastError = null;
    let attempt = 0;
    let dispatchResult = null;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        dispatchResult = await this.provider.sendSMS({
          to: normalizedPhone,
          message,
          templateId: template.dltTemplateId,
          variables: mergedVars,
          metadata: {
            eventType: notificationType,
            bookingId,
            userId,
            attempt
          }
        });

        if (dispatchResult && dispatchResult.success) {
          break; // Success!
        } else {
          lastError = dispatchResult?.error || 'Provider returned unsuccessful response';
        }
      } catch (err) {
        lastError = err.message;
      }

      if (attempt < this.maxRetries) {
        // Backoff delay before retry
        await new Promise(r => setTimeout(r, this.retryDelayMs * attempt));
      }
    }

    // 6. Formulate Log Record
    const isSuccess = dispatchResult && dispatchResult.success;
    const finalStatus = isSuccess
      ? (dispatchResult.status || (this.mode === 'mock' ? 'SIMULATED' : 'SENT'))
      : 'FAILED';

    const logRecord = {
      id: `SMS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: userId,
      booking_id: bookingId,
      phone_number: normalizedPhone,
      masked_phone: this.maskPhoneNumber(normalizedPhone),
      notification_type: notificationType,
      template_id: this.mode === 'mock' ? null : template.dltTemplateId,
      provider: this.provider.name, // 'mock'
      message,
      provider_message_id: dispatchResult?.providerMessageId || null,
      status: finalStatus, // strictly 'SIMULATED' in mock mode
      error_message: isSuccess ? null : (lastError || 'Delivery failure'),
      attempt_count: attempt,
      idempotency_key: idempotencyKey,
      sent_at: finalStatus === 'SENT' || finalStatus === 'DELIVERED' ? new Date().toISOString() : null, // Never mark as SENT in mock mode
      delivered_at: finalStatus === 'DELIVERED' ? new Date().toISOString() : null, // Never mark as DELIVERED in mock mode
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 7. Store Log in Memory and attempt Supabase persistence
    this.recordLog(logRecord);

    return logRecord;
  }

  /**
   * Non-blocking wrapper that ensures calls never crash the main application flow
   */
  sendNotificationAsync(params) {
    this.sendNotification(params).catch(err => {
      console.error(`[SMSService] Background SMS task error:`, err);
    });
  }

  /**
   * Resend / Retry a previously failed or pending notification
   */
  async retryNotification(smsId) {
    const existing = this.inMemoryLogs.find(l => l.id === smsId);
    if (!existing) {
      return { success: false, error: `Notification with ID ${smsId} not found.` };
    }

    return await this.sendNotification({
      notificationType: existing.notification_type,
      phoneNumber: existing.phone_number,
      farmerName: 'Farmer',
      bookingId: existing.booking_id,
      userId: existing.user_id,
      forceResend: true
    });
  }

  /**
   * Find existing log by idempotency key
   */
  findExistingByIdempotency(idempotencyKey) {
    if (!idempotencyKey) return null;
    return this.inMemoryLogs.find(l => l.idempotency_key === idempotencyKey);
  }

  /**
   * Record log into memory ring buffer and async sync to DB if Supabase is connected
   */
  recordLog(record) {
    // Check if record already exists in memory (update it)
    const existingIdx = this.inMemoryLogs.findIndex(l => 
      (record.id && l.id === record.id) || 
      (record.idempotency_key && l.idempotency_key === record.idempotency_key)
    );

    if (existingIdx !== -1) {
      this.inMemoryLogs[existingIdx] = { ...this.inMemoryLogs[existingIdx], ...record, updated_at: new Date().toISOString() };
    } else {
      this.inMemoryLogs.unshift(record);
      if (this.inMemoryLogs.length > this.maxMemoryLogs) {
        this.inMemoryLogs.pop();
      }
    }

    // Async attempt to write to Supabase database (non-blocking)
    this.syncToDatabase(record).catch(() => {});

    return record;
  }

  /**
   * Background sync to Supabase PostgreSQL table
   */
  async syncToDatabase(record) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://fqxsbrflcmtfhyieeyep.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_imFTIfne54wwVXSLXb25MQ_m-3HsfFc';

    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    try {
      const https = require('https');
      const url = new URL(`${supabaseUrl}/rest/v1/sms_notifications`);

      const postData = JSON.stringify({
        phone_number: record.phone_number,
        notification_type: record.notification_type,
        template_id: record.template_id,
        provider: record.provider,
        message: record.message,
        provider_message_id: record.provider_message_id,
        status: record.status,
        error_message: record.error_message,
        attempt_count: record.attempt_count,
        idempotency_key: record.idempotency_key,
        sent_at: record.sent_at,
        delivered_at: record.delivered_at
      });

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        }
      };

      const req = https.request(options, (res) => {
        // Log processed in Supabase if table is created
      });
      req.on('error', () => {});
      req.write(postData);
      req.end();
    } catch (e) {
      // Ignored for non-blocking tolerance
    }
  }

  /**
   * Retrieve audit logs for Admin Dashboard
   * @param {Object} [filter]
   * @param {number} [filter.limit=50]
   * @param {string} [filter.status]
   * @param {string} [filter.type]
   */
  getLogs(filter = {}) {
    const limit = parseInt(filter.limit, 10) || 50;
    let list = [...this.inMemoryLogs];

    if (filter.status) {
      list = list.filter(l => l.status.toUpperCase() === filter.status.toUpperCase());
    }

    if (filter.type) {
      list = list.filter(l => l.notification_type.toUpperCase() === filter.type.toUpperCase());
    }

    // Always ensure masked_phone is populated
    return list.slice(0, limit).map(l => ({
      ...l,
      masked_phone: l.masked_phone || this.maskPhoneNumber(l.phone_number)
    }));
  }

  /**
   * Retrieve KPI aggregation metrics for Admin Dashboard
   */
  getStats() {
    const total = this.inMemoryLogs.length;
    const simulated = this.inMemoryLogs.filter(l => l.status === 'SIMULATED').length;
    const sent = this.inMemoryLogs.filter(l => l.status === 'SENT').length;
    const delivered = this.inMemoryLogs.filter(l => l.status === 'DELIVERED').length;
    const failed = this.inMemoryLogs.filter(l => l.status === 'FAILED').length;
    const pending = this.inMemoryLogs.filter(l => l.status === 'PENDING' || l.status === 'SENDING').length;

    return {
      total,
      simulated,
      sent,
      delivered,
      failed,
      pending,
      mode: this.mode,
      provider: this.provider.name,
      modeNotice: this.mode === 'mock' 
        ? 'DEMO MODE — SMS SIMULATED' 
        : 'PRODUCTION TELECOM (MSG91 Active)'
    };
  }
}

// Export singleton instance
const smsService = new SMSService();

module.exports = {
  SMSService,
  smsService
};
