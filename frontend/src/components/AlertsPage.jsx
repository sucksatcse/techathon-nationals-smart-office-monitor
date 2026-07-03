import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert, Settings, RefreshCw, Trash2, Calendar } from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [settings, setSettings] = useState({ simulated_hour: null, office_hours_start: 9, office_hours_end: 17 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlertsAndSettings = async () => {
    try {
      const [alertsRes, settingsRes] = await Promise.all([
        fetch('http://localhost:3001/api/alerts'),
        fetch('http://localhost:3001/api/settings')
      ]);

      if (!alertsRes.ok || !settingsRes.ok) {
        throw new Error('Failed to load alerts or settings.');
      }

      const alertsData = await alertsRes.json();
      const settingsData = await settingsRes.json();

      setAlerts(alertsData);
      setSettings(settingsData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the API server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndSettings();
    const interval = setInterval(fetchAlertsAndSettings, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/alerts/${id}/acknowledge`, {
        method: 'POST'
      });
      if (res.ok) {
        // Optimistic local update
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleClearAlerts = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/alerts/clear', {
        method: 'POST'
      });
      if (res.ok) {
        fetchAlertsAndSettings();
      }
    } catch (err) {
      console.error('Failed to clear alerts:', err);
    }
  };

  const handleUpdateSimulatedHour = async (hour) => {
    try {
      const updatedValue = hour === 'real' ? null : Number(hour);
      const res = await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ simulated_hour: updatedValue })
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to update simulated hour:', err);
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Loading security alerts...</p>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => !a.resolved && !a.acknowledged);
  const resolvedOrAckAlerts = alerts.filter(a => a.resolved || a.acknowledged);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Settings & Controls Panel */}
      <div className="dashboard-card bg-gradient-to-br from-card to-zinc-950/80 border border-white/5 p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Alert System Simulator & Settings</h3>
              <p className="text-xs text-zinc-400">Override office hours to test triggers immediately.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Simulated Time</label>
              <select 
                value={settings.simulated_hour === null ? 'real' : settings.simulated_hour} 
                onChange={(e) => handleUpdateSimulatedHour(e.target.value)}
                className="bg-zinc-900 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-200 focus:outline-none focus:border-primary/50 transition-colors w-full sm:w-48"
              >
                <option value="real">🕰️ System (Real-Time)</option>
                <option value="8">🌅 08:00 AM (Before Hours)</option>
                <option value="12">☀️ 12:00 PM (Office Hours)</option>
                <option value="18">🌆 06:00 PM (After Hours)</option>
                <option value="20">🌙 08:00 PM (After Hours)</option>
                <option value="23">🌌 11:00 PM (After Hours)</option>
              </select>
            </div>
            
            <button
              onClick={handleClearAlerts}
              className="flex items-center justify-center gap-2 px-4 py-2.5 mt-auto bg-zinc-900 hover:bg-zinc-800 border border-white/15 rounded-xl text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-all h-[42px] w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 text-zinc-400" />
              Clear History
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Active & Historical Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: Active Alerts List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-100">Active Anomalies</h3>
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {activeAlerts.length} Active
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {activeAlerts.length > 0 ? (
                activeAlerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    layoutId={alert.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-start gap-4 p-5 rounded-2xl border transition-all duration-300 ${
                      alert.severity === 'high' 
                        ? 'bg-red-950/15 border-red-500/20 hover:border-red-500/40 shadow-[0_0_15px_-3px_rgba(239,68,68,0.05)]' 
                        : 'bg-amber-950/10 border-amber-500/10 hover:border-amber-500/30'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      alert.severity === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap mb-1">
                        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{alert.room}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          alert.severity === 'high' 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {alert.severity} Severity
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 font-medium mb-3">{alert.message}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs text-zinc-300 hover:text-zinc-100 font-semibold transition-all self-center"
                    >
                      Acknowledge
                    </button>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 bg-zinc-900/30 border border-white/5 rounded-2xl text-center"
                >
                  <div className="bg-green-500/10 p-4 rounded-full border border-green-500/20 text-green-400 mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-zinc-200 mb-1">Office is Secure</h4>
                  <p className="text-zinc-500 text-xs max-w-xs">No active anomalies detected. All systems are operating within guidelines.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: History Panel */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-zinc-100">Audit History</h3>
            <span className="bg-zinc-800 text-zinc-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {resolvedOrAckAlerts.length} Logged
            </span>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {resolvedOrAckAlerts.length > 0 ? (
              resolvedOrAckAlerts.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-xl border bg-zinc-950/40 border-white/5 flex gap-3 ${
                    alert.resolved ? 'opacity-65' : ''
                  }`}
                >
                  <div className={`mt-0.5 ${alert.resolved ? 'text-green-500' : 'text-zinc-500'}`}>
                    {alert.resolved ? <CheckCircle2 className="w-4.5 h-4.5" /> : <ShieldAlert className="w-4.5 h-4.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400 font-semibold mb-0.5">{alert.room}</p>
                    <p className="text-xs text-zinc-300 leading-relaxed mb-1.5">{alert.message}</p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {alert.resolved && (
                        <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-md text-[9px] font-semibold">
                          RESOLVED
                        </span>
                      )}
                      {alert.acknowledged && !alert.resolved && (
                        <span className="bg-zinc-800 text-zinc-400 border border-white/5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold">
                          ACKNOWLEDGED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-zinc-900/15 border border-dashed border-white/5 rounded-2xl">
                <Calendar className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-xs">No historical logs available.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
