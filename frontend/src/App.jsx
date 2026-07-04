import React, { useState, useEffect } from 'react';
import { Layout, Zap, AlertTriangle, Monitor, Settings, Activity, Home, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OfficeMap from './components/OfficeMap';
import Analytics from './components/Analytics';
import AlertsPage from './components/AlertsPage';
import FloatingChat from './components/FloatingChat';

const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2'];

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [apiData, setApiData] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Poll the backend every 2.5 seconds
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/status');
        const data = await res.json();
        setApiData(data);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };
    
    fetchStatus();
    const pollTimer = setInterval(fetchStatus, 2500);
    return () => clearInterval(pollTimer);
  }, []);

  const totalPower = apiData ? `${apiData.total_power}W` : '420W';
  const activeCount = apiData ? `${apiData.active_count} / ${apiData.total_count}` : '9 / 15';
  const totalAlerts = apiData && apiData.alerts ? apiData.alerts.length : 0;


  return (
    <div className="flex h-screen w-full bg-background text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-white/5 flex flex-col pt-8
        transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-6 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Layout className="w-6 h-6 text-primary" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SmartOffice</h1>
          </div>
          <button 
            className="lg:hidden p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors" 
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            icon={<Home size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} 
          />
          <NavItem 
            icon={<Monitor size={20} />} 
            label="Office Layout" 
            active={activeTab === 'layout'} 
            onClick={() => { setActiveTab('layout'); setSidebarOpen(false); }} 
          />

          <NavItem 
            icon={<AlertTriangle size={20} />} 
            label="Alerts" 
            active={activeTab === 'alerts'} 
            onClick={() => { setActiveTab('alerts'); setSidebarOpen(false); }} 
            badge={2}
          />
          <NavItem 
            icon={<Activity size={20} />} 
            label="Analytics" 
            active={activeTab === 'analytics'} 
            onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }} 
          />
        </nav>

        <div className="p-6 border-t border-white/5">
          <NavItem icon={<Settings size={20} />} label="Settings" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 lg:h-20 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-background/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 lg:gap-4">
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors" 
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium">{currentTime.toLocaleTimeString()}</p>
              <p className="text-[10px] text-zinc-500">{currentTime.toLocaleDateString()}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Top Stats */}
                <div className="stat-cards-grid">
                  <StatCard title="Total Power" value={totalPower} detail="Real-time" icon={<Zap className="text-yellow-400" />} />
                  <StatCard title="Active Devices" value={activeCount} detail="Live status" icon={<Activity className="text-blue-400" />} />
                  <StatCard title="Total Alerts" value={totalAlerts} detail={totalAlerts ? "High priority" : "All clear"} icon={<AlertTriangle className={totalAlerts ? "text-red-400" : "text-zinc-500"} />} />
                  <StatCard title="Estimated Daily" value={apiData ? `${parseFloat(((apiData.total_power * 8) / 1000).toFixed(2))} kWh` : '0 kWh'} detail="Based on current usage" icon={<Zap className="text-green-400" />} />
                </div>

                {/* Sub-sections */}
                <div className="dashboard-main-grid">
                   <div className="min-w-0 space-y-8">
                      <OfficeMap devices={apiData?.devices || []} />
                   </div>
                   <div className="space-y-6">
                      <div className="dashboard-card">
                        <h3 className="font-semibold mb-4">Quick Room Status</h3>
                        <div className="space-y-4">
                          {apiData ? apiData.rooms.map(room => (
                            <div key={room.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                              <div>
                                <span className="block font-medium">{room.name}</span>
                                <span className="text-xs text-zinc-400">{room.active_count} active &middot; {room.power_usage}W</span>
                              </div>
                              <span className={`text-xs font-medium ${room.active_count === room.total_count ? 'text-red-400' : 'text-primary'}`}>
                                {room.active_count === room.total_count ? 'All ON' : 'Normal'}
                              </span>
                            </div>
                          )) : rooms.map(room => (
                            <div key={room} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                              <span>{room}</span>
                              <span className="text-xs text-zinc-500 font-medium">Loading...</span>
                            </div>
                          ))}
                        </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'layout' && (
              <motion.div 
                key="layout"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex items-center justify-center h-full w-full"
              >
                <div className="w-full max-w-6xl">
                  <OfficeMap devices={apiData?.devices || []} />
                </div>
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <AlertsPage />
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Analytics />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Global Floating Chat — persists across all pages */}
      <FloatingChat />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        active 
          ? 'bg-primary/10 text-primary border border-primary/20' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent'
      }`}
    >
      <span className={`${active ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{icon}</span>
      <span className="font-medium flex-1 text-left">{label}</span>
      {badge && (
        <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, detail, icon }) {
  return (
    <div className="dashboard-card border-none bg-gradient-to-br from-card to-zinc-900">
      <div className="flex justify-between items-start mb-4">
        <p className="text-zinc-400 text-sm font-medium">{title}</p>
        <div className="bg-white/5 p-2 rounded-lg">
          {icon}
        </div>
      </div>
      <h3 className="text-3xl font-bold mb-1">{value}</h3>
      <p className="text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

export default App;
