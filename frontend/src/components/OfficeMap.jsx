import React from 'react';
import { motion } from 'framer-motion';

const OfficeMap = ({ devices = [] }) => {
  // Helper to find device status
  const getDeviceStatus = (room, name) => {
    const d = devices.find(dev => dev.room === room && dev.name === name);
    return d ? d.status : false;
  };

  return (
    <div className="relative w-full h-[500px] bg-zinc-900/50 rounded-2xl overflow-hidden border border-white/5 p-8 flex items-center justify-center">
      <svg viewBox="0 0 800 500" className="w-full h-full max-w-4xl">
        {/* Drawing Room */}
        <Room 
          x={50} y={50} w={300} h={250} name="Drawing Room" 
          lights={[
            { id: 'Light 1', x: 100, y: 100 },
            { id: 'Light 2', x: 200, y: 100 },
            { id: 'Light 3', x: 150, y: 200 },
          ]}
          fans={[
            { id: 'Fan 1', x: 100, y: 175 },
            { id: 'Fan 2', x: 250, y: 150 },
          ]}
          getStatus={(name) => getDeviceStatus('Drawing Room', name)}
        />

        {/* Corridor */}
        <rect x={350} y={50} width={100} height={400} fill="transparent" stroke="#27272a" strokeWidth="2" strokeDasharray="4 4" />
        <text x={400} y={250} fill="#52525b" fontSize="12" textAnchor="middle" transform="rotate(-90 400 250)">Corridor</text>

        {/* Work Room 1 */}
        <Room 
          x={450} y={50} w={300} h={190} name="Work Room 1" 
          lights={[
            { id: 'Light 1', x: 500, y: 100 },
            { id: 'Light 2', x: 600, y: 100 },
            { id: 'Light 3', x: 700, y: 100 },
          ]}
          fans={[
            { id: 'Fan 1', x: 550, y: 150 },
            { id: 'Fan 2', x: 650, y: 150 },
          ]}
          getStatus={(name) => getDeviceStatus('Work Room 1', name)}
        />

        {/* Work Room 2 */}
        <Room 
          x={450} y={260} w={300} h={190} name="Work Room 2" 
          lights={[
            { id: 'Light 1', x: 500, y: 310 },
            { id: 'Light 2', x: 600, y: 310 },
            { id: 'Light 3', x: 700, y: 310 },
          ]}
          fans={[
            { id: 'Fan 1', x: 550, y: 360 },
            { id: 'Fan 2', x: 650, y: 360 },
          ]}
          getStatus={(name) => getDeviceStatus('Work Room 2', name)}
        />
      </svg>
    </div>
  );
};

const Room = ({ x, y, w, h, name, lights, fans, getStatus }) => (
  <g>
    {/* Floor */}
    <rect x={x} y={y} width={w} height={h} fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
    
    {/* Room Label */}
    <text x={x + 15} y={y + 25} fill="#71717a" fontSize="14" fontWeight="600">{name}</text>

    {/* Assets (Sofa/Desks - simplified placeholders) */}
    {name === "Drawing Room" && (
       <rect x={x + 200} y={y + 180} width={80} height={40} rx={4} fill="#27272a" /> // Sofa
    )}

    {/* Lights */}
    {lights.map(light => (
      <Light key={light.id} x={light.x} y={light.y} isOn={getStatus(light.id)} />
    ))}

    {/* Fans */}
    {fans.map(fan => (
      <Fan key={fan.id} x={fan.x} y={fan.y} isOn={getStatus(fan.id)} />
    ))}
  </g>
);

const Light = ({ x, y, isOn }) => (
  <g transform={`translate(${x}, ${y})`}>
    <motion.circle 
      r="8" 
      fill={isOn ? "#fbbf24" : "#3f3f46"} 
      animate={{ 
        scale: isOn ? [1, 1.1, 1] : 1,
        fill: isOn ? "#fbbf24" : "#3f3f46"
      }}
      transition={{ repeat: isOn ? Infinity : 0, duration: 2 }}
    />
    {isOn && (
      <circle r="15" fill="url(#lightGradient)" />
    )}
    <defs>
      <radialGradient id="lightGradient">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
      </radialGradient>
    </defs>
  </g>
);

const Fan = ({ x, y, isOn }) => (
  <g transform={`translate(${x}, ${y})`}>
    <motion.g 
      animate={{ rotate: isOn ? 360 : 0 }} 
      transition={{ repeat: isOn ? Infinity : 0, duration: 0.5, ease: "linear" }}
    >
      <circle r="3" fill="#71717a" />
      <rect x="-12" y="-1.5" width="24" height="3" rx="1" fill="#52525b" />
      <rect x="-1.5" y="-12" width="3" height="24" rx="1" fill="#52525b" />
    </motion.g>
  </g>
);

export default OfficeMap;
