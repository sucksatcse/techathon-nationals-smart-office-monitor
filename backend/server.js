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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat  — Natural-language chat interface (same data as Discord Bot)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', (req, res) => {
  const raw = (req.body.message || '').toLowerCase().trim();
  if (!raw) return res.json({ reply: "Please type a question and I'll help you! 😊" });

  let db;
  try {
    db = readDB();
  } catch {
    return res.json({ reply: "Sorry, I couldn't retrieve the latest office information. Please try again in a moment. 🙏" });
  }

  const devices  = db.devices;
  const alerts   = computeAlerts(devices);
  const totalPower = devices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0);
  const estimatedKwh = parseFloat((totalPower * 8 / 1000).toFixed(2));
  const activeDevices = devices.filter(d => d.status);
  const allRooms = [...new Set(devices.map(d => d.room))];

  const roomSummary = (roomName) => {
    const rd = devices.filter(d => d.room === roomName);
    const fans   = rd.filter(d => d.type === 'fan'   && d.status).length;
    const lights = rd.filter(d => d.type === 'light' && d.status).length;
    const totalFans   = rd.filter(d => d.type === 'fan').length;
    const totalLights = rd.filter(d => d.type === 'light').length;
    const power  = rd.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0);
    const active = rd.filter(d => d.status).length;
    const lines = [];
    lines.push(`**${roomName}**`);
    lines.push(`• Fans: ${fans}/${totalFans} ON`);
    lines.push(`• Lights: ${lights}/${totalLights} ON`);
    lines.push(`• Power: ${power}W`);
    if (active === 0) lines.push('• Status: All devices OFF 😴');
    else if (active === rd.length) lines.push('• Status: All devices ON ⚡');
    else lines.push(`• Status: ${active}/${rd.length} devices ON`);
    return lines.join('\n');
  };

  // ── Intent: specific room ──────────────────────────────────────────────────
  const roomAliases = {
    'Drawing Room': ['drawing room', 'drawing', 'draw'],
    'Work Room 1':  ['work room 1', 'work1', 'workroom1', 'work 1', 'room 1'],
    'Work Room 2':  ['work room 2', 'work2', 'workroom2', 'work 2', 'room 2'],
  };
  for (const [roomName, aliases] of Object.entries(roomAliases)) {
    if (aliases.some(a => raw.includes(a))) {
      const rd = devices.filter(d => d.room === roomName);
      if (!rd.length) return res.json({ reply: `I couldn't find any devices in **${roomName}**. 🤔` });
      return res.json({ reply: `Here's the current status for ${roomSummary(roomName)} 📊` });
    }
  }

  // ── Intent: fans ──────────────────────────────────────────────────────────
  if (/fan/.test(raw)) {
    const onFans  = activeDevices.filter(d => d.type === 'fan');
    const allFans = devices.filter(d => d.type === 'fan');
    const lines = [`🌀 **Fan Status** (${onFans.length}/${allFans.length} ON)\n`];
    for (const room of allRooms) {
      const roomFans    = allFans.filter(d => d.room === room);
      const roomFansOn  = roomFans.filter(d => d.status).length;
      lines.push(`• ${room}: ${roomFansOn}/${roomFans.length} fans ON`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: lights ────────────────────────────────────────────────────────
  if (/light/.test(raw)) {
    const onLights  = activeDevices.filter(d => d.type === 'light');
    const allLights = devices.filter(d => d.type === 'light');
    const lines = [`💡 **Light Status** (${onLights.length}/${allLights.length} ON)\n`];
    for (const room of allRooms) {
      const roomLights   = allLights.filter(d => d.room === room);
      const roomLightsOn = roomLights.filter(d => d.status).length;
      lines.push(`• ${room}: ${roomLightsOn}/${roomLights.length} lights ON`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: active / running devices ──────────────────────────────────────
  if (/active device|running device|devices (on|running|currently)|how many.*on/.test(raw)) {
    const lines = [`📟 **Active Devices** (${activeDevices.length}/${devices.length} total)\n`];
    for (const room of allRooms) {
      const rd = devices.filter(d => d.room === room);
      lines.push(`• ${room}: ${rd.filter(d => d.status).length}/${rd.length} ON`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: alerts / warnings ─────────────────────────────────────────────
  if (/alert|warn|anomal/.test(raw)) {
    if (!alerts.length) {
      return res.json({ reply: '✅ **All Clear!**\n\nNo active alerts at the moment. Every device is operating within normal parameters. 🟢' });
    }
    const lines = [`🚨 **Active Alerts** (${alerts.length})\n`];
    alerts.forEach(a => {
      const sev = a.severity === 'high' ? '🔴' : '🟡';
      lines.push(`${sev} [${a.severity.toUpperCase()}] ${a.message}`);
    });
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: highest power / most active room ──────────────────────────────
  if (/highest|most (power|electric|energy|active)|which room/.test(raw)) {
    const roomPowers = allRooms.map(r => ({
      name: r,
      power: devices.filter(d => d.room === r && d.status).reduce((s, d) => s + d.power_draw, 0),
    })).sort((a, b) => b.power - a.power);
    const top = roomPowers[0];
    const lines = [`🏆 **Highest Power Consumption**\n`];
    lines.push(`**${top.name}** leads with **${top.power}W**\n`);
    roomPowers.forEach(r => lines.push(`• ${r.name}: ${r.power}W`));
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: daily / kwh usage ─────────────────────────────────────────────
  if (/daily|kwh|today|estimated|energy today/.test(raw)) {
    return res.json({
      reply:
        `📅 **Estimated Daily Usage**\n\n` +
        `Based on the current load of **${totalPower}W**, the office is projected to consume **${estimatedKwh} kWh** today.\n\n` +
        `This estimate assumes 8 hours of continuous operation at the current power draw.`,
    });
  }

  // ── Intent: power / wattage / electricity ─────────────────────────────────
  if (/power|watt|electric|consumption|usage|energy|kw/.test(raw)) {
    const lines = [
      `⚡ **Current Power Consumption**\n`,
      `The office is currently drawing **${totalPower} Watts** total.\n`,
    ];
    for (const room of allRooms) {
      const p = devices.filter(d => d.room === room && d.status).reduce((s, d) => s + d.power_draw, 0);
      lines.push(`• ${room}: ${p}W`);
    }
    lines.push(`\n📅 Estimated daily usage: **${estimatedKwh} kWh**`);
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: full office status ────────────────────────────────────────────
  if (/status|office|overview|summary|current|report|how is|what is|show/.test(raw)) {
    const lines = [
      `🏢 **SmartOffice Status Report**\n`,
      `⚡ Total Power: **${totalPower}W**`,
      `📟 Active Devices: **${activeDevices.length}/${devices.length}**`,
      `🚨 Active Alerts: **${alerts.length}**`,
      `📅 Est. Daily: **${estimatedKwh} kWh**\n`,
    ];
    for (const room of allRooms) {
      lines.push(roomSummary(room));
      lines.push('');
    }
    if (alerts.length === 0) {
      lines.push('✅ Everything is operating normally.');
    } else {
      lines.push(`⚠️ ${alerts.length} alert(s) require attention.`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  return res.json({
    reply:
      `I'm not sure how to answer that. Try asking about:\n\n` +
      `• **Office status** — overall summary\n` +
      `• **Power usage** — current watts & daily estimate\n` +
      `• **Active devices** — what's currently ON\n` +
      `• **Fans / Lights** — device-type breakdown\n` +
      `• **Room status** — Drawing Room, Work Room 1, Work Room 2\n` +
      `• **Alerts** — active warnings\n` +
      `• **Highest power** — most consuming room`,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Office API running on http://localhost:${PORT}`);
  console.log(`📊 Status:  http://localhost:${PORT}/api/status`);
  console.log(`⚡ Usage:   http://localhost:${PORT}/api/usage`);
  console.log(`💬 Chat:    http://localhost:${PORT}/api/chat`);
});
