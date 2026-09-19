/**
 * =============================================================================
 * KISSAN – Procure Smart Mandi
 * Procurement & Payment Management Service (services/procurementService.js)
 * High-Availability Storage with Supabase Cloud Sync & Strict Farmer Privacy
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROCUREMENTS_FILE = path.join(DATA_DIR, 'procurements.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class ProcurementService {
  constructor() {
    this.procurements = [];
    this.payments = [];
    this.loadFromDisk();
  }

  loadFromDisk() {
    // 1. Load Procurements
    try {
      if (fs.existsSync(PROCUREMENTS_FILE)) {
        const raw = fs.readFileSync(PROCUREMENTS_FILE, 'utf8');
        this.procurements = JSON.parse(raw);
        console.log(`🌾 [ProcurementService] Loaded ${this.procurements.length} procurements from storage.`);
      }
    } catch (err) {
      console.warn('⚠️ [ProcurementService] Error reading procurements file:', err.message);
      this.procurements = [];
    }

    // 2. Load Payments
    try {
      if (fs.existsSync(PAYMENTS_FILE)) {
        const rawPay = fs.readFileSync(PAYMENTS_FILE, 'utf8');
        this.payments = JSON.parse(rawPay);
        console.log(`💳 [ProcurementService] Loaded ${this.payments.length} payments from storage.`);
      }
    } catch (err) {
      console.warn('⚠️ [ProcurementService] Error reading payments file:', err.message);
      this.payments = [];
    }

    // Seed defaults if empty
    if (this.procurements.length === 0 || this.payments.length === 0) {
      this.seedDefaultData();
    }
  }

  seedDefaultData() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Seed 1: Rameshwar Singh - Paid Wheat Procurement
    const proc1 = {
      id: 'PROC-1021',
      booking_id: 'BK-8901',
      token_number: 'KMN-042',
      farmer_id: 'F-10024',
      farmer_name: 'Rameshwar Singh',
      farmer_phone: '9876543210',
      centre_id: 'M01',
      mandi_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
      crop: 'Wheat (गेहूं)',
      quantity: 40.0,
      gross_weight: 42.5,
      tare_weight: 2.5,
      net_weight: 40.0,
      quality: 'FAQ Grade A (11.5% Moisture)',
      quality_grade: 'FAQ Grade A (11.5% Moisture)',
      msp_rate: 2275,
      amount: 91000.0,
      status: 'COMPLETED',
      payment_status: 'Direct DBT Credited',
      date: yesterday,
      created_at: new Date(Date.now() - 86400000).toISOString()
    };

    const pay1 = {
      id: 'PAY-1021',
      procurement_id: 'PROC-1021',
      booking_id: 'BK-8901',
      token_number: 'KMN-042',
      farmer_id: 'F-10024',
      farmer_name: 'Rameshwar Singh',
      farmer_phone: '9876543210',
      crop: 'Wheat (गेहूं)',
      amount: 91000.0,
      status: 'PAID',
      transaction_id: 'KSM-DBT-2026-88129',
      payment_date: yesterday,
      created_at: new Date(Date.now() - 86400000).toISOString()
    };

    // Seed 2: Baldev Yadav - Pending Mustard Procurement
    const proc2 = {
      id: 'PROC-1022',
      booking_id: 'BK-8902',
      token_number: 'KMN-043',
      farmer_id: 'F-10088',
      farmer_name: 'Baldev Yadav',
      farmer_phone: '9812345678',
      centre_id: 'M01',
      mandi_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
      crop: 'Mustard (सरसों)',
      quantity: 35.0,
      gross_weight: 37.0,
      tare_weight: 2.0,
      net_weight: 35.0,
      quality: 'FAQ Grade A (7.8% Moisture)',
      quality_grade: 'FAQ Grade A (7.8% Moisture)',
      msp_rate: 5650,
      amount: 197750.0,
      status: 'COMPLETED',
      payment_status: 'Direct DBT Initiated',
      date: today,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    };

    const pay2 = {
      id: 'PAY-1022',
      procurement_id: 'PROC-1022',
      booking_id: 'BK-8902',
      token_number: 'KMN-043',
      farmer_id: 'F-10088',
      farmer_name: 'Baldev Yadav',
      farmer_phone: '9812345678',
      crop: 'Mustard (सरसों)',
      amount: 197750.0,
      status: 'PENDING',
      transaction_id: null,
      payment_date: null,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString()
    };

    this.procurements = [proc1, proc2];
    this.payments = [pay1, pay2];
    this.saveToDisk();
  }

  saveToDisk() {
    try {
      fs.writeFileSync(PROCUREMENTS_FILE, JSON.stringify(this.procurements, null, 2), 'utf8');
      fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(this.payments, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ [ProcurementService] Failed to persist data to disk:', err.message);
    }
  }

  /**
   * Get Procurements with strict Farmer Privacy Filtering
   * If farmer_id or farmer_phone is specified, only that farmer's records are returned.
   */
  getProcurements(filters = {}) {
    let result = [...this.procurements];

    const farmerId = filters.farmer_id || filters.farmerId;
    const farmerPhone = filters.farmer_phone || filters.farmerPhone;

    // Strict farmer scoping: if either filter is passed, match ONLY that farmer!
    if (farmerId || farmerPhone) {
      result = result.filter(p => {
        const idMatch = farmerId && (p.farmer_id === farmerId || p.farmerId === farmerId);
        const phoneMatch = farmerPhone && (p.farmer_phone === farmerPhone || p.farmerPhone === farmerPhone);
        return idMatch || phoneMatch;
      });
      return result;
    }

    // Additional filters for admin context
    if (filters.booking_id || filters.bookingId) {
      const bId = filters.booking_id || filters.bookingId;
      result = result.filter(p => p.booking_id === bId || p.bookingId === bId);
    }

    if (filters.status) {
      const st = filters.status.toUpperCase();
      result = result.filter(p => (p.status || '').toUpperCase() === st);
    }

    if (filters.crop) {
      result = result.filter(p => (p.crop || '').toLowerCase().includes(filters.crop.toLowerCase()));
    }

    return result;
  }

  /**
   * Get Payments with strict Farmer Privacy Filtering
   */
  getPayments(filters = {}) {
    let result = [...this.payments];

    const farmerId = filters.farmer_id || filters.farmerId;
    const farmerPhone = filters.farmer_phone || filters.farmerPhone;

    // Strict farmer scoping
    if (farmerId || farmerPhone) {
      result = result.filter(p => {
        const idMatch = farmerId && (p.farmer_id === farmerId || p.farmerId === farmerId);
        const phoneMatch = farmerPhone && (p.farmer_phone === farmerPhone || p.farmerPhone === farmerPhone);
        return idMatch || phoneMatch;
      });
      return result;
    }

    if (filters.status) {
      const st = filters.status.toUpperCase();
      result = result.filter(p => (p.status || '').toUpperCase() === st);
    }

    return result;
  }

  /**
   * Record a new procurement weighment entry
   */
  recordProcurement(payload) {
    const procCount = this.procurements.length + 1023;
    const procId = payload.id || `PROC-${procCount}`;
    const payId = payload.payment_id || `PAY-${procCount}`;
    const today = new Date().toISOString().split('T')[0];

    const quantity = parseFloat(payload.quantity || payload.net_weight || payload.netWeight || 40.0);
    const amount = parseFloat(payload.amount || payload.total_amount || payload.totalAmount || (quantity * (payload.msp_rate || 2275)));
    const status = (payload.status || 'COMPLETED').toUpperCase();
    const paymentStatus = payload.payment_status || (payload.paymentStatus || 'Direct DBT Initiated');

    const procurementRecord = {
      id: procId,
      booking_id: payload.booking_id || payload.bookingId || null,
      token_number: payload.token_number || payload.tokenNumber || 'N/A',
      farmer_id: payload.farmer_id || payload.farmerId || 'F-10024',
      farmer_name: payload.farmer_name || payload.farmerName || 'Farmer',
      farmer_phone: payload.farmer_phone || payload.farmerPhone || '9876543210',
      centre_id: payload.centre_id || payload.centreId || 'M01',
      mandi_name: payload.mandi_name || payload.mandiName || 'Krishi Upaj Mandi - Karnal',
      crop: payload.crop || 'Wheat (गेहूं)',
      quantity: quantity,
      gross_weight: parseFloat(payload.gross_weight || payload.grossWeight || (quantity + 2.0)),
      tare_weight: parseFloat(payload.tare_weight || payload.tareWeight || 2.0),
      net_weight: quantity,
      quality: payload.quality || payload.quality_grade || 'FAQ Grade A (11.5% Moisture)',
      quality_grade: payload.quality || payload.quality_grade || 'FAQ Grade A (11.5% Moisture)',
      msp_rate: parseFloat(payload.msp_rate || 2275),
      amount: amount,
      status: status,
      payment_status: paymentStatus,
      date: payload.date || today,
      created_at: new Date().toISOString()
    };

    const isPaid = paymentStatus.toLowerCase().includes('credited') || paymentStatus === 'PAID';
    const txnId = payload.transaction_id || (isPaid ? `KSM-DBT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}` : null);

    const paymentRecord = {
      id: payId,
      procurement_id: procId,
      booking_id: procurementRecord.booking_id,
      token_number: procurementRecord.token_number,
      farmer_id: procurementRecord.farmer_id,
      farmer_name: procurementRecord.farmer_name,
      farmer_phone: procurementRecord.farmer_phone,
      crop: procurementRecord.crop,
      amount: amount,
      status: isPaid ? 'PAID' : 'PENDING',
      transaction_id: txnId,
      payment_date: isPaid ? today : null,
      created_at: new Date().toISOString()
    };

    // Prepend to arrays
    this.procurements.unshift(procurementRecord);
    this.payments.unshift(paymentRecord);
    this.saveToDisk();

    console.log(`🌾 [ProcurementService] Recorded procurement ${procId} and payment ${payId} for ${procurementRecord.farmer_name}`);

    // Non-blocking sync with Supabase
    this.syncWithSupabase(procurementRecord, paymentRecord);

    return {
      success: true,
      procurement: procurementRecord,
      payment: paymentRecord
    };
  }

  /**
   * Process payment (Mark as PAID by Admin)
   */
  processPayment(paymentId, customTxnId = null) {
    const payment = this.payments.find(p => p.id === paymentId);
    if (!payment) {
      return { success: false, error: `Payment record #${paymentId} not found.` };
    }

    const today = new Date().toISOString().split('T')[0];
    const txnId = customTxnId || `KSM-DBT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    payment.status = 'PAID';
    payment.transaction_id = txnId;
    payment.payment_date = today;
    payment.updated_at = new Date().toISOString();

    // Also update corresponding procurement record
    const proc = this.procurements.find(p => p.id === payment.procurement_id);
    if (proc) {
      proc.payment_status = 'Direct DBT Credited';
      proc.transaction_id = txnId;
      proc.updated_at = new Date().toISOString();
    }

    this.saveToDisk();
    console.log(`💳 [ProcurementService] Disbursed payment ${paymentId} (₹${payment.amount}) with Txn: ${txnId}`);

    // Non-blocking Supabase sync
    this.syncPaymentWithSupabase(payment);

    return {
      success: true,
      payment,
      procurement: proc,
      transaction_id: txnId,
      amount: payment.amount,
      status: 'PAID'
    };
  }

  /**
   * Calculate aggregated metrics for the Admin Portal
   */
  getAggregatedStats() {
    const totalProcuredQty = this.procurements.reduce((sum, p) => sum + (parseFloat(p.quantity || p.net_weight || 0) || 0), 0);
    const totalProcurementAmount = this.procurements.reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);

    const paidPayments = this.payments.filter(p => (p.status || '').toUpperCase() === 'PAID');
    const pendingPayments = this.payments.filter(p => (p.status || '').toUpperCase() === 'PENDING');

    const totalPaidAmount = paidPayments.reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);
    const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + (parseFloat(p.amount || 0) || 0), 0);

    return {
      totalProcuredQty: parseFloat(totalProcuredQty.toFixed(2)),
      totalProcurementAmount: Math.round(totalProcurementAmount),
      totalPaidAmount: Math.round(totalPaidAmount),
      totalPendingAmount: Math.round(totalPendingAmount),
      completedPaymentsCount: paidPayments.length,
      pendingPaymentsCount: pendingPayments.length,
      totalProcurementsCount: this.procurements.length,
      totalPaymentsCount: this.payments.length
    };
  }

  /**
   * Non-blocking Supabase Synchronization
   */
  async syncWithSupabase(procurement, payment) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const url = process.env.SUPABASE_URL || 'https://wkzuvdcvtxomzvhwmsio.supabase.co';
      const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrenV2ZGN2dHhvbXp2aHdtc2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTQ5ODAsImV4cCI6MjA1NTkzMDk4MH0.M4S_lQOqM6iWjG1N4-lJ8zZt9_17F81YlJ_04V-fI8k';
      
      const supabase = createClient(url, key);
      await Promise.allSettled([
        supabase.from('procurements').upsert([procurement]),
        supabase.from('payments').upsert([payment])
      ]);
    } catch (e) {
      // Non-blocking
    }
  }

  async syncPaymentWithSupabase(payment) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const url = process.env.SUPABASE_URL || 'https://wkzuvdcvtxomzvhwmsio.supabase.co';
      const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrenV2ZGN2dHhvbXp2aHdtc2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTQ5ODAsImV4cCI6MjA1NTkzMDk4MH0.M4S_lQOqM6iWjG1N4-lJ8zZt9_17F81YlJ_04V-fI8k';
      
      const supabase = createClient(url, key);
      await supabase.from('payments').update({
        status: 'PAID',
        transaction_id: payment.transaction_id,
        payment_date: payment.payment_date
      }).eq('id', payment.id);
    } catch (e) {
      // Non-blocking
    }
  }
}

// Export singleton instance
module.exports = new ProcurementService();
