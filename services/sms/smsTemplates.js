/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * SMS Templates & Message Compilation (services/sms/smsTemplates.js)
 * ==============================================================================
 * 
 * NOTE:
 * In development/hackathon mode (SMS_MODE=mock), messages are rendered directly
 * without requiring Indian DLT registration or MSG91 Flow IDs.
 * 
 * For production (SMS_MODE=msg91), approved DLT Entity ID, Sender ID, and Flow IDs
 * must be configured via environment variables. No fake IDs are ever generated.
 */

const SMS_TEMPLATES = {
  // 1. Slot Booking Confirmation
  BOOKING_CONFIRMED: {
    name: 'Slot Booking Confirmed',
    dltTemplateId: process.env.DLT_TEMPLATE_BOOKING_CONFIRMED || null,
    msg91FlowId: process.env.MSG91_FLOW_BOOKING_CONFIRMED || null,
    text: 'Dear {farmer_name}, your procurement slot for {crop} ({quantity} Qtl) is CONFIRMED at {centre_name} on {slot_date} ({slot_time}). Token: {token_number}. Please keep this token ready upon arrival. — KISSAN Mandi Portal',
    variables: ['farmer_name', 'crop', 'quantity', 'centre_name', 'slot_date', 'slot_time', 'token_number']
  },

  // 2. Token Turn Approaching (Live queue notice: ≤ 3 vehicles ahead)
  TOKEN_APPROACHING: {
    name: 'Token Turn Approaching',
    dltTemplateId: process.env.DLT_TEMPLATE_TOKEN_APPROACHING || null,
    msg91FlowId: process.env.MSG91_FLOW_TOKEN_APPROACHING || null,
    text: 'Notice: Dear {farmer_name}, your Token {token_number} is approaching turn ({tokens_ahead} vehicles ahead) at {centre_name}. Please proceed towards the Entry Gate / Inspection Bay. — KISSAN Mandi',
    variables: ['farmer_name', 'token_number', 'tokens_ahead', 'centre_name']
  },

  // 3. Token Called for Immediate Gate Entry / Weighment
  TOKEN_CALLED: {
    name: 'Token Called to Weighbridge',
    dltTemplateId: process.env.DLT_TEMPLATE_TOKEN_CALLED || null,
    msg91FlowId: process.env.MSG91_FLOW_TOKEN_CALLED || null,
    text: 'URGENT: Dear {farmer_name}, Token {token_number} is CALLED NOW to Bay / Weighbridge at {centre_name}. Please move your vehicle immediately for weighment and quality grading. — KISSAN Mandi',
    variables: ['farmer_name', 'token_number', 'centre_name']
  },

  // 4. Official Procurement Weighment Completed & J-Form Generated
  PROCUREMENT_COMPLETED: {
    name: 'Procurement Weighment Completed',
    dltTemplateId: process.env.DLT_TEMPLATE_PROCUREMENT_COMPLETED || null,
    msg91FlowId: process.env.MSG91_FLOW_PROCUREMENT_COMPLETED || null,
    text: 'Weighment Receipt: Dear {farmer_name}, procurement of {quantity} Qtl {crop} has been COMPLETED at {centre_name}. Total Value: Rs {amount}. Official Form J #{receipt_id} generated. Direct DBT payment initiated. — KISSAN Mandi',
    variables: ['farmer_name', 'quantity', 'crop', 'centre_name', 'amount', 'receipt_id']
  },

  // 5. Direct Benefit Transfer (DBT) Payment Processed
  PAYMENT_STATUS_UPDATED: {
    name: 'DBT Payment Processed',
    dltTemplateId: process.env.DLT_TEMPLATE_PAYMENT_STATUS || null,
    msg91FlowId: process.env.MSG91_FLOW_PAYMENT_STATUS || null,
    text: 'DBT Payment: Dear {farmer_name}, payment of Rs {amount} for Form J #{receipt_id} has been PROCESSED. Transaction Ref: {transaction_id}. Disbursed via PFMS to your Aadhaar-linked bank account. — KISSAN Mandi',
    variables: ['farmer_name', 'amount', 'receipt_id', 'transaction_id']
  }
};

/**
 * Compile a template string with actual variable values
 * Missing variables are replaced with appropriate fallbacks or dashes
 * @param {string} notificationType
 * @param {Object} variables
 * @returns {{ message: string, template: Object }}
 */
function compileTemplate(notificationType, variables = {}) {
  const template = SMS_TEMPLATES[notificationType];
  if (!template) {
    throw new Error(`Unknown SMS notification type: "${notificationType}". Available: ${Object.keys(SMS_TEMPLATES).join(', ')}`);
  }

  let compiledText = template.text;

  // Substitute all variables
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const safeVal = (value !== null && value !== undefined && String(value).trim()) ? String(value).trim() : '--';
    compiledText = compiledText.replace(regex, safeVal);
  }

  // Clean any remaining unfilled braces
  compiledText = compiledText.replace(/\{[a-z0-9_]+\}/gi, '--');

  return {
    message: compiledText,
    template
  };
}

module.exports = {
  SMS_TEMPLATES,
  compileTemplate
};
