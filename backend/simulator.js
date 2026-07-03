console.log('🚀 Starting Office Device Simulator...');

async function runSimulatorTick() {
  try {
    // 1. Fetch current status to see devices
    const statusRes = await fetch('http://localhost:3001/api/status');
    if (!statusRes.ok) {
      throw new Error(`Failed to fetch status: ${statusRes.statusText}`);
    }
    
    const data = await statusRes.json();
    const devices = data.devices;
    if (!devices || devices.length === 0) {
      console.log('[Simulator] No devices found to simulate.');
      return;
    }

    // 2. Pick a random device to toggle (approx 1 in 3 chance every 5s)
    if (Math.random() > 0.6) {
      const randomIndex = Math.floor(Math.random() * devices.length);
      const device = devices[randomIndex];

      // 3. Make POST request to toggle device
      const toggleRes = await fetch('http://localhost:3001/api/devices/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room: device.room,
          name: device.name
        })
      });

      if (toggleRes.ok) {
        const toggleData = await toggleRes.json();
        console.log(`[Simulator] Toggled ${device.name} in ${device.room} to ${toggleData.device.status ? 'ON' : 'OFF'}`);
      } else {
        console.error(`[Simulator] Failed to toggle ${device.name}: ${toggleRes.statusText}`);
      }
    }
  } catch (err) {
    console.error('[Simulator Error] Connection or server error:', err.message);
  }
}

// Run every 5 seconds
setInterval(runSimulatorTick, 5000);
console.log('⏳ Simulator scheduler started (runs every 5 seconds)');
