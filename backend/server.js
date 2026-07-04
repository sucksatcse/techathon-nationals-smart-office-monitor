import 'dotenv/config';
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

// Discord Webhook URL — set DISCORD_WEBHOOK_URL in backend/.env to enable proactive alerts
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// DB Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const db = JSON.parse(raw);
  // Ensure alerts array exists
  if (!db.alerts) db.alerts = [];
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Discord Webhook Helper
// ─────────────────────────────────────────────────────────────────────────────

async function sendDiscordAlert(message) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log(`[Alert Simulation] Proactive alert generated: "${message}"`);
    console.log(`[Alert Simulation] Tip: Set DISCORD_WEBHOOK_URL in .env to send this to a real channel.`);
    return;
  }
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    console.log(`[Discord] Sent alert: ${message}`);
  } catch (err) {
    console.error('[Discord] Failed to send webhook:', err.message);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Build a human-friendly Discord message for an alert
// ─────────────────────────────────────────────────────────────────────────────

function buildDiscordMessage(alert, devices) {
  const roomDevices = devices.filter(d => d.room === alert.room && d.status);
  const fans   = roomDevices.filter(d => d.type === 'fan').length;
  const lights = roomDevices.filter(d => d.type === 'light').length;
  const hour   = new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (alert.type === 'after_hours') {
    const parts = [];
    if (fans > 0)   parts.push(`${fans} fan${fans > 1 ? 's' : ''}`);
    if (lights > 0) parts.push(`${lights} light${lights > 1 ? 's' : ''}`);
    const deviceStr = parts.length ? parts.join(' and ') : `${roomDevices.length} device(s)`;
    return `⚠️ Hey! **${alert.room}** still has ${deviceStr} ON and it's ${hour}. Did someone forget to leave?`;
  }

  if (alert.type === 'all_on_2h') {
    return `⏱️ Heads up! All devices in **${alert.room}** have been running continuously for over 2 hours. Consider turning some off!`;
  }

  return `⚠️ Alert in **${alert.room}**: ${alert.message}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stateful Alert Engine — runs every 5 seconds
// Persists alerts to db.json, de-duplicates by ID, timestamps on first trigger
// ─────────────────────────────────────────────────────────────────────────────

function runAlertEngine() {
  let db;
  try {
    db = readDB();
  } catch (err) {
    console.error('[AlertEngine] Could not read DB:', err.message);
    return;
  }

  const devices  = db.devices;
  const now      = new Date();
  const hour     = now.getHours();
  const isAfterHours = hour >= 16 || hour < 8; // Office Hours: 8 AM - 4 PM

  // Collect alert IDs that are UNRESOLVED (used to de-duplicate and fire Discord webhook once)
  const existingIds = new Set(db.alerts.filter(a => !a.resolved).map(a => a.id));
  const newAlerts   = [];

  // --- Group devices by room ---
  const rooms = [...new Set(devices.map(d => d.room))];

  for (const room of rooms) {
    const roomDevices = devices.filter(d => d.room === room);
    const onDevices   = roomDevices.filter(d => d.status);

    // ── Alert type 1: Devices ON after office hours (9 AM – 5 PM) ──────────
    const afterHoursId = `after-hours-${room}`;
    const lastTimeSent = db.alerts
      .filter(a => a.id === afterHoursId)
      .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp;
    
    const minutesSinceLast = lastTimeSent ? (now - new Date(lastTimeSent)) / 60000 : 999;

    if (isAfterHours && onDevices.length > 0) {
      // Only send if no unresolved alert exists AND we haven't sent one in the last 15 mins
      if (!existingIds.has(afterHoursId) && minutesSinceLast > 15) {
        const alert = {
          id: afterHoursId,
          type: 'after_hours',
          room,
          message: `${onDevices.length} device(s) left ON outside office hours (9 AM–5 PM). Current time: ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`,
          severity: 'high',
          timestamp: now.toISOString(),
          resolved: false,
          acknowledged: false,
        };
        db.alerts.push(alert);
        newAlerts.push(alert);
        existingIds.add(afterHoursId);
      }
    } else {
      // Office hours restored — mark old after-hours alert as resolved
      const idx = db.alerts.findIndex(a => a.id === afterHoursId && !a.resolved);
      if (idx !== -1) {
        db.alerts[idx].resolved = true;
        db.alerts[idx].resolved_at = now.toISOString();
      }
    }

    // ── Alert type 2: ALL devices in a room ON for ≥ 2 hours continuously ──
    if (onDevices.length === roomDevices.length && roomDevices.length > 0) {
      const allOnId = `all-on-2h-${room}`;
      // Find the LATEST (most recent) 'ON' transition time across ALL devices in the room.
      // If the most recent device was turned on 2 hours ago, then ALL have been on for at least 2 hours.
      const latestOnTimeAcrossAll = Math.max(...onDevices.map(d => new Date(d.last_changed_at).getTime()));
      const hoursAllOn = (now.getTime() - latestOnTimeAcrossAll) / 3_600_000;

      if (hoursAllOn >= 2 && !existingIds.has(allOnId)) {
        const alert = {
          id: allOnId,
          type: 'all_on_2h',
          room,
          message: `All devices in this room have been running continuously for over 2 hours. Consider turning some off to save power.`,
          severity: 'medium',
          timestamp: now.toISOString(),
          resolved: false,
          acknowledged: false,
        };
        db.alerts.push(alert);
        newAlerts.push(alert);
        existingIds.add(allOnId);
      }
    } else {
      // If some devices were turned off, resolve the alert
      const allOnId = `all-on-2h-${room}`;
      const idx = db.alerts.findIndex(a => a.id === allOnId && !a.resolved);
      if (idx !== -1) {
        db.alerts[idx].resolved = true;
        db.alerts[idx].resolved_at = now.toISOString();
      }
    }

  }

  // Persist updated DB
  try {
    writeDB(db);
  } catch (err) {
    console.error('[AlertEngine] Could not write DB:', err.message);
    return;
  }

  // Fire Discord webhook for each new alert (async, non-blocking)
  for (const alert of newAlerts) {
    const msg = buildDiscordMessage(alert, devices);
    sendDiscordAlert(msg);
    console.log(`[AlertEngine] New alert: [${alert.severity.toUpperCase()}] ${alert.room} — ${alert.type}`);
  }
}

// Run the alert engine every 5 seconds
setInterval(runAlertEngine, 5000);
// Also run once immediately on startup
setTimeout(runAlertEngine, 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Room summary helper (used by chat + status endpoints)
// ─────────────────────────────────────────────────────────────────────────────

function getRoomSummaries(devices) {
  return [...new Set(devices.map(d => d.room))].map(room => {
    const roomDevices = devices.filter(d => d.room === room);
    return {
      name: room,
      devices: roomDevices,
      active_count: roomDevices.filter(d => d.status).length,
      total_count: roomDevices.length,
      power_usage: roomDevices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/status — full office state
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const db = readDB();
  const devices = db.devices;

  const totalPower = devices
    .filter(d => d.status)
    .reduce((sum, d) => sum + d.power_draw, 0);

  const activeAlerts = db.alerts.filter(a => !a.resolved && !a.acknowledged);

  res.json({
    devices,
    rooms: getRoomSummaries(devices),
    total_power: totalPower,
    active_count: devices.filter(d => d.status).length,
    total_count: devices.length,
    alerts: activeAlerts,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts — all alerts (active + history)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/alerts', (req, res) => {
  const db = readDB();
  // Return newest first
  const sorted = [...db.alerts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(sorted);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/alerts/:id/acknowledge — acknowledge an alert
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const db = readDB();
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.acknowledged     = true;
  alert.acknowledged_at  = new Date().toISOString();
  writeDB(db);
  res.json({ success: true, alert });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/alerts/clear — clear all alert history
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/alerts/clear', (req, res) => {
  const db = readDB();
  db.alerts = [];
  writeDB(db);
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/room/:name — specific room status
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/usage — power consumption stats
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/devices — list all devices (for bot)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/devices', (req, res) => {
  const db = readDB();
  res.json(db.devices);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat — Natural language chat interface
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

  const devices       = db.devices;
  const alerts        = db.alerts.filter(a => !a.resolved && !a.acknowledged);
  const totalPower    = devices.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0);
  const estimatedKwh  = parseFloat((totalPower * 8 / 1000).toFixed(2));
  const activeDevices = devices.filter(d => d.status);
  const allRooms      = [...new Set(devices.map(d => d.room))];

  const roomSummary = (roomName) => {
    const rd = devices.filter(d => d.room === roomName);
    const fans        = rd.filter(d => d.type === 'fan'   && d.status).length;
    const lights      = rd.filter(d => d.type === 'light' && d.status).length;
    const totalFans   = rd.filter(d => d.type === 'fan').length;
    const totalLights = rd.filter(d => d.type === 'light').length;
    const power       = rd.filter(d => d.status).reduce((s, d) => s + d.power_draw, 0);
    const active      = rd.filter(d => d.status).length;
    const lines = [];
    lines.push(`**${roomName}**`);
    lines.push(`• Fans: ${fans}/${totalFans} ON`);
    lines.push(`• Lights: ${lights}/${totalLights} ON`);
    lines.push(`• Power: ${power}W`);
    if (active === 0)           lines.push('• Status: All devices OFF 😴');
    else if (active === rd.length) lines.push('• Status: All devices ON ⚡');
    else                        lines.push(`• Status: ${active}/${rd.length} devices ON`);
    return lines.join('\n');
  };

  // ── Intent: specific room ─────────────────────────────────────────────────
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

  // ── Intent: fans ─────────────────────────────────────────────────────────
  if (/fan/.test(raw)) {
    const onFans  = activeDevices.filter(d => d.type === 'fan');
    const allFans = devices.filter(d => d.type === 'fan');
    const lines = [`🌀 **Fan Status** (${onFans.length}/${allFans.length} ON)\n`];
    for (const room of allRooms) {
      const roomFans   = allFans.filter(d => d.room === room);
      const roomFansOn = roomFans.filter(d => d.status).length;
      lines.push(`• ${room}: ${roomFansOn}/${roomFans.length} fans ON`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: lights ───────────────────────────────────────────────────────
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

  // ── Intent: active / running devices ─────────────────────────────────────
  if (/active device|running device|devices (on|running|currently)|how many.*on/.test(raw)) {
    const lines = [`📟 **Active Devices** (${activeDevices.length}/${devices.length} total)\n`];
    for (const room of allRooms) {
      const rd = devices.filter(d => d.room === room);
      lines.push(`• ${room}: ${rd.filter(d => d.status).length}/${rd.length} ON`);
    }
    return res.json({ reply: lines.join('\n') });
  }

  // ── Intent: alerts / warnings ────────────────────────────────────────────
  if (/alert|warn|anomal/.test(raw)) {
    if (!alerts.length) {
      return res.json({ reply: '✅ **All Clear!**\n\nNo active alerts at the moment. Every device is operating within normal parameters. 🟢' });
    }
    const lines = [`🚨 **Active Alerts** (${alerts.length})\n`];
    alerts.forEach(a => {
      const sev = a.severity === 'high' ? '🔴' : '🟡';
      const time = new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      lines.push(`${sev} [${a.severity.toUpperCase()}] **${a.room}** at ${time}: ${a.message}`);
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
      `🏢 **Smart Office Status Report**\n`,
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
  console.log(`🚨 Alerts:  http://localhost:${PORT}/api/alerts`);
  if (DISCORD_WEBHOOK_URL) {
    console.log(`🤖 Discord: Webhook configured — proactive alerts enabled`);
  } else {
    console.log(`🤖 Discord: No webhook URL set — set DISCORD_WEBHOOK_URL in .env to enable proactive alerts`);
  }
});
