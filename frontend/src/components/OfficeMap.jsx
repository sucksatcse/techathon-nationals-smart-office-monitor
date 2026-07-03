import React from 'react';
import { motion } from 'framer-motion';

const OfficeMap = ({ devices = [], onToggleDevice }) => {
  // Helper to find device status
  const getDeviceStatus = (room, name) => {
    const d = devices.find(dev => dev.room === room && dev.name === name);
    return d ? d.status : false;
  };

  // Dimensions
  const canvasW = 1000;
  const canvasH = 600;
  
  const roomW = 280;
  const roomH = 360;
  
  const wallStroke = "#52525b";
  const floorFill = "#18181b";

  return (
    <div className="relative w-full aspect-[5/3] min-h-[300px] bg-zinc-900/40 rounded-2xl overflow-hidden border border-white/5 p-4 flex items-center justify-center">
      <svg viewBox={`0 0 ${canvasW} ${canvasH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full drop-shadow-2xl">
        
        {/* Outer Building Shadow/Base */}
        <rect x={70} y={40} width={860} height={500} fill="#111113" stroke={wallStroke} strokeWidth="8" rx="4" />
        
        {/* Corridor */}
        <rect x={74} y={400} width={852} height={136} fill={floorFill} stroke={wallStroke} strokeWidth="2" />
        
        {/* Rooms */}
        <DrawingRoom 
          x={74} y={44} w={roomW} h={roomH} 
          getStat={(name) => getDeviceStatus('Drawing Room', name)}
          onToggle={(name) => onToggleDevice && onToggleDevice('Drawing Room', name)}
        />
        <WorkRoom 
          x={74 + roomW} y={44} w={roomW} h={roomH} name="Work Room 1"
          lightNames={['Light 4', 'Light 5', 'Light 6']}
          fanNames={['Fan 3', 'Fan 4']}
          getStat={(name) => getDeviceStatus('Work Room 1', name)}
          onToggle={(name) => onToggleDevice && onToggleDevice('Work Room 1', name)}
        />
        <WorkRoom 
          x={74 + roomW * 2} y={44} w={roomW} h={roomH} name="Work Room 2"
          lightNames={['Light 7', 'Light 8', 'Light 9']}
          fanNames={['Fan 5', 'Fan 6']}
          getStat={(name) => getDeviceStatus('Work Room 2', name)}
          onToggle={(name) => onToggleDevice && onToggleDevice('Work Room 2', name)}
        />

        {/* Outer Doors & Entry Arrow */}
        {/* Entry Door - Bottom Center */}
        <g transform="translate(500, 536)">
          <line x1="-30" y1="0" x2="-30" y2="40" stroke="#0a0a0b" strokeWidth="6" />
          <line x1="30" y1="0" x2="30" y2="40" stroke="#0a0a0b" strokeWidth="6" />
          <path d="M-30,4 L30,4" stroke={wallStroke} strokeWidth="8" /> {/* Closed inner door */}
          
          <text x="0" y="45" fill="#a1a1aa" fontSize="16" fontWeight="bold" textAnchor="middle">↑ ENTRY</text>
        </g>
        
        {/* Corridor Assets */}
        {/* Plant bottom right */}
        <Plant x={880} y={500} size={15} />
        {/* Water Dispenser */}
        <rect x={900} y={460} width={20} height={30} rx={4} fill="#e4e4e7" />
        <circle cx={910} cy={475} r="8" fill="#3b82f6" opacity="0.6" />

      </svg>
      
      {/* Help tooltip */}
      <div className="absolute bottom-4 left-4 bg-zinc-950/80 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] text-zinc-400 pointer-events-none">
        💡 Click on any light or fan in the layout to toggle its power state.
      </div>
    </div>
  );
};

const DrawingRoom = ({ x, y, w, h, getStat, onToggle }) => (
  <g>
    {/* Floor */}
    <rect x={x} y={y} width={w} height={h} fill="#18181b" stroke="#52525b" strokeWidth="4" />
    <text x={x + w/2} y={y + 110} fill="#71717a" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">DRAWING ROOM</text>

    {/* Door to corridor */}
    <rect x={x + w - 60} y={y + h} width="40" height="6" fill="#18181b" />
    <path d={`M${x + w - 60},${y+h} A40,40 0 0,0 ${x + w - 20},${y+h-40}`} fill="none" stroke="#71717a" strokeWidth="2" strokeDasharray="4" />
    <line x1={x + w - 20} y1={y+h} x2={x + w - 20} y2={y+h-40} stroke="#a1a1aa" strokeWidth="4" />

    {/* Windows */}
    <rect x={x + 60} y={y-4} width="60" height="8" fill="#60a5fa" opacity="0.8" />
    <rect x={x + 180} y={y-4} width="60" height="8" fill="#60a5fa" opacity="0.8" />

    {/* Rug */}
    <rect x={x + 60} y={y + 130} width={120} height={160} fill="#1f1f22" rx="4" />
    
    {/* Sofa (Left) */}
    <rect x={x + 20} y={y + 110} width="35" height="150" fill="#27272a" rx="4" stroke="#3f3f46" strokeWidth="2" />
    <rect x={x + 25} y={y + 120} width="25" height="130" fill="#3f3f46" rx="2" />
    
    {/* Side Chair (Bottom Left) */}
    <g transform={`translate(${x + 40}, ${y + 290}) rotate(-30)`}>
      <rect x="-15" y="-15" width="30" height="30" fill="#27272a" rx="4" stroke="#3f3f46" strokeWidth="2" />
      <rect x="-10" y="-10" width="20" height="20" fill="#3f3f46" rx="2" />
    </g>

    {/* Coffee Table */}
    <rect x={x + 85} y={y + 160} width="30" height="60" fill="#3f3f46" rx="4" stroke="#52525b" strokeWidth="1" />

    {/* Plants */}
    <Plant x={x + 25} y={y + 25} size={15} />
    <Plant x={x + w - 25} y={y + h - 25} size={20} />

    {/* Lights */}
    <Light x={x + 70} y={y + 60} isOn={getStat('Light 1')} onClick={() => onToggle('Light 1')} />
    <Light x={x + w - 70} y={y + 60} isOn={getStat('Light 2')} onClick={() => onToggle('Light 2')} />
    <Light x={x + w/2} y={y + h - 50} isOn={getStat('Light 3')} onClick={() => onToggle('Light 3')} />

    {/* Fans */}
    <Fan x={x + w/2 - 10} y={y + h/3 - 10} isOn={getStat('Fan 1')} onClick={() => onToggle('Fan 1')} />
    <Fan x={x + w/2 - 10} y={y + h - 110} isOn={getStat('Fan 2')} onClick={() => onToggle('Fan 2')} />
  </g>
);

const WorkRoom = ({ x, y, w, h, name, lightNames, fanNames, getStat, onToggle }) => (
  <g>
    {/* Floor */}
    <rect x={x} y={y} width={w} height={h} fill="#18181b" stroke="#52525b" strokeWidth="4" />
    <text x={x + w/2} y={y + 150} fill="#71717a" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="2">{name.toUpperCase()}</text>

    {/* Door to corridor (left-aligned for work rooms based on image) */}
    <rect x={x + 20} y={y + h} width="40" height="6" fill="#18181b" />
    <path d={`M${x + 60},${y+h} A40,40 0 0,0 ${x + 20},${y+h-40}`} fill="none" stroke="#71717a" strokeWidth="2" strokeDasharray="4" />
    <line x1={x + 20} y1={y+h} x2={x + 20} y2={y+h-40} stroke="#a1a1aa" strokeWidth="4" />

    {/* Windows */}
    <rect x={x + w/2 - 30} y={y-4} width="60" height="8" fill="#60a5fa" opacity="0.8" />

    {/* Workstations */}
    <Workstation x={x + 40} y={y + 80} />
    <Workstation x={x + w - 90} y={y + 80} flipped />
    <Workstation x={x + 40} y={y + h - 120} />
    <Workstation x={x + w - 90} y={y + h - 120} flipped />

    {/* Lights */}
    <Light x={x + 70} y={y + 60} isOn={getStat(lightNames[0])} onClick={() => onToggle(lightNames[0])} />
    <Light x={x + w - 70} y={y + 60} isOn={getStat(lightNames[1])} onClick={() => onToggle(lightNames[1])} />
    <Light x={x + w/2} y={y + h - 50} isOn={getStat(lightNames[2])} onClick={() => onToggle(lightNames[2])} />

    {/* Fans */}
    <Fan x={x + w/2} y={y + 90} isOn={getStat(fanNames[0])} onClick={() => onToggle(fanNames[0])} />
    <Fan x={x + w/2} y={y + h - 100} isOn={getStat(fanNames[1])} onClick={() => onToggle(fanNames[1])} />
  </g>
);

const Workstation = ({ x, y, flipped = false }) => {
  return (
    <g>
      {/* Desk */}
      <rect x={x} y={y} width="50" height="40" fill="#27272a" rx="2" stroke="#3f3f46" />
      {/* Monitor */}
      <rect x={flipped ? x + 35 : x + 5} y={y + 10} width="10" height="20" fill="#18181b" rx={1} />
      {/* Keyboard */}
      <rect x={flipped ? x + 25 : x + 18} y={y + 14} width="6" height="12" fill="#3f3f46" rx={1} />
      {/* Chair */}
      <rect x={flipped ? x - 20 : x + 60} y={y + 10} width="15" height="20" fill="#3f3f46" rx="4" />
      <path d={`M${flipped ? x - 5 : x + 60} ${y + 12} L${flipped ? x - 5 : x + 60} ${y + 28}`} stroke="#52525b" strokeWidth="2" />
    </g>
  );
};

const Plant = ({ x, y, size }) => (
  <g transform={`translate(${x}, ${y})`}>
    <circle r={size} fill="#14532d" />
    <circle r={size * 0.7} fill="#166534" />
    <path d={`M0,0 L${size},0 M0,0 L-${size},0 M0,0 L0,${size} M0,0 L0,-${size}`} stroke="#052e16" strokeWidth="2" opacity="0.4" />
    <path d={`M0,0 L${size*0.7},${size*0.7} M0,0 L-${size*0.7},-${size*0.7} M0,0 L${size*0.7},-${size*0.7} M0,0 L-${size*0.7},${size*0.7}`} stroke="#052e16" strokeWidth="2" opacity="0.4" />
  </g>
);

const Light = ({ x, y, isOn, onClick }) => (
  <g transform={`translate(${x}, ${y})`} onClick={onClick} className="cursor-pointer group">
    <motion.circle 
      r="12" 
      fill={isOn ? "#fef08a" : "#3f3f46"} 
      stroke={isOn ? "#eab308" : "#52525b"}
      strokeWidth="2"
      whileHover={{ scale: 1.15 }}
      animate={{ 
        scale: isOn ? [1, 1.05, 1] : 1,
      }}
      transition={{ repeat: isOn ? Infinity : 0, duration: 3 }}
    />
    {isOn && (
      <circle r="25" fill="url(#lightGradient)" pointerEvents="none" />
    )}
    <defs>
      <radialGradient id="lightGradient">
        <stop offset="0%" stopColor="#fde047" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
      </radialGradient>
    </defs>
  </g>
);

const Fan = ({ x, y, isOn, onClick }) => {
  // Ceiling mount point (fixed anchor)
  const mountY = -30;
  // Rod length from mount to blade hub
  const rodLen = 22;
  // Hub center (where blades spin around)
  const hubY = mountY + rodLen;

  return (
    <g transform={`translate(${x}, ${y})`} onClick={onClick} className="cursor-pointer group">

      {/* Fixed ceiling bracket */}
      <rect x="-5" y={mountY - 5} width="10" height="6" rx="2"
        fill="#52525b" stroke="#71717a" strokeWidth="0.5" />

      {/* Rod connecting mount to hub — wobbles with the fan */}
      <motion.g
        style={{ transformOrigin: `0px ${mountY}px` }}
        animate={isOn ? {
          rotate: [0, 1.8, -2.2, 1.4, -1.6, 2, -1, 0],
        } : { rotate: 0 }}
        transition={isOn ? {
          repeat: Infinity,
          duration: 0.75,
          ease: "easeInOut",
          times: [0, 0.15, 0.3, 0.45, 0.6, 0.72, 0.87, 1],
        } : { duration: 0.4 }}
      >
        {/* Rod */}
        <line
          x1="0" y1={mountY}
          x2="0" y2={hubY}
          stroke="#71717a" strokeWidth="2"
        />

        {/* Hub circle */}
        <circle cx="0" cy={hubY} r="5"
          fill="#27272a"
          stroke={isOn ? "#60a5fa" : "#52525b"}
          strokeWidth="1.5"
        />

        {/* Spinning blades — rotate around hub center */}
        <motion.g
          style={{ transformOrigin: `0px ${hubY}px` }}
          animate={{ rotate: isOn ? 360 : 0 }}
          transition={{
            repeat: isOn ? Infinity : 0,
            duration: 0.35,
            ease: "linear",
          }}
        >
          {/* Blade 1 */}
          <path
            d={`M 0,${hubY - 4} Q 11,${hubY - 30} 0,${hubY - 38} Q -11,${hubY - 30} 0,${hubY - 4}`}
            fill={isOn ? "#60a5fa" : "#27272a"}
            stroke="#52525b" strokeWidth="1"
            opacity={isOn ? 0.92 : 1}
          />
          {/* Blade 2 */}
          <g style={{ transformOrigin: `0px ${hubY}px` }} transform={`rotate(120, 0, ${hubY})`}>
            <path
              d={`M 0,${hubY - 4} Q 11,${hubY - 30} 0,${hubY - 38} Q -11,${hubY - 30} 0,${hubY - 4}`}
              fill={isOn ? "#60a5fa" : "#27272a"}
              stroke="#52525b" strokeWidth="1"
              opacity={isOn ? 0.92 : 1}
            />
          </g>
          {/* Blade 3 */}
          <g style={{ transformOrigin: `0px ${hubY}px` }} transform={`rotate(240, 0, ${hubY})`}>
            <path
              d={`M 0,${hubY - 4} Q 11,${hubY - 30} 0,${hubY - 38} Q -11,${hubY - 30} 0,${hubY - 4}`}
              fill={isOn ? "#60a5fa" : "#27272a"}
              stroke="#52525b" strokeWidth="1"
              opacity={isOn ? 0.92 : 1}
            />
          </g>
        </motion.g>

        {/* Hover ring */}
        <motion.circle
          cx="0" cy={hubY} r="20"
          fill="transparent"
          stroke={isOn ? "#60a5fa" : "#52525b"}
          strokeWidth="0.5"
          strokeDasharray="3 3"
          opacity="0"
          whileHover={{ opacity: 0.5 }}
        />
      </motion.g>
    </g>
  );
};

export default OfficeMap;
