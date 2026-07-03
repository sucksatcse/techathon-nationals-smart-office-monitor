import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'db.json');

console.log('🚀 Starting Office Device Simulator...');

// Helper to read DB
function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (err) {
    console.error('Error reading DB:', err);
    return null;
  }
}

// Helper to write DB
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Ensure the db.json is created properly before simulating
setInterval(() => {
  const db = readDB();
  if (!db) return;

  const devices = db.devices;
  
  // Pick a random device to toggle (approx 1 in 3 chance every 5s)
  if (Math.random() > 0.6) {
    const randomIndex = Math.floor(Math.random() * devices.length);
    const device = devices[randomIndex];
    
    device.status = !device.status;
    device.last_changed_at = new Date().toISOString();
    
    console.log(`[Simulator] Toggled ${device.name} in ${device.room} to ${device.status ? 'ON' : 'OFF'}`);
  }

  // Update power history
  const currentTotalPower = devices.filter(d => d.status).reduce((sum, d) => sum + d.power_draw, 0);
  
  db.power_history.push({
    timestamp: new Date().toISOString(),
    power: currentTotalPower
  });

  // Keep history to last 30 data points
  if (db.power_history.length > 30) {
    db.power_history.shift();
  }

  writeDB(db);

}, 5000); // Run every 5 seconds
