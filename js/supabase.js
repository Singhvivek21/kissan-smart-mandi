/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * Supabase Client Configuration & Database Helper (js/supabase.js)
 * ==============================================================================
 */

// ==============================================================================
// 1. SUPABASE CONFIGURATION
// ==============================================================================
const SUPABASE_URL = "https://fqxsbrflcmtfhyieeyep.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_imFTIfne54wwVXSLXb25MQ_m-3HsfFc";

// ==============================================================================
// 2. INITIALIZE SUPABASE CLIENT SAFELY
// ==============================================================================
let kissanSupabase = null;

try {
 // Grab the Supabase SDK loaded via CDN
 const sdk = window.supabase;
 if (sdk && typeof sdk.createClient === 'function') {
 if (SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 10) {
 kissanSupabase = sdk.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 window.supabaseClient = kissanSupabase;
 console.log(" KISSAN Supabase Client initialized successfully!");
 }
 }
} catch (err) {
 console.warn("Notice initializing Supabase client:", err);
}

// ==============================================================================
// 2.5 GLOBAL TOAST NOTIFICATION UTILITY
// ==============================================================================
window.showToast = function(message, type = 'info') {
  console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
  let toastEl = document.getElementById('kissanToast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'kissanToast';
    document.body.appendChild(toastEl);
  }
  
  let bg = '#1e293b';
  let color = '#ffffff';
  if (type === 'success') { bg = '#166534'; color = '#ffffff'; }
  else if (type === 'error') { bg = '#991b1b'; color = '#ffffff'; }
  else if (type === 'warning') { bg = '#9a3412'; color = '#ffffff'; }
  else if (type === 'info') { bg = '#1e293b'; color = '#ffffff'; }
  
  toastEl.style.backgroundColor = bg;
  toastEl.style.color = color;
  toastEl.style.display = 'flex';
  toastEl.style.opacity = '1';
  toastEl.textContent = message;

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toastEl.style.opacity = '0';
    setTimeout(() => { toastEl.style.display = 'none'; }, 200);
  }, 3500);
};

function showToast(message, type) {
  window.showToast(message, type);
}

// ==============================================================================
// 3. GLOBAL TEST FUNCTION (ALWAYS DEFINED ON WINDOW)
// ==============================================================================
window.testSupabaseConnection = async function() {
 console.log(" Checking Supabase connection...");

 const client = window.supabaseClient || kissanSupabase;

 if (!client) {
 const msg = " Supabase Client is not initialized. Please verify your connection or refresh the page.";
 console.warn(msg);
 if (window.showToast) window.showToast(msg, 'error');
 alert(msg);
 return { success: false, message: msg };
 }

 try {
 const { data, error } = await client
 .from('procurement_centres')
 .select('id, name, location, daily_capacity')
 .limit(5);

 if (error) {
 console.error(" Supabase query error:", error.message);
 if (window.showToast) window.showToast(`Supabase Error: ${error.message}`, 'error');
 alert(`Supabase Error: ${error.message}`);
 return { success: false, error: error.message };
 }

 const successMsg = ` Connected to Supabase! Found ${data.length} Procurement Centres in database.`;
 console.log(successMsg, data);
 if (window.showToast) window.showToast(successMsg, 'success');
 alert(successMsg + "\n\n" + data.map(c => `• ${c.name} (${c.location})`).join('\n'));
 return { success: true, message: successMsg, data: data };
 } catch (err) {
 console.error(" Unexpected connection error:", err);
 alert(`Connection error: ${err.message}`);
 return { success: false, error: err.message };
 }
};

