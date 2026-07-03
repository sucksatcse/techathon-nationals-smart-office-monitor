require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

client.once('ready', () => {
  console.log(`🤖 Bot is online as ${client.user.tag}`);
  
  // Start polling alerts every 15 seconds for proactive warnings
  setInterval(pollAlerts, 15000);
});

// Cache for sent alerts to avoid spamming the channel
const sentAlertIds = new Set();

async function findAlertsChannel(client) {
  if (process.env.DISCORD_ALERTS_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(process.env.DISCORD_ALERTS_CHANNEL_ID);
      if (channel) return channel;
    } catch (e) {
      console.warn("Could not fetch DISCORD_ALERTS_CHANNEL_ID from env, searching guilds...");
    }
  }

  // Fallback: search client guilds for #alerts or #general text channel
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

        if (alert.type === 'after_hours') {
          messageText = `${emoji} **After-Hours Device Warning!**\nHey team, it looks like **${alert.deviceName}** in the **${alert.room}** is still running. Since it's past office hours, did someone forget to switch it off? Let's save some energy! 🔌`;
        } else if (alert.type === 'all_on') {
          messageText = `${emoji} **Energy Waste Alert!**\nHeads up! All devices in the **${alert.room}** have been left ON for over 2 hours. Can someone verify if they're still needed? 😮`;
        }

        await channel.send(messageText);
      }
    }

    // Clear resolved alerts from the sent list so they can trigger again
    for (const id of sentAlertIds) {
      if (!activeIds.has(id)) {
        sentAlertIds.delete(id);
      }
    }
  } catch (error) {
    console.error('[Alert Poller Error]:', error.message);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🤖 Smart Office Bot commands')
        .setColor('#3b82f6')
        .setDescription('Here are the available commands to check on the office:')
        .addFields(
          { name: '`!status`', value: 'Check device statuses for all rooms.' },
          { name: '`!room <name>`', value: 'Check status for a specific room (e.g. `!room work1`).' },
          { name: '`!usage`', value: 'Show current power load and estimated daily consumption.' },
          { name: '`!alerts`', value: 'View any active office security/power anomalies.' }
        )
        .setFooter({ text: 'Smart Office Monitor' });

      return message.reply({ embeds: [embed] });
    }

    if (command === 'status') {
      const res = await axios.get(`${BACKEND_URL}/status`);
      const { rooms, total_power, active_count, total_count } = res.data;

      let roomDescriptions = rooms.map(r => {
        const lightsOn = r.devices.filter(d => d.type === 'light' && d.status).length;
        const fansOn = r.devices.filter(d => d.type === 'fan' && d.status).length;

        if (lightsOn === 0 && fansOn === 0) {
          return `• **${r.name}**: All devices are currently turned off. 😴`;
        }
        
        const lightText = lightsOn > 0 ? `${lightsOn} light${lightsOn > 1 ? 's' : ''}` : '';
        const fanText = fansOn > 0 ? `${fansOn} fan${fansOn > 1 ? 's' : ''}` : '';
        const parts = [lightText, fanText].filter(Boolean);
        
        return `• **${r.name}**: ${parts.join(' and ')} ON (${r.power_usage}W draw).`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏢 Office Device Status')
        .setColor('#10b981')
        .setDescription(`Hello Boss! Here's the live status of our office devices:\n\n${roomDescriptions}\n\nTotal load right now is **${total_power}W** across **${active_count}/${total_count}** running devices.`)
        .setTimestamp()
        .setFooter({ text: 'Smart Office Monitor' });

      return message.reply({ embeds: [embed] });
    }

    if (command === 'room') {
      const roomArg = args.join(' ').toLowerCase();
      if (!roomArg) {
        return message.reply('Please specify a room name, e.g., `!room drawing` or `!room work1`.');
      }

      const nameMap = {
        'drawing': 'drawing',
        'drawing room': 'drawing',
        'work1': 'work1',
        'work 1': 'work1',
        'work room 1': 'work1',
        'work2': 'work2',
        'work 2': 'work2',
        'work room 2': 'work2'
      };

      const mappedRoom = nameMap[roomArg];
      if (!mappedRoom) {
        return message.reply(`Sorry, I couldn't find a room matching "${roomArg}". Please try \`drawing\`, \`work1\`, or \`work2\`.`);
      }

      const res = await axios.get(`${BACKEND_URL}/room/${mappedRoom}`);
      const { room, devices, active_count, power_usage } = res.data;

      const deviceList = devices.map(d => 
        ` ${d.status ? '🟢' : '🔴'} **${d.name}**: ${d.status ? 'ON' : 'OFF'} (${d.power_draw}W)`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🚪 Room Report: ${room}`)
        .setColor('#3b82f6')
        .setDescription(`Here is the individual status breakdown for **${room}**:\n\n${deviceList}\n\nCurrently, **${active_count}** devices are ON drawing **${power_usage}W** in total.`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (command === 'usage') {
      const res = await axios.get(`${BACKEND_URL}/usage`);
      const { current_watts, estimated_kwh_today, rooms } = res.data;

      const breakdown = rooms.map(r => `• **${r.name}**: ${r.power}W`).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⚡ Electricity Usage Report')
        .setColor('#f59e0b')
        .setDescription(`Here's our current electrical load:\n\n• **Total Power Draw**: **${current_watts}W**\n• **Today's Estimated Energy**: **${estimated_kwh_today} kWh**\n\n**Room Breakdown**:\n${breakdown}`)
        .setTimestamp()
        .setFooter({ text: 'Smart Office Monitor' });

      return message.reply({ embeds: [embed] });
    }

    if (command === 'alerts') {
      const res = await axios.get(`${BACKEND_URL}/status`);
      const { alerts } = res.data;

      if (!alerts || alerts.length === 0) {
        return message.reply('🎉 **All clear!** No active device anomalies detected in the office right now.');
      }

      const alertList = alerts.map(a => {
        const emoji = a.severity === 'high' ? '🚨' : '⚠️';
        return `${emoji} **[${a.severity.toUpperCase()}]** ${a.message} (triggered <t:${Math.floor(new Date(a.timestamp).getTime() / 1000)}:R>)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Active Office Alerts')
        .setColor('#ef4444')
        .setDescription(`Here are the active anomalies currently detected:\n\n${alertList}`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('[Bot Command Error]:', error.message);
    message.reply('❌ Oops! I ran into an error trying to connect to the office server. Please make sure the backend is online.');
  }
});

client.login(process.env.DISCORD_TOKEN);
