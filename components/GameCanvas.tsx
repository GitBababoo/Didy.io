'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from '../services/Engine';
import { Lobby } from './Lobby';
import { VirtualJoystick } from './VirtualJoystick';
import { motion, AnimatePresence } from 'framer-motion';
import { persistence } from '../services/Persistence';
import { STAT_COLORS, MAX_STAT_LEVEL, TANK_CLASSES, COLORS } from '../constants';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore';

const STAT_KEYS = [
  "stat_regen", "stat_health", "stat_body_dmg", "stat_bullet_spd", 
  "stat_bullet_pen", "stat_bullet_dmg", "stat_reload", "stat_move_spd"
];

// --- Tank Preview Component ---
const TankPreview: React.FC<{ classIndex: number, onClick: () => void }> = ({ classIndex, onClick }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const tankClass = TANK_CLASSES[classIndex];
        const size = 100; // Canvas Size
        const center = size / 2;
        
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(center, center);
        
        // Scale down to fit
        const scale = 0.8;
        ctx.scale(scale, scale);

        // Draw Barrels
        tankClass.barrels.forEach((barrel) => {
             ctx.save();
             if (barrel.angle) ctx.rotate(barrel.angle);
             ctx.fillStyle = '#999999';
             ctx.strokeStyle = '#555555';
             ctx.lineWidth = 2.5;
             const bWidth = barrel.width;
             const bLen = barrel.length;
             const bOff = barrel.offsetX; 
             ctx.translate(0, -bOff); 
             ctx.fillRect(0, -bWidth/2, bLen, bWidth);
             ctx.strokeRect(0, -bWidth/2, bLen, bWidth);
             ctx.restore();
        });

        // Draw Body
        ctx.fillStyle = COLORS.player;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        // Body Radius for preview fixed mostly to look good, or use real relative radius
        const r = tankClass.bodyRadius;
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

    }, [classIndex]);

    return (
        <button
            onClick={onClick}
            className="w-28 h-32 bg-gray-900/90 rounded-2xl border-2 border-gray-600 hover:bg-gray-800 hover:border-cyan-400 hover:scale-105 transition-all flex flex-col items-center justify-between p-3 group relative overflow-hidden shadow-lg"
        >
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />
            <canvas ref={canvasRef} width={100} height={100} className="w-20 h-20" />
            <span className="text-xs font-bold text-white uppercase tracking-wider relative z-10 bg-black/50 px-2 rounded">{TANK_CLASSES[classIndex].name}</span>
        </button>
    );
};

