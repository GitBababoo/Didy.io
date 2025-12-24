'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import { getNickname, saveNickname, getHighScore } from '../services/IndexedDBService';
import { persistence } from '../services/Persistence';
import { useTranslation } from 'react-i18next';
import { soundEngine } from '../services/SoundEngine';
import { network } from '../services/Network';
import { useGameStore } from '../store/gameStore';
import { TANK_CLASSES, COLORS, STAT_COLORS } from '../constants';

// --- Icons (SVG) ---
const Icons = {
  Home: () => <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  Grid: () => <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  Settings: () => <path d="M12.22 2h-.44a2 2 0 0 1-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/></path>,
  Play: () => <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />,
  Cpu: () => <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M9 9h6v6H9z" fill="currentColor" opacity="0.5"/><path d="M9 1V4M15 1V4M9 20V23M15 20V23M20 9H23M20 15H23M1 9H4M1 15H4" stroke="currentColor" strokeWidth="2"/>
};

// --- Helper: Tank Preview Renderer ---
const TankPreviewCanvas: React.FC<{ classIndex: number, size?: number }> = ({ classIndex, size = 120 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tankClass = TANK_CLASSES[classIndex];
    const center = size / 2;
    
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    
    // Auto-scale based on tier to fit bigger tanks
    const scale = tankClass.tier > 15 ? 0.5 : (tankClass.tier > 8 ? 0.6 : 0.8);
    ctx.scale(scale, scale);

    // Draw Barrels
    tankClass.barrels.forEach((barrel) => {
         ctx.save();
         if (barrel.angle) ctx.rotate(barrel.angle);
         ctx.fillStyle = '#666'; // Darker "Blueprint" style
         ctx.strokeStyle = COLORS.player; // Neon Cyan outline
         ctx.lineWidth = 2;
         const bWidth = barrel.width;
         const bLen = barrel.length;
         const bOff = barrel.offsetX; 
         ctx.translate(0, -bOff); 
         ctx.fillRect(0, -bWidth/2, bLen, bWidth);
         ctx.strokeRect(0, -bWidth/2, bLen, bWidth);
         ctx.restore();
    });

    // Draw Body
    ctx.fillStyle = '#111';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.player;
    ctx.beginPath();
    const r = tankClass.bodyRadius;
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shine effect
    ctx.beginPath();
    ctx.arc(-r*0.3, -r*0.3, r*0.2, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0, 243, 255, 0.3)";
    ctx.fill();

    ctx.restore();
  }, [classIndex, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
};

interface LobbyProps {
  onStart: (nickname: string) => void;
}

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'th', flag: '🇹🇭', label: 'Thai' },
  { code: 'jp', flag: '🇯🇵', label: 'Japanese' },
  { code: 'fr', flag: '🇫🇷', label: 'French' },
];

