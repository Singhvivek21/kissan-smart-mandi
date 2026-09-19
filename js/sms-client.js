/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * SMS Client Library (js/sms-client.js)
 * Asynchronous, Non-Blocking Frontend Gateway Client
 * ==============================================================================
 * 
 * DESIGN PRINCIPLE:
 * SMS operations are strictly decoupled from transactional state.
 * If an SMS dispatch fails or network is interrupted, the UI and business workflows
 * (slot booking, queue advance, weighment, DBT payout) will NEVER be blocked or reverted.
 * Secrets are ZERO on client-side; all requests route via backend /api/sms/*.
 */

(function (window) {
  'use strict';

  const SMSClient = {
    apiBase: '/api/sms',

    /**
     * Dispatch an SMS notification asynchronously without blocking caller
     * @param {Object} options
     * @param {string} options.notificationType - Event name (e.g. 'BOOKING_CONFIRMED')
     * @param {string} options.phoneNumber - Farmer mobile number (10 digits)
     * @param {string} [options.farmerName] - Farmer name
     * @param {string} [options.bookingId] - Booking reference
     * @param {string} [options.userId] - Profile UUID
     * @param {Object} [options.variables] - Template variables
     * @param {boolean} [options.forceResend=false] - Bypass idempotency check
     * @returns {Promise<Object|null>} Result object or null on error
     */
    async sendNotification(options) {
      if (!options || !options.notificationType || !options.phoneNumber) {
        console.warn('[SMSClient] Missing required parameters (notificationType, phoneNumber).', options);
        return null;
      }

      try {
        console.log(`[SMSClient] Dispatching ${options.notificationType} for ${options.phoneNumber.substring(0, 5)}*****...`);
        const response = await fetch(`${this.apiBase}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(options)
        });

        if (!response.ok) {
          console.warn(`[SMSClient] Gateway returned HTTP ${response.status}`);
          return null;
        }

        const data = await response.json();
        console.log(`[SMSClient] Dispatch response [Mode: ${data.mode || 'mock'}]:`, data);

        // Notify active dashboard listeners of new SMS event
        window.dispatchEvent(new CustomEvent('kissan-sms-dispatched', { detail: data }));

        return data;
      } catch (err) {
        // Non-blocking catch: log error but never bubble up to cancel transaction
        console.warn('[SMSClient] Non-blocking network notice:', err.message);
        return null;
      }
    },

    /**
     * Fetch SMS logs and metrics for Admin Monitoring Console
     * @param {Object} [params]
     * @param {number} [params.limit=50]
     * @param {string} [params.status]
     * @param {string} [params.type]
     */
    async getLogs(params = {}) {
      try {
        const query = new URLSearchParams();
        if (params.limit) query.set('limit', params.limit);
        if (params.status) query.set('status', params.status);
        if (params.type) query.set('type', params.type);

        const res = await fetch(`${this.apiBase}/logs?${query.toString()}`);
        if (!res.ok) return { logs: [], stats: {} };
        return await res.json();
      } catch (e) {
        console.warn('[SMSClient] Error fetching logs:', e.message);
        return { logs: [], stats: {} };
      }
    },

    /**
     * Fetch current provider status (mode, readiness, details)
     */
    async getStatus() {
      try {
        const res = await fetch(`${this.apiBase}/status`);
        if (!res.ok) return { ready: false, mode: 'unknown' };
        return await res.json();
      } catch (e) {
        return { ready: false, mode: 'unknown', error: e.message };
      }
    },

    /**
     * Retry a failed or resend an existing notification
     */
    async retryNotification(smsId) {
      try {
        const res = await fetch(`${this.apiBase}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smsId })
        });
        const json = await res.json();
        window.dispatchEvent(new CustomEvent('kissan-sms-dispatched', { detail: json }));
        return json;
      } catch (e) {
        console.warn('[SMSClient] Error retrying SMS:', e.message);
        return { success: false, error: e.message };
      }
    },

    /**
     * Switch SMS mode (mock vs msg91)
     */
    async setMode(targetMode) {
      try {
        const res = await fetch(`${this.apiBase}/mode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: targetMode })
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // =========================================================================
    // CONVENIENCE LIFECYCLE EVENT DISPATCHERS
    // =========================================================================

    /**
     * 1. Booking Confirmed SMS
     */
    triggerBookingConfirmed(booking) {
      if (!booking) return;
      const phone = booking.farmer_phone || booking.farmerPhone || '9876543210';
      const name = booking.farmer_name || booking.farmerName || 'Farmer';
      const crop = booking.crop || 'Produce';
      const qty = booking.quantity || 0;
      const centre = booking.mandi_name || booking.mandiName || 'Mandi Centre';
      const date = booking.slot_date || booking.slotDate || 'Today';
      const time = booking.slot_time || booking.slotTime || 'Morning Window';
      const token = booking.token_number || booking.tokenNumber || 'KMN-000';

      this.sendNotification({
        notificationType: 'BOOKING_CONFIRMED',
        phoneNumber: phone,
        farmerName: name,
        bookingId: booking.id,
        userId: booking.farmer_id || booking.farmerId,
        variables: {
          crop,
          quantity: qty,
          centre_name: centre,
          slot_date: date,
          slot_time: time,
          token_number: token
        }
      });
    },

    /**
     * 2. Slot Arrival Reminder SMS
     */
    triggerSlotReminder(booking) {
      if (!booking) return;
      const phone = booking.farmer_phone || booking.farmerPhone || '9876543210';
      const name = booking.farmer_name || booking.farmerName || 'Farmer';
      const centre = booking.mandi_name || booking.mandiName || 'Mandi Centre';
      const time = booking.slot_time || booking.slotTime || 'Morning Window';
      const token = booking.token_number || booking.tokenNumber || 'KMN-000';
      const vehicle = booking.vehicle_number || booking.vehicleNumber || 'Registered Vehicle';

      this.sendNotification({
        notificationType: 'SLOT_REMINDER',
        phoneNumber: phone,
        farmerName: name,
        bookingId: booking.id,
        userId: booking.farmer_id || booking.farmerId,
        variables: {
          centre_name: centre,
          slot_time: time,
          token_number: token,
          vehicle_number: vehicle
        }
      });
    },

    /**
     * 3. Token Approaching Turn SMS (e.g. 3 vehicles ahead)
     */
    triggerTokenApproaching(booking, tokensAhead = 3) {
      if (!booking) return;
      const phone = booking.farmer_phone || booking.farmerPhone || '9876543210';
      const name = booking.farmer_name || booking.farmerName || 'Farmer';
      const token = booking.token_number || booking.tokenNumber || 'KMN-000';
      const centre = booking.mandi_name || booking.mandiName || 'Mandi Centre';

      this.sendNotification({
        notificationType: 'TOKEN_APPROACHING',
        phoneNumber: phone,
        farmerName: name,
        bookingId: booking.id,
        userId: booking.farmer_id || booking.farmerId,
        variables: {
          token_number: token,
          tokens_ahead: tokensAhead,
          centre_name: centre
        }
      });
    },

    /**
     * 4. Token Called for Immediate Entry / Weighment
     */
    triggerTokenCalled(booking) {
      if (!booking) return;
      const phone = booking.farmer_phone || booking.farmerPhone || '9876543210';
      const name = booking.farmer_name || booking.farmerName || 'Farmer';
      const token = booking.token_number || booking.tokenNumber || 'KMN-000';
      const centre = booking.mandi_name || booking.mandiName || 'Mandi Centre';

      this.sendNotification({
        notificationType: 'TOKEN_CALLED',
        phoneNumber: phone,
        farmerName: name,
        bookingId: booking.id,
        userId: booking.farmer_id || booking.farmerId,
        variables: {
          token_number: token,
          centre_name: centre
        }
      });
    },

    /**
     * 5. Procurement Weighment Completed & J-Form Generated
     */
    triggerProcurementCompleted(procurement) {
      if (!procurement) return;
      const phone = procurement.farmer_phone || procurement.farmerPhone || '9876543210';
      const name = procurement.farmer_name || procurement.farmerName || 'Farmer';
      const qty = parseFloat(procurement.quantity || 0).toFixed(2);
      const crop = procurement.crop || 'Produce';
      const centre = procurement.centre_name || 'Procurement Centre';
      const amount = Math.round(procurement.amount || 0).toLocaleString('en-IN');
      const receiptId = procurement.id || 'PROC-000';

      this.sendNotification({
        notificationType: 'PROCUREMENT_COMPLETED',
        phoneNumber: phone,
        farmerName: name,
        bookingId: procurement.booking_id || procurement.bookingId,
        userId: procurement.farmer_id || procurement.farmerId,
        variables: {
          quantity: qty,
          crop,
          centre_name: centre,
          amount,
          receipt_id: receiptId
        }
      });
    },

    /**
     * 6. DBT Payment Processed
     */
    triggerPaymentDisbursed(payment) {
      if (!payment) return;
      const phone = payment.farmer_phone || payment.farmerPhone || '9876543210';
      const name = payment.farmer_name || payment.farmerName || 'Farmer';
      const amount = Math.round(payment.amount || 0).toLocaleString('en-IN');
      const receiptId = payment.procurement_id || payment.procurementId || 'PROC-000';
      const txnId = payment.transaction_id || payment.transactionId || 'KSM-2026-00000';

      this.sendNotification({
        notificationType: 'PAYMENT_STATUS_UPDATED',
        phoneNumber: phone,
        farmerName: name,
        bookingId: payment.booking_id || payment.bookingId,
        userId: payment.farmer_id || payment.farmerId,
        variables: {
          amount,
          receipt_id: receiptId,
          transaction_id: txnId
        }
      });
    }
  };

  // Expose globally
  window.SMSClient = SMSClient;

})(typeof window !== 'undefined' ? window : global);
