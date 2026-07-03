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
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

// Helper: compute alerts
function computeAlerts(devices) {
  const alerts = [];
  const now = new Date();
  const hour = now.getHours();
  const isAfterHours = hour >= 17 || hour < 9;

  // Group by room
  const rooms = [...new Set(devices.map(d => d.room))];
  for (const room of rooms) {
    const roomDevices = devices.filter(d => d.room === room);
    const onDevices = roomDevices.filter(d => d.status);

    // Alert: devices on after hours
    if (isAfterHours && onDevices.length > 0) {
      alerts.push({
        id: `after-hours-${room}`,
        type: 'after_hours',
        room,
        message: `${room}: ${onDevices.length} device(s) ON after office hours`,
        severity: 'high',
        timestamp: now.toISOString(),
      });
    }

    // Alert: all devices in a room on for more than 2h
    if (onDevices.length === 5) {
      const oldest = onDevices
        .map(d => new Date(d.last_changed_at))
        .sort((a, b) => a - b)[0];
      const hoursOn = (now - oldest) / 3600000;
      if (hoursOn >= 2) {
        alerts.push({
          id: `all-on-${room}`,
          type: 'all_on',
          room,
          message: `${room}: All devices have been ON for over 2 hours`,
          severity: 'medium',
          timestamp: now.toISOString(),
        });
      }
    }
  }
  return alerts;
}

// GET /api/status — full office state
app.get('/api/status', (req, res) => {
  const db = readDB();
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

  res.json({
    devices,
    rooms,
    total_power: totalPower,
    active_count: devices.filter(d => d.status).length,
    total_count: devices.length,
    alerts: computeAlerts(devices),
    timestamp: new Date().toISOString(),
  });
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

  // Estimate today's usage: average uptime * wattage / 1000
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