export const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'home' | 'hangar' | 'settings'>('home');
  const [name, setName] = useState('');
  const [highScore, setHighScore] = useState(0);
  const [mode, setMode] = useState<'solo' | 'host' | 'join'>('solo');
  const [roomId, setRoomId] = useState('');
  const [hostId, setHostId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTankId, setSelectedTankId] = useState<number | null>(null);

  // --- Parallax Mouse State ---
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    setName(getNickname());
    persistence.getHighScores(1).then(records => {
        if (records.length > 0) setHighScore(records[0].score);
    });

    const handleMouseMove = (e: MouseEvent) => {
        mouseX.set(e.clientX / window.innerWidth - 0.5);
        mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleStartGame = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setError('');
      setLoading(true);
      soundEngine.init();
      saveNickname(name);
      
      try {
          if (mode === 'solo') {
              useGameStore.setState({ gameMode: 'solo' });
              onStart(name);
          } else if (mode === 'host') {
              const id = await network.initializeHost();
              setHostId(id);
              useGameStore.setState({ gameMode: 'host', roomId: id });
              setLoading(false);
          } else if (mode === 'join') {
              if (!roomId) throw new Error("Room ID required");
              await network.joinGame(roomId);
              useGameStore.setState({ gameMode: 'client', roomId });
              onStart(name);
          }
      } catch (err: any) {
          setError(err.message || 'Connection failed');
          setLoading(false);
      }
  };

  const backgroundX = useTransform(mouseX, [-0.5, 0.5], [20, -20]);
  const backgroundY = useTransform(mouseY, [-0.5, 0.5], [20, -20]);

  // --- SUB-VIEWS ---

  const DashboardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full p-6 content-start lg:content-stretch overflow-y-auto">
      {/* HEADER BLOCK - Kinetic Typography */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="col-span-1 lg:col-span-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group min-h-[250px]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <h1 className="text-6xl md:text-8xl xl:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-200 to-cyan-500 font-[Orbitron] drop-shadow-[0_0_30px_rgba(0,255,255,0.3)]">
           {t('app_title').split('').map((char, i) => (
             <motion.span 
               key={i} 
               initial={{ opacity: 0, x: -20 }} 
               animate={{ opacity: 1, x: 0 }} 
               transition={{ delay: i * 0.05 }}
               className="inline-block"
             >
               {char}
             </motion.span>
           ))}
        </h1>
        <p className="text-2xl md:text-3xl text-cyan-400/80 font-bold tracking-[0.5em] mt-4 uppercase">{t('subtitle')}</p>
      </motion.div>

      {/* STATS BLOCK */}
      <motion.div 
         initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
         className="col-span-1 lg:col-span-4 bg-gradient-to-br from-gray-900/80 to-black/80 backdrop-blur-md border border-white/5 rounded-3xl p-8 flex flex-col justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)]"
      >
         <div className="mb-6">
            <div className="text-sm md:text-base text-gray-500 font-bold mb-2 tracking-wider">PERSONAL BEST</div>
            <div className="text-5xl md:text-6xl font-bold text-yellow-400 font-[Rajdhani]">{highScore.toLocaleString()}</div>
         </div>
         <div>
            <div className="text-sm md:text-base text-gray-500 font-bold mb-2 tracking-wider">STATUS</div>
            <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"/>
                <span className="text-green-400 font-bold text-lg md:text-xl">SYSTEMS ONLINE</span>
            </div>
         </div>
      </motion.div>

      {/* DEPLOYMENT BLOCK */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="col-span-1 lg:col-span-7 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 relative overflow-hidden"
      >
        <form onSubmit={handleStartGame} className="relative z-10 flex flex-col h-full justify-between gap-8">
            <div className="space-y-6">
                {/* Mode Selector */}
                <div className="flex gap-2 p-1.5 bg-black/40 rounded-xl w-fit">
                    {['solo', 'host', 'join'].map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => { setMode(m as any); setHostId(''); }}
                            className={`px-6 py-3 rounded-lg font-bold text-base md:text-lg transition-all ${mode === m ? 'bg-cyan-500 text-black shadow-[0_0_15px_cyan]' : 'text-gray-400 hover:text-white'}`}
                        >
                            {m.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Name Input */}
                <div className="flex flex-col gap-3">
                    <label className="text-xs md:text-sm text-cyan-400 font-bold tracking-widest">CALLSIGN IDENTIFIER</label>
                    <input 
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="ENTER NAME"
                        className="bg-transparent border-b-2 border-white/20 text-4xl md:text-5xl font-bold py-3 outline-none focus:border-cyan-400 transition-colors text-white placeholder-white/20 font-[Rajdhani]"
                        maxLength={15}
                    />
                </div>

                {mode === 'join' && (
                     <motion.input 
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
                        placeholder="ROOM ID"
                        className="bg-black/30 border border-green-500/50 rounded-xl px-6 py-4 text-xl md:text-2xl text-green-400 font-mono tracking-widest w-full outline-none focus:bg-black/50"
                        maxLength={6}
                     />
                )}
                 {mode === 'host' && hostId && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 bg-purple-500/20 border border-purple-500/50 rounded-xl">
                        <div className="text-xs text-purple-300 font-bold mb-2">SESSION ID</div>
                        <div className="text-4xl font-mono text-white tracking-[0.2em]">{hostId}</div>
                     </motion.div>
                )}
            </div>

            {error && <div className="text-red-400 text-lg bg-red-900/20 p-4 rounded-xl border-l-4 border-red-500 font-bold">{error}</div>}

            {!hostId ? (
                <motion.button 
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    disabled={loading}
                    className="bg-white text-black font-black text-2xl md:text-3xl py-6 rounded-2xl hover:bg-cyan-400 transition-colors flex items-center justify-center gap-4 shadow-lg"
                >
                   {loading ? <span className="animate-spin text-4xl">⟳</span> : <div className="scale-125"><Icons.Play /></div>}
                   <span>{t('btn_deploy')}</span>
                </motion.button>
            ) : (
                <motion.button 
                    type="button" onClick={() => onStart(name)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black text-2xl md:text-3xl py-6 rounded-2xl flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(168,85,247,0.5)]"
                >
                   <span>START MATCH</span>
                </motion.button>
            )}
        </form>
      </motion.div>

      {/* INFO BLOCK */}
      <div className="col-span-1 lg:col-span-5 flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="flex-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center"
          >
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
             <h3 className="text-cyan-400 font-bold text-xl md:text-2xl mb-6 flex items-center gap-3"><Icons.Cpu /> SYSTEM SPECS</h3>
             <ul className="space-y-4 text-base md:text-lg text-gray-300 font-mono">
                 <li className="flex justify-between border-b border-white/5 pb-2"><span>ENGINE</span> <span className="text-white font-bold">CANVAS 2D</span></li>
                 <li className="flex justify-between border-b border-white/5 pb-2"><span>PHYSICS</span> <span className="text-white font-bold">SPATIAL HASH</span></li>
                 <li className="flex justify-between border-b border-white/5 pb-2"><span>NETWORKING</span> <span className="text-white font-bold">P2P / WEBRTC</span></li>
                 <li className="flex justify-between border-b border-white/5 pb-2"><span>AUDIO</span> <span className="text-white font-bold">TONE.JS SYNTH</span></li>
             </ul>
          </motion.div>
      </div>
    </div>
  );

  const HangarView = () => (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: SCROLLABLE LIST */}
        <div className="flex-1 h-full overflow-y-auto p-8 scrollbar-hide">
            <h2 className="text-5xl md:text-6xl font-[Orbitron] font-black text-white mb-8 sticky top-0 z-10 drop-shadow-lg">CLASS REGISTRY</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
                {TANK_CLASSES.map((tank, i) => (
                    <motion.div
                        key={tank.index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => setSelectedTankId(tank.index)}
                        className={`aspect-square rounded-3xl border-2 ${selectedTankId === tank.index ? 'bg-cyan-900/40 border-cyan-400 shadow-[0_0_30px_cyan]' : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/30'} backdrop-blur-sm cursor-pointer transition-all p-6 flex flex-col items-center justify-between group relative overflow-hidden`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none" />
                        <div className="relative z-10 w-full flex justify-between text-xs md:text-sm font-bold text-gray-500 uppercase">
                            <span>TIER {tank.tier}</span>
                            <span>IDX_{tank.index}</span>
                        </div>
                        <div className="relative z-10 group-hover:scale-110 transition-transform duration-300">
                             <TankPreviewCanvas classIndex={tank.index} size={140} />
                        </div>
                        <div className={`relative z-10 text-center text-lg md:text-xl font-bold font-[Rajdhani] uppercase tracking-wider ${selectedTankId === tank.index ? 'text-cyan-300' : 'text-gray-300 group-hover:text-white'}`}>
                            {tank.name}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        {/* RIGHT: INSPECTOR PANEL (Desktop) / BOTTOM SHEET (Mobile) */}
        <AnimatePresence>
            {selectedTankId !== null && (
                <motion.div 
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    className="absolute lg:relative inset-0 lg:w-[500px] lg:h-full bg-black/90 lg:bg-black/40 backdrop-blur-2xl border-l border-white/10 p-10 flex flex-col z-20 shadow-2xl"
                >
                    <button onClick={() => setSelectedTankId(null)} className="lg:hidden absolute top-6 right-6 text-white text-lg font-bold">CLOSE</button>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="w-80 h-80 border border-cyan-500/30 rounded-full flex items-center justify-center bg-cyan-500/5 relative mb-8">
                             <div className="absolute inset-0 animate-spin-slow border-t-2 border-cyan-500/50 rounded-full" />
                             <TankPreviewCanvas classIndex={selectedTankId} size={280} />
                        </div>
                        <h2 className="text-5xl md:text-6xl font-black text-white mb-2 font-[Orbitron] uppercase tracking-tight text-center">{TANK_CLASSES[selectedTankId].name}</h2>
                        <div className="text-cyan-400 font-bold text-xl tracking-[0.3em] mb-12">CLASS TIER {TANK_CLASSES[selectedTankId].tier}</div>
                        
                        {/* Stats Visualization */}
                        <div className="w-full space-y-6">
                            {[
                                { label: 'FIREPOWER', val: 0.7 },
                                { label: 'SPEED', val: 0.5 },
                                { label: 'RELOAD', val: 0.8 },
                                { label: 'ARMOR', val: 0.4 }
                            ].map((stat, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between text-sm md:text-base font-bold text-gray-400">
                                        <span>{stat.label}</span>
                                        <span>{Math.floor(stat.val * 100)}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} animate={{ width: `${stat.val * 100}%` }} 
                                            className="h-full bg-cyan-500 shadow-[0_0_15px_cyan]"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/10">
                         <p className="text-sm md:text-base text-gray-400 leading-relaxed font-mono">
                             WARNING: This unit is equipped with experimental weaponry. 
                             Recommended for advanced operators.
                         </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );

  const SettingsView = () => (
      <div className="h-full flex items-center justify-center p-6">
          <div className="max-w-3xl w-full space-y-10">
              <h2 className="text-5xl md:text-6xl font-[Orbitron] font-black text-white mb-10 border-b-2 border-white/10 pb-6">SYSTEM CONFIG</h2>
              
              <div className="space-y-8">
                  {/* Language */}
                  <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-400 mb-4 tracking-widest">LANGUAGE PROTOCOL</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {LANGUAGES.map(lang => (
                              <button 
                                key={lang.code}
                                onClick={() => i18n.changeLanguage(lang.code)}
                                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${i18n.language === lang.code ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,255,255,0.2)]' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                              >
                                  <span className="text-4xl">{lang.flag}</span>
                                  <span className="font-bold text-sm md:text-base uppercase">{lang.label}</span>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Mock Graphics */}
                  <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-400 mb-4 tracking-widest">VISUALS</h3>
                      <div className="bg-black/20 rounded-2xl p-2 space-y-2">
                          {['PARTICLES', 'SHADOWS', 'BLOOM', 'CHROMATIC ABERRATION'].map((setting, i) => (
                              <div key={i} className="flex justify-between items-center p-6 hover:bg-white/5 rounded-xl transition-colors">
                                  <span className="text-white font-bold text-base md:text-lg">{setting}</span>
                                  <div className="w-16 h-8 bg-cyan-900 rounded-full relative cursor-pointer border border-cyan-700">
                                      <div className="absolute right-1 top-1 w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]" />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="absolute inset-0 bg-gray-900 text-white overflow-hidden font-[Rajdhani] select-none text-base">
      
      {/* 1. ANIMATED BACKGROUND */}
      <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ x: backgroundX, y: backgroundY }}>
          {/* Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#111_100%)]" />
          
          {/* Floating Blobs */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} transition={{ duration: 20, repeat: Infinity }}
            className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]" 
          />
          <motion.div 
             animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }} transition={{ duration: 25, repeat: Infinity }}
             className="absolute bottom-1/4 right-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px]" 
          />
          
          {/* Noise Overlay */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-150 contrast-200 mix-blend-overlay" />
      </motion.div>

      {/* 2. MAIN LAYOUT */}
      <div className="relative z-10 flex flex-col lg:flex-row h-full">
          
          {/* SIDEBAR NAVIGATION (Desktop) */}
          <div className="hidden lg:flex flex-col w-28 bg-black/20 backdrop-blur-xl border-r border-white/5 items-center py-10 gap-10">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl shadow-[0_0_20px_cyan]" />
              <div className="flex-1 flex flex-col gap-6 w-full px-3">
                  {[
                      { id: 'home', icon: Icons.Home, label: 'DASH' },
                      { id: 'hangar', icon: Icons.Grid, label: 'HANGAR' },
                      { id: 'settings', icon: Icons.Settings, label: 'SYS' },
                  ].map((item) => (
                      <button 
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-white/10 text-cyan-400' : 'text-gray-500 hover:text-white'}`}
                      >
                          <div className="group-hover:scale-110 transition-transform scale-125"><item.icon /></div>
                          <span className="text-xs font-bold tracking-widest mt-1">{item.label}</span>
                      </button>
                  ))}
              </div>
              <div className="text-xs text-gray-600 rotate-180 writing-vertical font-bold">V.1.0.5</div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className="h-full w-full"
                  >
                      {activeTab === 'home' && <DashboardView />}
                      {activeTab === 'hangar' && <HangarView />}
                      {activeTab === 'settings' && <SettingsView />}
                  </motion.div>
              </AnimatePresence>
          </div>

          {/* BOTTOM NAVIGATION (Mobile) */}
          <div className="lg:hidden bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around p-4 pb-8 safe-area-pb z-50">
             {[
                  { id: 'home', icon: Icons.Home },
                  { id: 'hangar', icon: Icons.Grid },
                  { id: 'settings', icon: Icons.Settings },
              ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`p-4 rounded-2xl ${activeTab === item.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500'}`}
                  >
                      <div className="scale-125"><item.icon /></div>
                  </button>
              ))}
          </div>
      </div>
    </div>
  );
};