const GameCanvas: React.FC = () => {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  
  // Zustand State Selectors
  const isPlaying = useGameStore(state => state.isPlaying);
  const isDead = useGameStore(state => state.isDead);
  const score = useGameStore(state => state.score);
  const level = useGameStore(state => state.level);
  const xp = useGameStore(state => state.xp);
  const maxXp = useGameStore(state => state.maxXp);
  const statPoints = useGameStore(state => state.statPoints);
  const stats = useGameStore(state => state.stats);
  const nickname = useGameStore(state => state.nickname);
  const toggles = useGameStore(state => state.toggles);
  const gameMode = useGameStore(state => state.gameMode);
  const roomId = useGameStore(state => state.roomId);
  const availableClassUpgrades = useGameStore(state => state.availableClassUpgrades);
  const bossActive = useGameStore(state => state.bossActive); // New Boss State
  const actions = useGameStore(state => state);

  const [isMobile, setIsMobile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    engineRef.current = new Engine(canvasRef.current);
    return () => engineRef.current?.stop();
  }, []);

  useEffect(() => {
    if (isDead) {
      engineRef.current?.getDuration();
      persistence.saveRecord({
          date: Date.now(),
          score: score || 0,
          nickname: nickname,
          duration: engineRef.current?.getDuration() || 0
      });
    }
  }, [isDead]);

  const handleReturnToLobby = () => {
      actions.setPlaying(false);
      actions.setDead(false);
      actions.setSpectatingTarget(null);
      engineRef.current?.stop();
  };

  const handleRespawn = () => {
      // Restart the game session with the same settings
      startGame(nickname);
  };

  const cycleSpectator = (direction: 1 | -1) => {
      engineRef.current?.cycleSpectatorTarget(direction);
  };

  const handleUpgrade = useCallback((index: number) => {
      engineRef.current?.upgradeStat(index);
  }, []);

  const handleClassSelect = useCallback((classIndex: number) => {
      engineRef.current?.upgradeClass(classIndex);
  }, []);

  const handleMoveJoystick = (vector: { x: number, y: number }) => {
    if (!engineRef.current) return;
    engineRef.current.input.moveVector = vector;
  };

  const handleAimJoystick = (vector: { x: number, y: number }) => {
    if (!engineRef.current) return;
    engineRef.current.input.aimVector = vector;
  };

  const handleToggle = (key: 'autoFire' | 'autoSpin' | 'autoPilot' | 'autoLevel') => {
      actions.toggleAuto(key);
  };

  const changeLanguage = (lang: string) => {
      if (i18n && typeof i18n.changeLanguage === 'function') {
          i18n.changeLanguage(lang);
      }
      setShowSettings(false);
  };

  // Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current || !isPlaying) return;
      const key = e.key.toLowerCase();
      
      // Spectator Controls
      if (useGameStore.getState().isDead) {
          if (key === 'arrowleft' || key === 'a') cycleSpectator(-1);
          if (key === 'arrowright' || key === 'd') cycleSpectator(1);
          if (key === 'enter' || key === ' ') handleRespawn();
          return;
      }

      const input = engineRef.current.input;
      
      if (key === 'w' || key === 'arrowup') input.up = true;
      if (key === 's' || key === 'arrowdown') input.down = true;
      if (key === 'a' || key === 'arrowleft') input.left = true;
      if (key === 'd' || key === 'arrowright') input.right = true;
      
      if (key === 'e') handleToggle('autoFire');
      if (key === 'c') handleToggle('autoSpin');
      if (key === 'f') handleToggle('autoPilot');
      if (key === 'q') handleToggle('autoLevel');
      
      // Escape to toggle settings
      if (key === 'escape') setShowSettings(prev => !prev);

      const num = parseInt(key);
      if (!isNaN(num) && num >= 1 && num <= 8) handleUpgrade(num - 1);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const key = e.key.toLowerCase();
      const input = engineRef.current.input;
      if (key === 'w' || key === 'arrowup') input.up = false;
      if (key === 's' || key === 'arrowdown') input.down = false;
      if (key === 'a' || key === 'arrowleft') input.left = false;
      if (key === 'd' || key === 'arrowright') input.right = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!engineRef.current) return;
        engineRef.current.input.mouseX = e.clientX;
        engineRef.current.input.mouseY = e.clientY;
    };
    const handleMouseDown = () => { if (engineRef.current) engineRef.current.input.shoot = true; };
    const handleMouseUp = () => { if (engineRef.current) engineRef.current.input.shoot = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPlaying, handleUpgrade]);

  const startGame = (name: string) => {
    actions.setNickname(name);
    actions.setPlaying(true);
    actions.setDead(false);
    actions.setSpectatingTarget(null);
    useGameStore.setState({ toggles: { autoFire: false, autoSpin: false, autoPilot: false, autoLevel: false } });
    
    // Engine starts with current store gameMode
    const currentMode = useGameStore.getState().gameMode;
    if (engineRef.current) {
      engineRef.current.start(name, currentMode);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#b8b8b8]">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 cursor-crosshair touch-none" />
      
      <AnimatePresence>
        {!isPlaying && <Lobby key="lobby" onStart={startGame} />}
        
        {isPlaying && !isDead && (
          <div className="absolute inset-0 pointer-events-none z-10 p-4 sm:p-6 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="flex justify-between items-start pointer-events-auto">
              <div className="flex flex-col gap-2">
                  <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-xl text-white font-[Orbitron] text-2xl font-bold select-none border border-white/10">
                    {t('score')}: <span className="text-cyan-400">{Math.floor(score || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-white font-bold text-lg font-[Rajdhani] select-none pl-1 shadow-black drop-shadow-md">
                      {t('level', { level: level })}
                  </div>
                  {gameMode !== 'solo' && (
                     <div className="bg-purple-900/50 px-3 py-1 rounded text-white text-xs font-mono border border-purple-500 w-fit">
                        ROOM: {roomId}
                     </div>
                  )}
              </div>
              
              {/* Boss Warning Overlay */}
              <AnimatePresence>
                {bossActive && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.5, y: -100 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="fixed top-24 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-none"
                  >
                     <div className="text-red-500 font-black text-5xl sm:text-7xl font-[Orbitron] tracking-widest animate-pulse drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
                        WARNING
                     </div>
                     <div className="text-white font-bold text-2xl sm:text-3xl font-[Rajdhani] tracking-[0.5em] bg-red-900/80 px-6 py-2 rounded border-2 border-red-500 mt-2">
                        BOSS DETECTED
                     </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Class Selection Menu (Top Center) */}
              <AnimatePresence>
                {availableClassUpgrades.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed top-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md p-6 rounded-3xl border-2 border-cyan-400 shadow-[0_0_40px_cyan] flex flex-col items-center gap-4 pointer-events-auto z-50"
                  >
                     <h3 className="text-cyan-300 font-bold font-[Orbitron] text-lg tracking-widest animate-pulse drop-shadow-md">CLASS UPGRADE AVAILABLE</h3>
                     <div className="flex gap-4">
                         {availableClassUpgrades.map((idx) => (
                             <TankPreview key={idx} classIndex={idx} onClick={() => handleClassSelect(idx)} />
                         ))}
                     </div>
                     <p className="text-xs text-gray-400 font-bold">SELECT YOUR EVOLUTION PATH</p>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex gap-3">
                 {/* Leaderboard */}
                 <div className="bg-black/40 backdrop-blur-md p-4 rounded-xl w-48 hidden sm:block border border-white/5">
                    <h3 className="text-white text-sm font-bold mb-2 text-center tracking-wider border-b border-white/10 pb-1">{t('leaderboard')}</h3>
                    <div className="space-y-1 text-sm font-bold text-white/80">
                       <div className="flex justify-between text-cyan-400"><span>1. {nickname || "Player"}</span><span>{Math.floor(score || 0)}</span></div>
                       <div className="flex justify-between"><span>2. BotAlpha</span><span>15.2k</span></div>
                       <div className="flex justify-between"><span>3. TankX</span><span>12.8k</span></div>
                    </div>
                  </div>

                  {/* Settings Toggle */}
                  <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-3 bg-black/40 backdrop-blur-md rounded-xl text-white hover:bg-black/60 transition-colors pointer-events-auto text-2xl"
                  >
                    ⚙️
                  </button>
              </div>
            </div>

            {/* In-Game Settings Menu */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-20 right-6 bg-gray-900 p-6 rounded-2xl shadow-2xl border border-gray-600 pointer-events-auto z-50 flex flex-col gap-4 w-64"
                    >
                        <h4 className="text-white text-sm font-bold tracking-widest text-center border-b border-gray-700 pb-2">LANGUAGE</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => changeLanguage('en')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg border border-gray-700">🇺🇸 EN</button>
                            <button onClick={() => changeLanguage('th')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg border border-gray-700">🇹🇭 TH</button>
                            <button onClick={() => changeLanguage('jp')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg border border-gray-700">🇯🇵 JP</button>
                            <button onClick={() => changeLanguage('fr')} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-lg border border-gray-700">🇫🇷 FR</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Automation Panel */}
            <div className="absolute top-32 left-6 pointer-events-auto flex flex-col gap-3">
                <div className="bg-black/40 backdrop-blur-md p-3 rounded-xl border-l-4 border-cyan-500 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                    <div className="text-xs text-cyan-400 font-bold mb-2 tracking-widest font-[Orbitron]">AUTO-SYSTEMS</div>
                    <div className="flex flex-col gap-1.5">
                        <button onClick={() => handleToggle('autoPilot')} className={`text-xs font-bold px-3 py-1.5 rounded text-left transition-colors ${toggles.autoPilot ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/50' : 'text-gray-400 hover:text-white'}`}>
                            [F] AUTO PILOT: {toggles.autoPilot ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => handleToggle('autoLevel')} className={`text-xs font-bold px-3 py-1.5 rounded text-left transition-colors ${toggles.autoLevel ? 'bg-purple-500/20 text-purple-100 border border-purple-500/50' : 'text-gray-400 hover:text-white'}`}>
                            [Q] AUTO LEVEL: {toggles.autoLevel ? 'ON' : 'OFF'}
                        </button>
                         <button onClick={() => handleToggle('autoFire')} className={`text-xs font-bold px-3 py-1.5 rounded text-left transition-colors ${toggles.autoFire ? 'bg-red-500/20 text-red-100 border border-red-500/50' : 'text-gray-400 hover:text-white'}`}>
                            [E] AUTO FIRE: {toggles.autoFire ? 'ON' : 'OFF'}
                        </button>
                         <button onClick={() => handleToggle('autoSpin')} className={`text-xs font-bold px-3 py-1.5 rounded text-left transition-colors ${toggles.autoSpin ? 'bg-green-500/20 text-green-100 border border-green-500/50' : 'text-gray-400 hover:text-white'}`}>
                            [C] AUTO SPIN: {toggles.autoSpin ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Section - Stats & XP */}
            <div className="flex items-end justify-between w-full pointer-events-none pb-6 sm:pb-10 px-4 sm:px-10">
                
                {/* Stats Panel (Bottom Left) - IMPROVED VISIBILITY */}
                <div className="flex flex-col gap-2 pointer-events-auto bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 hover:bg-black/60 transition-colors shadow-2xl">
                    {STAT_KEYS.map((key, i) => (
                        <div key={i} className="group flex items-center gap-4">
                             <div className="relative h-5 sm:h-6 bg-gray-900/80 rounded overflow-hidden border border-white/20 w-40 sm:w-56 shadow-inner">
                                 <div className="absolute inset-0 flex items-center justify-between px-3 text-xs sm:text-sm font-bold text-white z-10 drop-shadow-md tracking-wide">
                                     <span>{t(key)}</span>
                                     <span className="opacity-80">[{i+1}]</span>
                                 </div>
                                 <motion.div 
                                    className="h-full relative" 
                                    style={{ width: `${((stats?.[i] || 0) / MAX_STAT_LEVEL) * 100}%`, backgroundColor: STAT_COLORS[i] }}
                                    layout
                                 >
                                    <div className="absolute inset-0 bg-white/20" />
                                 </motion.div>
                             </div>
                             
                             <motion.button 
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleUpgrade(i)}
                                disabled={(statPoints || 0) <= 0 || (stats?.[i] || 0) >= MAX_STAT_LEVEL}
                                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-sm font-black shadow-lg border border-white/20 transition-all duration-200 ${(statPoints || 0) > 0 ? 'bg-cyan-500 text-white hover:bg-cyan-400 cursor-pointer scale-100 opacity-100' : 'bg-gray-700 text-gray-500 scale-90 opacity-0'}`}
                             >
                                 +
                             </motion.button>
                        </div>
                    ))}
                    <div className="h-1" />
                    <div className="text-sm font-mono text-cyan-300 tracking-wider font-bold">
                        {t('points_avail')}: <span className="text-white text-xl ml-2">{statPoints}</span>
                    </div>
                </div>

                {/* XP Bar (Bottom Center-Right) */}
                <div className="flex-1 flex flex-col items-center justify-end pl-8 sm:pl-24 mb-1 sm:mb-0">
                    <div className="w-full max-w-3xl h-6 sm:h-8 bg-gray-900/90 rounded-full border-2 border-gray-600 overflow-hidden relative shadow-lg">
                         <div className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm text-white font-bold z-10 font-mono tracking-widest shadow-black drop-shadow-md">
                             LEVEL {level} &nbsp;•&nbsp; XP {Math.floor(xp || 0).toLocaleString()} / {maxXp.toLocaleString()}
                         </div>
                         <motion.div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400" initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((xp || 0) / (maxXp || 1)) * 100)}%` }} transition={{ type: "spring", bounce: 0, duration: 0.5 }}/>
                    </div>
                </div>
            </div>

            {/* Mobile Controls */}
            {isMobile && (
              <>
                <div className="absolute bottom-10 left-10 pointer-events-auto opacity-60 hover:opacity-100 transition-opacity">
                    <VirtualJoystick onMove={handleMoveJoystick} size={140} stickSize={70} />
                </div>
                <div className="absolute bottom-10 right-10 pointer-events-auto opacity-60 hover:opacity-100 transition-opacity">
                    <VirtualJoystick onMove={handleAimJoystick} size={140} stickSize={70} baseColor="rgba(255, 0, 0, 0.1)" stickColor="rgba(255, 0, 0, 0.4)" />
                </div>
              </>
            )}
          </div>
        )}

        {isDead && (
             <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-20"
             >
                 {/* Top Death Message */}
                 <div className="absolute top-32 flex flex-col items-center">
                    <h1 className="text-7xl md:text-9xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(255,0,0,0.8)] font-[Orbitron] mb-4">{t('you_died')}</h1>
                    <p className="text-3xl text-white font-[Rajdhani] bg-black/80 px-8 py-3 rounded-full border border-red-500/30 backdrop-blur-md">
                        Final {t('score')}: <span className="text-cyan-400 font-bold">{Math.floor(score || 0).toLocaleString()}</span>
                    </p>
                 </div>

                 {/* Spectator Controls Overlay - Center Bottom */}
                 <div className="absolute bottom-20 flex flex-col items-center gap-6 bg-black/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl min-w-[400px]">
                     <p className="text-base text-gray-300 tracking-wider font-bold">SPECTATOR MODE ACTIVE</p>
                     
                     <div className="flex items-center gap-6">
                        <button 
                            onClick={() => cycleSpectator(-1)}
                            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/20 text-white text-2xl pb-1"
                        >
                            ←
                        </button>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleRespawn}
                                className="px-12 py-4 bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-500 hover:to-cyan-500 text-white font-black font-[Orbitron] tracking-widest rounded-xl shadow-lg transform hover:scale-105 transition-all text-2xl"
                            >
                                RESPAWN
                            </button>
                            <button 
                                onClick={handleReturnToLobby}
                                className="px-8 py-3 bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-white font-bold font-[Rajdhani] tracking-widest rounded-xl border border-white/10 hover:border-red-500/50 transition-all text-base"
                            >
                                BACK TO LOBBY
                            </button>
                        </div>
                         <button 
                            onClick={() => cycleSpectator(1)}
                            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/20 text-white text-2xl pb-1"
                        >
                            →
                        </button>
                     </div>
                     <p className="text-xs text-gray-400 font-bold mt-2">PRESS SPACE TO RESPAWN</p>
                 </div>
             </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameCanvas;