# 🏢 Smart Office Monitor: Modern Operations Center

[![Node.js Express](https://img.shields.io/badge/Backend-Node.js%20Express-339933?style=for-the-badge&logo=node.js)](https://expressjs.com)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![Discord.js](https://img.shields.io/badge/Bot-Discord.js-5865F2?style=for-the-badge&logo=discord)](https://discord.js.org)

> A premium, real-time IoT monitoring solution for modern offices. This system bridges the gap between simulated device data, a high-aesthetic dashboard with interactive control, and a conversational Discord bot.

---

## 🚀 Key Features

### 🖥️ Interactive Dashboard
- **Top-Down Office Visualization**: An SVG-powered interactive floor plan with dynamic assets.
- **Clickable Device Map**: Click on any light or fan in the visual map to toggle its power state!
- **Micro-Animations**: Fans rotate when active and have a realistic wobbling effect; lights glow when ON.
- **Live Energy Metering**: Real-time per-room power consumption meter showing total and individual room loads.
- **Smart Alerts**: Automatic detection of devices left on after office hours (9 AM - 5 PM) or left on for >2 hours.

### 🤖 Intelligent Discord Bot
- **Real-Time Data Queries**: Ask `@OfficeBot` about usage patterns and get live answers.
- **Rich Embeds**: Visual status reports for every room with detailed status emojis.
- **Proactive Notifications**: Automatic alerts pushed to Discord text channels when anomalies are detected.

---

## 🏗️ System Architecture

Our system uses a single source of truth (`db.json` database layer) with the following data flow:

![System Architecture Diagram](docs/system_diagram.png)

---

## ⚡ Hardware/Electrical Schematic

A representative circuit schematic for a single office room showing how the ESP32 microcontroller interfaces with relays to control and monitor the status of lights and fans:

![Hardware Schematic](docs/hardware_schematic.png)

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- Node.js 20+ and npm
- A Discord Bot Token (Create one at the [Discord Developer Portal](https://discord.com/developers/applications))

### 2. Backend & Simulator Setup
The backend runs both the API server (Port 3001) and the device status simulator concurrently.

```bash
cd backend
npm install
npm start
```

### 3. Frontend Dashboard Setup
The React/Vite development server runs on Port 5173.

```bash
cd frontend
npm install
npm run dev
```

### 4. Discord Bot Setup
Create a `.env` file in the `bot` folder using `.env.example` as a template, then start the bot:

```bash
cd bot
npm install
# Create bot/.env with your DISCORD_TOKEN
npm start
```

---

## 🤖 Discord Bot Commands

| Command | Action |
|---|---|
| `!status` | Get a friendly conversational overview of all room device statuses. |
| `!room <name>` | Get the status of a specific room (e.g., `!room drawing` or `!room work1`). |
| `!usage` | View total office power draw breakdown by room and daily kWh estimate. |
| `!alerts` | View currently active security or power usage anomalies. |
| `!help` | List all available bot commands. |

---

*Built with ❤️ by the Smart Office Team.*