const fs = require('fs');

async function run() {
  const res = await fetch('http://localhost:8080/api/ai-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'how i can find crop is having some disease',
      selectedLang: 'en-IN',
      farmer: { name: 'Rameshwar Singh', id: 'F-10024', district: 'Karnal', phone: '9876543210' },
      context: {
        booking: { token_number: 'KMN-042', crop: 'Mustard (सरसों)' }
      }
    })
  });

  const data = await res.json();
  fs.writeFileSync('disease_output.txt', data.reply || JSON.stringify(data), 'utf8');
  console.log('Saved to disease_output.txt, length:', (data.reply || '').length);
}

run().catch(console.error);
