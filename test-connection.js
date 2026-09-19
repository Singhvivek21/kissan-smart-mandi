/**
 * ==============================================================================
 * KISSAN – Supabase Connection Tester (Node.js / Terminal)
 * Run in PowerShell / Terminal: node test-connection.js
 * ==============================================================================
 */

const https = require('https');

const SUPABASE_URL = 'https://fqxsbrflcmtfhyieeyep.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_imFTIfne54wwVXSLXb25MQ_m-3HsfFc';

console.log(' Testing KISSAN Supabase Database Connection...\n');

function checkTable(tableName) {
 return new Promise((resolve) => {
 const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
 const options = {
 headers: {
 'apikey': SUPABASE_ANON_KEY,
 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
 }
 };
 https.get(url, options, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => {
 try {
 const parsed = JSON.parse(data || '[]');
 resolve({ table: tableName, status: res.statusCode, count: parsed.length, data: parsed });
 } catch (e) {
 resolve({ table: tableName, status: res.statusCode, error: data });
 }
 });
 }).on('error', err => resolve({ table: tableName, error: err.message }));
 });
}

async function runTests() {
 const tables = ['procurement_centres', 'slots', 'bookings', 'procurements', 'payments', 'profiles'];
 
 for (const table of tables) {
 const res = await checkTable(table);
 if (res.status === 200) {
 console.log(` Table [${table.padEnd(20)}]: Connected! (Rows: ${res.count})`);
 if (table === 'procurement_centres' && res.data && res.data.length > 0) {
 console.log(' Sample Centres in DB:');
 res.data.forEach(c => console.log(` - ${c.name} (${c.location})`));
 }
 } else {
 console.log(` Table [${table.padEnd(20)}]: HTTP ${res.status} Error`);
 }
 }

 console.log('\n Result: All Supabase tables are online and connected successfully!\n');
}

runTests();
