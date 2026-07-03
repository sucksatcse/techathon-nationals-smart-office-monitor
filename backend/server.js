import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());

// Helper: read DB
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { devices: [], power_history: [], alerts: [], settings: { simulated_hour: null, office_hours_start: 9, office_hours_end: 17 } };
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (err) {
    console.error('Error reading DB:', err);
    return { devices: [], power_history: [], alerts: [], settings: { simulated_hour: null, office_hours_start: 9, office_hours_end: 17 } };
  }
}

// Helper: write DB
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Helper: update alerts
function updateAlerts(db) {
  const devices = db.devices;
  const now = new Date();
  
  const settings = db.settings || { simulated_hour: null, office_hours_start: 9, office_hours_end: 17 };
  let hour;
  if (settings.simulated_hour !== null && settings.simulated_hour !== undefined) {
    hour = Number(settings.simulated_hour);
  } else {
    hour = now.getHours();
  }
  
  const isAfterHours = hour >= settings.office_hours_end || hour < settings.office_hours_start;
  
  if (!db.alerts) db.alerts = [];
  
  const activeAlertIds = new Set();
  
  // 1. Check for After Hours usage
  devices.forEach(device => {
    if (isAfterHours && device.status) {
      const alertId = `after-hours-${device.room.replace(/\s+/g, '-')}-${device.name.replace(/\s+/g, '-')}`;
      activeAlertIds.add(alertId);
      
      const existingAlert = db.alerts.find(a => a.id === alertId);
      if (!existingAlert) {
        db.alerts.push({
          id: alertId,
          type: 'after_hours',
          room: device.room,
          deviceName: device.name,
          message: `${device.room}: ${device.name} is ON after office hours (${hour}:00)`,
          severity: 'high',
          timestamp: now.toISOString(),
          acknowledged: false,
          resolved: false
        });
      } else if (existingAlert.resolved) {
        existingAlert.resolved = false;
        existingAlert.timestamp = now.toISOString(); // update timestamp
      }
    }
  });
  
  // 2. Check for "all devices in a room on for more than 2h"
  const rooms = [...new Set(devices.map(d => d.room))];
  rooms.forEach(room => {
    const roomDevices = devices.filter(d => d.room === room);
    const onDevices = roomDevices.filter(d => d.status);
    
    if (onDevices.length === roomDevices.length && roomDevices.length > 0) {
      const oldest = onDevices
        .map(d => new Date(d.last_changed_at || now))
        .sort((a, b) => a - b)[0];
      
      const hoursOn = (now - oldest) / 3600000;
      
      if (hoursOn >= 2) {
        const alertId = `all-on-${room.replace(/\s+/g, '-')}`;
        activeAlertIds.add(alertId);
        
        const existingAlert = db.alerts.find(a => a.id === alertId);
        if (!existingAlert) {
          db.alerts.push({
            id: alertId,
            type: 'all_on',
            room,
            message: `${room}: All devices have been ON for over 2 hours`,
            severity: 'medium',
            timestamp: now.toISOString(),
            acknowledged: false,
            resolved: false
          });
        } else if (existingAlert.resolved) {
          existingAlert.resolved = false;
          existingAlert.timestamp = now.toISOString();
        }
      }
    }
  });
  
  // 3. Mark resolved alerts
  db.alerts.forEach(alert => {
    if (!alert.resolved && !activeAlertIds.has(alert.id)) {
      if (alert.type === 'after_hours') {
        const device = devices.find(d => d.room === alert.room && d.name === alert.deviceName);
        if (!device || !device.status || !isAfterHours) {
          alert.resolved = true;
          alert.resolved_at = now.toISOString();
        }
      } else if (alert.type === 'all_on') {
        const roomDevices = devices.filter(d => d.room === alert.room);
        const onDevices = roomDevices.filter(d => d.status);
        if (onDevices.length < roomDevices.length) {
          alert.resolved = true;
          alert.resolved_at = now.toISOString();
        }
      }
    }
  });
}

// Periodically record power history (every 5 seconds)
setInterval(() => {
  const db = readDB();
  const devices = db.devices;
  const currentTotalPower = devices.filter(d => d.status).reduce((sum, d) => sum + d.power_draw, 0);
  
  if (!db.power_history) db.power_history = [];
  db.power_history.push({
    timestamp: new Date().toISOString(),
    power: currentTotalPower
  });
  
  if (db.power_history.length > 50) {
    db.power_history.shift();
  }
  
  writeDB(db);
}, 5000);