// ==============================================================================
// 4. LOCALSTORAGE ENGINE & DATA FALLBACK
// ==============================================================================
window.KissanDB = {
 get(key, fallback = []) {
 try {
 const data = localStorage.getItem(`kissan_${key}`);
 return data ? JSON.parse(data) : fallback;
 } catch (e) {
 console.error(`Error reading ${key} from storage:`, e);
 return fallback;
 }
 },

 set(key, value) {
 try {
 localStorage.setItem(`kissan_${key}`, JSON.stringify(value));
 return true;
 } catch (e) {
 console.error(`Error saving ${key} to storage:`, e);
 return false;
 }
 },

 initDefaults() {
 if (!localStorage.getItem('kissan_mandis')) {
 const mandis = [
 { id: 'M01', name: 'Krishi Upaj Mandi - Sector 7, Karnal', district: 'Karnal', state: 'Haryana', capacity: 60, currentQueue: 8 },
 { id: 'M02', name: 'Anaaj Mandi - Main Hub, Ludhiana', district: 'Ludhiana', state: 'Punjab', capacity: 80, currentQueue: 14 },
 { id: 'M03', name: 'Kisan Samridhi Center - Khargone', district: 'Khargone', state: 'Madhya Pradesh', capacity: 50, currentQueue: 5 },
 { id: 'M04', name: 'Rajya Krishi Mandi - Meerut Bypass', district: 'Meerut', state: 'Uttar Pradesh', capacity: 70, currentQueue: 11 }
 ];
 this.set('mandis', mandis);
 }

 if (!localStorage.getItem('kissan_crops')) {
 const crops = [
 { id: 'C01', name: 'Wheat (गेहूं)', msp: 2275, maxMoisture: 12, unit: '₹/Quintal' },
 { id: 'C02', name: 'Paddy / Rice (धान - Grade A)', msp: 2203, maxMoisture: 17, unit: '₹/Quintal' },
 { id: 'C03', name: 'Mustard (सरसों)', msp: 5650, maxMoisture: 8, unit: '₹/Quintal' },
 { id: 'C04', name: 'Cotton / Kapas (कपास)', msp: 6620, maxMoisture: 10, unit: '₹/Quintal' },
 { id: 'C05', name: 'Gram / Chana (चना)', msp: 5440, maxMoisture: 14, unit: '₹/Quintal' },
 { id: 'C06', name: 'Maize (मक्का)', msp: 2090, maxMoisture: 14, unit: '₹/Quintal' }
 ];
 this.set('crops', crops);
 }

 if (!localStorage.getItem('kissan_current_farmer')) {
 const defaultFarmer = {
 id: 'F-10024',
 name: 'Rameshwar Singh',
 mobile: '9876543210',
 aadhaar: 'XXXX-XXXX-4512',
 state: 'Haryana',
 district: 'Karnal',
 village: 'Taraori',
 landholding: '6.5 Acres',
 bankAccount: 'SBI - A/C Ending in 8832'
 };
 this.set('current_farmer', defaultFarmer);
 }

 if (!localStorage.getItem('kissan_current_admin')) {
 const defaultAdmin = {
 id: 'ADM-01',
 name: 'Suresh Verma',
 role: 'Mandi Procurement Officer',
 mandiId: 'M01',
 mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal'
 };
 this.set('current_admin', defaultAdmin);
 }

  if (!localStorage.getItem('kissan_slots')) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const defaultSlots = [
      {
        id: 'slot-1',
        centre_id: 'M01',
        centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
        slot_date: today,
        start_time: '08:00',
        end_time: '11:00',
        capacity: 25,
        booked_count: 2,
        created_at: new Date().toISOString()
      },
      {
        id: 'slot-2',
        centre_id: 'M01',
        centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
        slot_date: today,
        start_time: '11:00',
        end_time: '14:00',
        capacity: 25,
        booked_count: 0,
        created_at: new Date().toISOString()
      },
      {
        id: 'slot-3',
        centre_id: 'M01',
        centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal',
        slot_date: tomorrow,
        start_time: '08:00',
        end_time: '11:00',
        capacity: 30,
        booked_count: 1,
        created_at: new Date().toISOString()
      }
    ];
    this.set('slots', defaultSlots);
  }

 if (!localStorage.getItem('kissan_bookings')) {
 const today = new Date().toISOString().split('T')[0];
 const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

 const initialBookings = [
 {
 id: 'BK-8901',
 tokenNumber: 'KMN-042',
 farmerId: 'F-10024',
 farmerName: 'Rameshwar Singh',
 farmerPhone: '9876543210',
 mandiId: 'M01',
 mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
 crop: 'Wheat (गेहूं)',
 quantity: 45,
 slotDate: today,
 slotTime: 'Morning (08:00 AM - 11:00 AM)',
 vehicleNumber: 'HR-05-AB-7721',
 vehicleType: 'Tractor Trolley',
 status: 'In Queue',
 queuePosition: 3,
 tokenOrder: 42,
 createdAt: new Date().toLocaleString()
 },
 {
 id: 'BK-8840',
 tokenNumber: 'KMN-028',
 farmerId: 'F-10024',
 farmerName: 'Rameshwar Singh',
 farmerPhone: '9876543210',
 mandiId: 'M01',
 mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
 crop: 'Mustard (सरसों)',
 quantity: 30,
 slotDate: '2026-03-10',
 slotTime: 'Noon (11:00 AM - 02:00 PM)',
 vehicleNumber: 'HR-05-AB-7721',
 vehicleType: 'Tractor Trolley',
 status: 'Procured',
 procurementId: 'PROC-5510',
 tokenOrder: 28,
 createdAt: '2026-03-08 10:15 AM'
 },
 {
 id: 'BK-8902',
 tokenNumber: 'KMN-043',
 farmerId: 'F-10088',
 farmerName: 'Baldev Yadav',
 farmerPhone: '9812345678',
 mandiId: 'M01',
 mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
 crop: 'Paddy / Rice (धान)',
 quantity: 60,
 slotDate: today,
 slotTime: 'Morning (08:00 AM - 11:00 AM)',
 vehicleNumber: 'PB-10-CD-9901',
 vehicleType: 'Mini Truck',
 status: 'In Queue',
 queuePosition: 4,
 tokenOrder: 43,
 createdAt: new Date().toLocaleString()
 },
 {
 id: 'BK-8903',
 tokenNumber: 'KMN-044',
 farmerId: 'F-10099',
 farmerName: 'Gurdeep Singh',
 farmerPhone: '9871122334',
 mandiId: 'M01',
 mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
 crop: 'Wheat (गेहूं)',
 quantity: 50,
 slotDate: tomorrow,
 slotTime: 'Noon (11:00 AM - 02:00 PM)',
 vehicleNumber: 'HR-05-XY-1234',
 vehicleType: 'Tractor Trolley',
 status: 'Confirmed',
 tokenOrder: 44,
 createdAt: new Date().toLocaleString()
 }
 ];
 this.set('bookings', initialBookings);
 }

 if (!localStorage.getItem('kissan_queue_state')) {
 const queueState = {
 mandiId: 'M01',
 currentServingToken: 'KMN-040',
 activeStage: 'Weighbridge Bay #2',
 estimatedWaitMinsPerVehicle: 12,
 tokensWaiting: ['KMN-041', 'KMN-042', 'KMN-043'],
 tokensUnderInspection: ['KMN-040'],
 tokensCompletedToday: 39,
 lastUpdated: new Date().toLocaleTimeString()
 };
 this.set('queue_state', queueState);
 }

  if (!localStorage.getItem('kissan_procurements')) {
  const procurements = [
  {
  id: 'PROC-5510',
  bookingId: 'BK-8840',
  tokenNumber: 'KMN-028',
  farmerId: 'F-10024',
  farmer_id: 'F-10024',
  farmerName: 'Rameshwar Singh',
  farmer_name: 'Rameshwar Singh',
  farmerPhone: '9876543210',
  farmer_phone: '9876543210',
  crop: 'Mustard (सरसों)',
  date: '2026-03-10',
  grossWeight: 32.5,
  tareWeight: 2.5,
  netWeight: 30.0,
  quantity: 30.0,
  moisture: 7.2,
  quality: 'FAQ Grade A',
  grade: 'FAQ Grade A (उत्कृष्ट)',
  ratePerQtl: 5650,
  grossTotal: 169500,
  deductions: 0,
  amount: 169500,
  netPayout: 169500,
  status: 'COMPLETED',
  payment_status: 'Direct DBT Credited (KSM-2026-88491)',
  paymentStatus: 'Direct DBT Credited (KSM-2026-88491)',
  bankRef: 'UTR-SBIN202603108849',
  officerName: 'Suresh Verma (Officer #104)',
  mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
  centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal'
  },
  {
  id: 'PROC-5490',
  bookingId: 'BK-8711',
  tokenNumber: 'KMN-015',
  farmerId: 'F-10024',
  farmer_id: 'F-10024',
  farmerName: 'Rameshwar Singh',
  farmer_name: 'Rameshwar Singh',
  farmerPhone: '9876543210',
  farmer_phone: '9876543210',
  crop: 'Wheat (गेहूं)',
  date: '2026-02-25',
  grossWeight: 42.0,
  tareWeight: 2.0,
  netWeight: 40.0,
  quantity: 40.0,
  moisture: 11.4,
  quality: 'FAQ Grade A',
  grade: 'FAQ Grade A',
  ratePerQtl: 2275,
  grossTotal: 91000,
  deductions: 0,
  amount: 91000,
  netPayout: 91000,
  status: 'COMPLETED',
  payment_status: 'Direct DBT Credited (KSM-2026-11025)',
  paymentStatus: 'Direct DBT Credited (KSM-2026-11025)',
  bankRef: 'UTR-SBIN202602251102',
  officerName: 'Suresh Verma (Officer #104)',
  mandiName: 'Krishi Upaj Mandi - Sector 7, Karnal',
  centre_name: 'Krishi Upaj Mandi - Sector 7, Karnal'
  }
  ];
  this.set('procurements', procurements);
  }

  if (!localStorage.getItem('kissan_payments')) {
  const payments = [
  {
  id: 'PAY-88491',
  farmer_id: 'F-10024',
  farmer_name: 'Rameshwar Singh',
  farmer_phone: '9876543210',
  procurement_id: 'PROC-5510',
  crop: 'Mustard (सरसों)',
  amount: 169500,
  transaction_id: 'KSM-2026-88491',
  status: 'PAID',
  payment_date: '2026-03-10',
  created_at: '2026-03-10T11:00:00.000Z'
  },
  {
  id: 'PAY-11025',
  farmer_id: 'F-10024',
  farmer_name: 'Rameshwar Singh',
  farmer_phone: '9876543210',
  procurement_id: 'PROC-5490',
  crop: 'Wheat (गेहूं)',
  amount: 91000,
  transaction_id: 'KSM-2026-11025',
  status: 'PAID',
  payment_date: '2026-02-25',
  created_at: '2026-02-25T14:30:00.000Z'
  }
  ];
  this.set('payments', payments);
  }

  if (!localStorage.getItem('kissan_notifications')) {
  const notifications = [
  {
  id: 'NOTIF-101',
  farmer_id: 'F-10024',
  title: 'Direct DBT Payment Disbursed',
  message: 'Payment of ₹1,69,500 has been marked as PAID via Direct Benefit Transfer. Reference: KSM-2026-88491.',
  is_read: false,
  created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
  id: 'NOTIF-102',
  farmer_id: 'F-10024',
  title: 'Procurement Completed',
  message: 'Procurement weighment of 30.00 Qtl Mustard has been completed. Form \'J\' certificate generated.',
  is_read: false,
  created_at: new Date(Date.now() - 7200000).toISOString()
  },
  {
  id: 'NOTIF-103',
  farmer_id: 'F-10024',
  title: 'Slot Booking Confirmed',
  message: 'Your procurement slot for Wheat (45.00 Qtl) at Krishi Upaj Mandi - Sector 7, Karnal has been booked. Token: KMN-042.',
  is_read: true,
  created_at: new Date(Date.now() - 86400000).toISOString()
  }
  ];
  this.set('notifications', notifications);
  }
  }
};

window.KissanDB.initDefaults();
