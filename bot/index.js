require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

// Cache for sent alerts to avoid spamming the channel (if using polling method)
const sentAlertIds = new Set();

client.once('ready', () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);
  
  // Note: Backend now pushes proactive alerts via webhooks, 
  // but we'll include the poller as a fallback for the bot channel.
  setInterval(pollAlerts, 15000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Proactive Alert Polling (Fallback for Bot Interaction)
// ─────────────────────────────────────────────────────────────────────────────

async function findAlertsChannel(client) {
  if (process.env.DISCORD_ALERTS_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_ALERTS_CHANNEL_ID);
      if (channel) return channel;
    } catch (e) {
      console.warn("Could not fetch DISCORD_ALERTS_CHANNEL_ID from env, searching guilds...");
    }
  }

  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(c => 
      c.type === 0 && (c.name.toLowerCase() === 'alerts' || c.name.toLowerCase() === 'general')
    );
    if (channel) return channel;
  }
  return null;
}

async function pollAlerts() {
  try {
    const res = await axios.get(`${BACKEND_URL}/status`);
    const alerts = res.data.alerts || [];

    const channel = await findAlertsChannel(client);
    if (!channel) return;

    const activeIds = new Set();

    for (const alert of alerts) {
      activeIds.add(alert.id);

      if (!sentAlertIds.has(alert.id)) {
        sentAlertIds.add(alert.id);

        let emoji = alert.severity === 'high' ? '🚨' : '⚠️';
        let messageText = `${emoji} **Alert Triggered!**\n${alert.message}`;

        await channel.send(messageText);
      }
    }

    // Clear resolved alerts from the cache
    for (const id of sentAlertIds) {
      if (!activeIds.has(id)) {
        sentAlertIds.delete(id);
      }
    }
  } catch (error) {
    console.error('[Alert Poller Error]:', error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Handler Helper (shared between Discord and Mock Mode)
// ─────────────────────────────────────────────────────────────────────────────

async function handleCommand(content, authorName, replyFn) {
  if (!content.startsWith('!')) return;

  const args    = content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // ─── !status ──────────────────────────────────────────────────────────
    if (command === 'status') {
      const { data } = await axios.get(`${BACKEND_URL}/status`);

      const fields = data.rooms.map(room => {
        const fans   = room.devices.filter(d => d.type === 'fan'   && d.status).map(d => d.name);
        const lights = room.devices.filter(d => d.type === 'light' && d.status).map(d => d.name);
        const offAll = room.active_count === 0;

        let value = offAll
          ? '😴 All devices OFF'
          : [
              fans.length   ? `🌀 Fans ON: ${fans.join(', ')}`     : `🌀 Fans: all OFF`,
              lights.length ? `💡 Lights ON: ${lights.join(', ')}` : `💡 Lights: all OFF`,
              `⚡ ${room.power_usage}W`,
            ].join('\n');

        return { name: room.name, value };
      });

      const response = {
        title: '🏢 Smart Office — Live Status',
        color: data.alerts.length > 0 ? '#ef4444' : '#10b981',
        fields: [
          ...fields,
          { name: 'Summary', value: `⚡ **Total Power:** ${data.total_power}W  |  📟 **Devices:** ${data.active_count}/${data.total_count} ON` }
        ]
      };

      if (data.alerts.length > 0) {
        response.fields.push({
          name: `🚨 Active Alerts (${data.alerts.length})`,
          value: data.alerts.map(a => `• ${a.room}: ${a.message}`).join('\n').slice(0, 1024),
        });
      }

      return replyFn(response);
    }

    // ─── !room ────────────────────────────────────────────────────────────
    if (command === 'room') {
      const roomArg = args.join(' ').toLowerCase();
      if (!roomArg) return replyFn('Please specify a room name, e.g., `!room drawing` or `!room work1`.');

      const nameMap = {
        'drawing': 'drawing', 'work1': 'work1', 'work2': 'work2',
        'drawing room': 'drawing', 'work room 1': 'work1', 'work room 2': 'work2'
      };

      const mappedRoom = nameMap[roomArg] || roomArg;
      try {
        const { data } = await axios.get(`${BACKEND_URL}/room/${mappedRoom}`);
        const deviceList = data.devices.map(d => 
          ` ${d.status ? '🟢' : '🔴'} **${d.name}**: ${d.status ? 'ON' : 'OFF'} (${d.power_draw}W)`
        ).join('\n');

        return replyFn({
          title: `🚪 Room Report: ${data.room}`,
          description: `Individual status breakdown:\n\n${deviceList}\n\nCurrently, **${data.active_count}** devices are ON drawing **${data.power_usage}W**.`,
          color: '#3b82f6'
        });
      } catch (e) {
        return replyFn(`Sorry, I couldn't find a room matching "${roomArg}". Try \`drawing\`, \`work1\`, or \`work2\`.`);
      }
    }

    // ─── !usage ───────────────────────────────────────────────────────────
    if (command === 'usage') {
      const { data } = await axios.get(`${BACKEND_URL}/usage`);
      return replyFn({
        title: '⚡ Power Consumption',
        description: `**Current Load:** ${data.current_watts}W\n**Estimated Today:** ${data.estimated_kwh_today} kWh`,
        color: '#f59e0b',
        fields: data.rooms.map(r => ({ name: r.name, value: `${r.power}W` }))
      });
    }

    // ─── !alerts ──────────────────────────────────────────────────────────
    if (command === 'alerts') {
      const { data: alerts } = await axios.get(`${BACKEND_URL}/alerts`);
      const activeAlerts = alerts.filter(a => !a.resolved && !a.acknowledged);

      if (activeAlerts.length === 0) {
        return replyFn({
          title: '✅ All Clear!',
          description: 'No active alerts. Every device is operating within normal parameters.'
        });
      }

      return replyFn({
        title: `🚨 Active Alerts (${activeAlerts.length})`,
        color: '#ef4444',
        fields: activeAlerts.map(a => ({
          name: `${a.severity === 'high' ? '🔴' : '🟡'} ${a.room}`,
          value: `${a.message}`
        }))
      });
    }

    // ─── !help ────────────────────────────────────────────────────────────
    if (command === 'help') {
      return replyFn({
        title: '🤖 Smart Office Bot — Commands',
        fields: [
          { name: '`!status`',  value: 'Full office status' },
          { name: '`!room <n>`', value: 'Specific room report' },
          { name: '`!usage`',   value: 'Power consumption' },
          { name: '`!alerts`',  value: 'Active alerts' },
          { name: '`!help`',    value: 'Show this menu' },
        ]
      });
    }

  } catch (error) {
    console.error('[Bot Error]', error.message);
    replyFn('❌ Error: Could not fetch data from the Smart Office API.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bot Initialization
// ─────────────────────────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  const discordReply = (content) => {
    if (typeof content === 'string') return message.reply(content);
    
    const embed = new EmbedBuilder()
      .setTitle(content.title)
      .setColor(content.color || '#6366f1')
      .setDescription(content.description || null)
      .setTimestamp();
    
    if (content.fields) embed.addFields(...content.fields.map(f => ({ ...f, inline: f.inline !== false })));
    
    return message.reply({ embeds: [embed] });
  };

  await handleCommand(message.content, message.author.username, discordReply);
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup Logic
// ─────────────────────────────────────────────────────────────────────────────

const token = process.env.DISCORD_TOKEN;

if (!token || token === 'your_token_here' || token.length < 50) {
  console.log('⚠️  No valid DISCORD_TOKEN found in .env');
  console.log('🚀 Starting in **MOCK MODE** (Terminal Simulator)...');
  console.log('👉 Type commands directly here (e.g., !status, !help)\n');

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (data) => {
    const input = data.trim();
    if (!input) return;

    const mockReply = (content) => {
      console.log('\n--- [MOCK BOT REPLY] ---');
      if (typeof content === 'string') {
        console.log(content);
      } else {
        console.log(`TITLE: ${content.title}`);
        if (content.description) console.log(`DESC:  ${content.description}`);
        if (content.fields) {
          content.fields.forEach(f => console.log(`FIELD [${f.name}]: ${f.value}`));
        }
      }
      console.log('------------------------\n');
    };

    await handleCommand(input, 'TerminalUser', mockReply);
  });
} else {
  client.login(token).catch(err => {
    console.error('❌ Failed to login to Discord:', err.message);
    console.log('💡 Starting Mock Mode as fallback...');
    // Fallback logic here if desired, but we'll stick to process exit for now per current structure
    process.exit(1);
  });
}
