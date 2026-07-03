const https = require('https');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));

// Transform settings from object to array of {key, value} pairs
const settingsArr = [];
if (data.settings) {
  for (const [key, value] of Object.entries(data.settings)) {
    settingsArr.push({ key, value: String(value) });
  }
}
data.settings = settingsArr;

const body = JSON.stringify(data);
const req = https.request({
  hostname: 'almani-server.onrender.com',
  path: '/api/seed',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(res.statusCode, d.slice(0, 200)));
});
req.write(body);
req.end();
