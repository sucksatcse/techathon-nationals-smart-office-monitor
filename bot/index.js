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
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    if (command === 'status') {
      // Mock data for now until backend is ready
      const embed = new EmbedBuilder()
        .setTitle('🟩 Smart Office Status')
        .setColor('#10b981')
        .addFields(
          { name: 'Drawing Room', value: '🟢 Fan 1, 🟢 Fan 2, 🔴 Light 1, 🟢 Light 2, 🔴 Light 3' },
          { name: 'Work Room 1', value: '🟢 All Active' },
          { name: 'Work Room 2', value: '🔴 All Inactive' },
          { name: 'Total Usage', value: '420W' }
        )
        .setTimestamp()
        .setFooter({ text: 'Smart Office Monitor' });

      return message.reply({ embeds: [embed] });
    }

    if (command === 'usage') {
      const embed = new EmbedBuilder()
        .setTitle('⚡ Power Consumption')
        .setColor('#f59e0b')
        .setDescription('Total power right now: **420W**\nToday\'s estimated usage: **4.2 kWh**')
        .addFields(
          { name: 'Drawing Room', value: '120W', inline: true },
          { name: 'Work Room 1', value: '250W', inline: true },
          { name: 'Work Room 2', value: '50W', inline: true }
        )
        .setTimestamp();
      
      return message.reply({ embeds: [embed] });
    }
  } catch (error) {
    console.error(error);
    message.reply('❌ Sorry, I couldn\'t fetch the data from the office.');
  }
});

client.login(process.env.DISCORD_TOKEN);