// GET /api/status — full office state
app.get('/api/status', (req, res) => {
  const db = readDB();
  updateAlerts(db);
  writeDB(db);

  const devices = db.devices;
  const totalPower = devices
    .filter(d => d.status)
    .reduce((sum, d) => sum + d.power_draw, 0);

  const rooms = [...new Set(devices.map(d => d.room))].map(room => {
    const roomDevices = devices.filter(d => d.room === room);
    return {
      name: room,
      devices: roomDevices,
      active_count: roomDevices.filter(d => d.status).length,
      total_count: roomDevices.length,
      power_usage: roomDevices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0),
    };
  });

  const activeAlerts = db.alerts.filter(a => !a.resolved);

  res.json({
    devices,
    rooms,
    total_power: totalPower,
    active_count: devices.filter(d => d.status).length,
    total_count: devices.length,
    alerts: activeAlerts,
    all_alerts: db.alerts,
    settings: db.settings,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/devices/toggle — toggle a device state
app.post('/api/devices/toggle', (req, res) => {
  const { room, name } = req.body;
  if (!room || !name) {
    return res.status(400).json({ message: 'Room and device name are required' });
  }

  const db = readDB();
  const device = db.devices.find(d => d.room === room && d.name === name);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }

  device.status = !device.status;
  device.last_changed_at = new Date().toISOString();

  updateAlerts(db);
  writeDB(db);

  console.log(`[Simulator/Control] Toggled ${device.name} in ${device.room} to ${device.status ? 'ON' : 'OFF'}`);

  res.json({ success: true, device });
});

// GET /api/alerts — fetch alerts list
app.get('/api/alerts', (req, res) => {
  const db = readDB();
  updateAlerts(db);
  writeDB(db);
  res.json(db.alerts || []);
});

// POST /api/alerts/:id/acknowledge — acknowledge alert
app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const db = readDB();
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) {
    return res.status(404).json({ message: 'Alert not found' });
  }

  alert.acknowledged = true;
  writeDB(db);

  res.json({ success: true, alert });
});

// POST /api/alerts/clear — clear resolved/acknowledged alerts
app.post('/api/alerts/clear', (req, res) => {
  const db = readDB();
  // Keep only active and unacknowledged alerts
  db.alerts = (db.alerts || []).filter(a => !a.resolved && !a.acknowledged);
  writeDB(db);
  res.json({ success: true, alerts: db.alerts });
});

// GET /api/settings — get settings
app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(db.settings || { simulated_hour: null, office_hours_start: 9, office_hours_end: 17 });
});

// POST /api/settings — update settings
app.post('/api/settings', (req, res) => {
  const { simulated_hour, office_hours_start, office_hours_end } = req.body;
  const db = readDB();

  if (!db.settings) db.settings = { simulated_hour: null, office_hours_start: 9, office_hours_end: 17 };

  if (simulated_hour !== undefined) db.settings.simulated_hour = simulated_hour;
  if (office_hours_start !== undefined) db.settings.office_hours_start = office_hours_start;
  if (office_hours_end !== undefined) db.settings.office_hours_end = office_hours_end;

  updateAlerts(db);
  writeDB(db);

  res.json({ success: true, settings: db.settings });
});

// GET /api/room/:name — specific room status
app.get('/api/room/:name', (req, res) => {
  const db = readDB();
  const nameMap = {
    'drawing': 'Drawing Room',
    'work1': 'Work Room 1',
    'work2': 'Work Room 2',
  };
  const roomName = nameMap[req.params.name.toLowerCase()] || req.params.name;
  const roomDevices = db.devices.filter(d =>
    d.room.toLowerCase().includes(req.params.name.toLowerCase()) || d.room === roomName
  );
  if (!roomDevices.length) return res.status(404).json({ message: 'Room not found' });

  res.json({
    room: roomName,
    devices: roomDevices,
    active_count: roomDevices.filter(d => d.status).length,
    total_count: roomDevices.length,
    power_usage: roomDevices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0),
  });
});

// GET /api/usage — power consumption stats
app.get('/api/usage', (req, res) => {
  const db = readDB();
  const devices = db.devices;
  const totalPower = devices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0);

  const estimatedKwh = parseFloat((totalPower * 8 / 1000).toFixed(2));

  const rooms = [...new Set(devices.map(d => d.room))].map(room => ({
    name: room,
    power: devices.filter(d => d.room === room && d.status).reduce((s, d) => s + d.power_draw, 0),
  }));

  res.json({
    current_watts: totalPower,
    estimated_kwh_today: estimatedKwh,
    rooms,
    history: db.power_history.slice(-30),
    timestamp: new Date().toISOString(),
  });
});

// GET /api/devices — list all devices (for bot)
app.get('/api/devices', (req, res) => {
  const db = readDB();
  res.json(db.devices);
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Office API running on http://localhost:${PORT}`);
  console.log(`📊 Status:  http://localhost:${PORT}/api/status`);
  console.log(`⚡ Usage:   http://localhost:${PORT}/api/usage`);
});
