import React, { useState, useEffect, useRef } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, Line, 
  BarChart, Bar, 
  PieChart, Pie, Cell, 
  AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { Zap, Activity, Battery, TrendingUp, Clock, AlertCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Summary card states
  const [currentPower, setCurrentPower] = useState(0);
  const [peakPower, setPeakPower] = useState(0);
  const [averagePower, setAveragePower] = useState(0);
  const [activeDevices, setActiveDevices] = useState(0);
  const [estimatedDaily, setEstimatedDaily] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Chart data states
  const [historyData, setHistoryData] = useState([]);
  const [roomData, setRoomData] = useState([]);
  const [deviceTypeData, setDeviceTypeData] = useState([]);
  const [kwhGrowthData, setKwhGrowthData] = useState([]);

  // Use a ref to keep track of the peak power to survive component re-renders
  const peakPowerRef = useRef(0);

  const fetchData = async (isInitial = false) => {
    try {
      const [statusRes, usageRes] = await Promise.all([
        fetch('http://localhost:3001/api/status'),
        fetch('http://localhost:3001/api/usage')
      ]);

      if (!statusRes.ok || !usageRes.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const statusData = await statusRes.json();
      const usageData = await usageRes.json();

      const timeString = new Date(statusData.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      // Update current metrics
      setCurrentPower(statusData.total_power);
      setActiveDevices(statusData.active_count);
      setEstimatedDaily(usageData.estimated_kwh_today);
      setLastUpdated(new Date(statusData.timestamp));

      // Calculate peak power
      if (statusData.total_power > peakPowerRef.current) {
        peakPowerRef.current = statusData.total_power;
        setPeakPower(statusData.total_power);
      }

      // Update Room Consumption Bar Chart Data
      const formattedRooms = statusData.rooms.map(room => ({
        name: room.name,
        power: room.power_usage
      }));
      setRoomData(formattedRooms);

      // Update Device Type Distribution Pie Chart Data
      let lightPower = 0;
      let fanPower = 0;
      statusData.devices.forEach(dev => {
        if (dev.status) {
          if (dev.type === 'light') lightPower += dev.power_draw;
          if (dev.type === 'fan') fanPower += dev.power_draw;
        }
      });
      setDeviceTypeData([
        { name: 'Lights', value: lightPower },
        { name: 'Fans', value: fanPower }
      ]);

      // Handle history update
      setHistoryData(prevHistory => {
        let newHistory = [...prevHistory];

        if (isInitial) {
          // Pre-populate with backend history if empty
          if (usageData.history && usageData.history.length > 0) {
            newHistory = usageData.history.map(pt => {
              const ptTime = new Date(pt.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });
              const ptPower = pt.power;
              return {
                time: ptTime,
                totalPower: ptPower,
                activeDevices: Math.min(statusData.total_count, Math.round(ptPower / 30)) || 0,
                kwh: parseFloat(((ptPower * 8) / 1000).toFixed(2))
              };
            });
          }
        }

        // Add the new point
        const newPoint = {
          time: timeString,
          totalPower: statusData.total_power,
          activeDevices: statusData.active_count,
          kwh: usageData.estimated_kwh_today
        };

        // Check if the last item is duplicate by timestamp to prevent dual insertions on startup
        if (newHistory.length === 0 || newHistory[newHistory.length - 1].time !== timeString) {
          newHistory.push(newPoint);
        }

        // Keep last 50 data points
        if (newHistory.length > 50) {
          newHistory.shift();
        }

        // Calculate average power
        const sum = newHistory.reduce((acc, curr) => acc + curr.totalPower, 0);
        setAveragePower(Math.round(sum / newHistory.length));

        // Generate kWh growth trend throughout the day
        const growth = [];
        let runningKwh = 0;
        newHistory.forEach((pt, index) => {
          // Assume each interval step adds a small fractional energy based on power draw
          // 2 seconds = 2 / 3600 of an hour
          runningKwh += parseFloat(((pt.totalPower * (2 / 3600)) / 1000).toFixed(6));
          growth.push({
            time: pt.time,
            kwh: parseFloat(runningKwh.toFixed(4))
          });
        });
        setKwhGrowthData(growth);

        return newHistory;
      });

      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Could not connect to the API server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchData(true);

    // Update every 2 seconds (2,000 milliseconds)
    const interval = setInterval(() => {
      fetchData(false);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Loading office analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-red-500/5 border border-red-500/10 rounded-2xl gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h3 className="text-lg font-semibold text-zinc-100">Connection Error</h3>
        <p className="text-zinc-400 max-w-md text-sm">{error}</p>
        <button 
          onClick={() => { setLoading(true); fetchData(true); }}
          className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all font-medium text-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard 
          title="Current Power" 
          value={`${currentPower} W`} 
          icon={<Zap className="text-yellow-400" />} 
          detail="Real-time draw"
        />
        <SummaryCard 
          title="Peak Power Today" 
          value={`${peakPower} W`} 
          icon={<TrendingUp className="text-red-400" />} 
          detail="Max observed draw"
        />
        <SummaryCard 
          title="Average Power" 
          value={`${averagePower} W`} 
          icon={<Activity className="text-blue-400" />} 
          detail="Mean history draw"
        />
        <SummaryCard 
          title="Active Devices" 
          value={`${activeDevices}`} 
          icon={<Battery className="text-green-400" />} 
          detail="Currently turned ON"
        />
        <SummaryCard 
          title="Daily Estimate" 
          value={`${estimatedDaily} kWh`} 
          icon={<Zap className="text-purple-400" />} 
          detail="Forecasted energy use"
        />
        <SummaryCard 
          title="Last Updated" 
          value={lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
          icon={<Clock className="text-zinc-400" />} 
          detail={lastUpdated.toLocaleDateString([], { month: 'short', day: 'numeric' })}
        />
      </div>

      {/* Main Chart - Live Total Power Consumption */}
      <div className="dashboard-card bg-gradient-to-br from-card to-zinc-900/40">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-6">
          <div>
            <h3 className="text-lg font-semibold">Live Total Power Consumption</h3>
            <p className="text-xs text-zinc-400">Aggregated wattage draw tracked over time (updated every 2s)</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Live Analytics
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="powerGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} unit="W" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
              />
              <Line 
                type="monotone" 
                dataKey="totalPower" 
                name="Power Draw"
                stroke="#3b82f6" 
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                fill="url(#powerGlow)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: Room Comparison & Device Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Room Usage */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-2">Power Consumption by Room</h3>
          <p className="text-xs text-zinc-400 mb-6">Real-time load comparison across rooms in Watts</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} unit="W" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                />
                <Bar dataKey="power" name="Power Usage" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {roomData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Distribution */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-2">Device Type Distribution</h3>
          <p className="text-xs text-zinc-400 mb-6">Proportion of power consumed by light fixtures vs cooling fans</p>
          <div className="h-[300px] w-full flex items-center justify-center">
            {deviceTypeData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {deviceTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                    formatter={(value) => [`${value} W`, 'Load']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value, entry) => <span className="text-xs text-zinc-300 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-zinc-500 text-sm">No devices are currently active to display distribution.</p>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Estimated Daily Energy Usage & Active Devices Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Estimated energy usage growth */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-2">Estimated Daily Energy Usage</h3>
          <p className="text-xs text-zinc-400 mb-6">Cumulative daily power consumption curve in kilowatt-hours (kWh)</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kwhGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="kwhColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} unit="kWh" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="kwh" name="Energy Usage" stroke="#10b981" fillOpacity={1} fill="url(#kwhColor)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Devices Trend */}
        <div className="dashboard-card">
          <h3 className="text-lg font-semibold mb-2">Active Devices Trend</h3>
          <p className="text-xs text-zinc-400 mb-6">Fluctuations in the number of concurrent active devices over time</p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                />
                <Line type="step" dataKey="activeDevices" name="Active Devices" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, detail }) {
  return (
    <div className="dashboard-card p-4 border border-white/5 bg-zinc-900/50 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{title}</span>
        <div className="bg-white/5 p-1.5 rounded-lg shrink-0">
          {icon}
        </div>
      </div>
      <div>
        <h4 className="text-xl font-bold tracking-tight text-zinc-100">{value}</h4>
        <span className="text-[10px] text-zinc-500 font-medium">{detail}</span>
      </div>
    </div>
  );
}
