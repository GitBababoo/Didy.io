


import { TankClass } from "./types";

export const MAP_SIZE = 20000; // Expanded map (4x size)
export const GRID_SIZE = 50;
export const SPATIAL_GRID_SIZE = 150;

// Physics
export const FRICTION = 0.92;
export const RECOIL_FORCE = 2;

// Colors - NEON PALETTE
export const COLORS = {
  background: '#121212', // Darker background for Neon contrast
  grid: '#2a2a2a',
  wall: '#444444',     // Dark grey fill
  wallBorder: '#00ccff', // Neon Blue border
  player: '#00f3ff', // Cyan Neon
  enemy: '#ff003c',  // Red Neon
  boss: '#8000ff',   // Deep Purple Neon for Boss
  bullet: '#ff003c',
  bossBullet: '#aa00ff',
  food: {
    square: '#ffe869', // Yellow
    triangle: '#ff3838', // Red
    pentagon: '#548cff', // Blue
    alpha: '#4444ff',    // Deep Blue
    hexagon: '#b026ff',  // Purple
    heptagon: '#00ffaa', // Mint Green (New)
    octagon: '#ff9100',  // Orange (New)
    nonagon: '#ff00aa',  // Hot Pink (New)
    star: '#ffd700',     // Gold (Rare)
    cross: '#00ff00',    // Bright Green (Healer feel)
    omega: '#ffffff',    // White/Rainbow
  },
  barrel: '#555555',
  barrelBorder: '#222222',
  ui: {
    upgrade: '#e0e0e0',
    health: '#85e37d',
    xp: '#e4da54'
  }
};

// Balancing - Adjusted for new food
export const ENTITY_CONFIG = {
  PLAYER: { radius: 25, health: 100, damage: 20 },
  BOSS: { radius: 80, health: 50000, damage: 50 }, // Boss Config
  WALL: { radius: 50, health: 999999, damage: 0 }, // Radius acts as half-width for walls
  
  // Low Tier
  FOOD_SQUARE: { radius: 15, health: 10, score: 10, damage: 5, xp: 10 },
  FOOD_TRIANGLE: { radius: 20, health: 30, score: 25, damage: 8, xp: 25 },
  FOOD_PENTAGON: { radius: 35, health: 100, score: 100, damage: 15, xp: 100 },
  // Mid Tier
  FOOD_HEXAGON: { radius: 45, health: 300, score: 300, damage: 20, xp: 300 },
  FOOD_HEPTAGON: { radius: 50, health: 600, score: 600, damage: 25, xp: 600 },
  FOOD_OCTAGON: { radius: 55, health: 1000, score: 1000, damage: 30, xp: 1000 },
  // High Tier
  FOOD_NONAGON: { radius: 60, health: 2000, score: 2000, damage: 35, xp: 2000 },
  FOOD_ALPHA_PENTAGON: { radius: 80, health: 5000, score: 3000, damage: 40, xp: 3000 },
  FOOD_CROSS: { radius: 30, health: 1500, score: 2500, damage: 10, xp: 2500 }, // Glassy, easy to break, high reward
  FOOD_STAR: { radius: 40, health: 4000, score: 5000, damage: 50, xp: 5000 }, // Spiky, dangerous
  FOOD_OMEGA: { radius: 100, health: 50000, score: 50000, damage: 100, xp: 50000 }, // Boss
  
  BULLET: { radius: 10, health: 1, damage: 10, score: 0 },
};

export const LEVEL_XP = [
  0, 10, 30, 60, 100, 150, 210, 280, 360, 450, 550, 660, 780, 910, 1050, 
  1200, 1360, 1530, 1710, 1900, 2100, 2310, 2530, 2760, 3000, 3250, 3510, 
  3780, 4060, 4350, 4650, 4960, 5280, 5610, 5950, 6300, 6660, 7030, 7410, 
  7800, 8200, 8610, 9030, 9460, 9900, 12000, 15000, 20000, 30000, 50000, 
  75000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 500000, 1000000
];

export const MAX_STAT_LEVEL = 10;
export const STAT_NAMES = [
  "Regen", "Max Health", "Body Dmg", "Bullet Spd", "Bullet Pen", "Bullet Dmg", "Reload", "Move Spd"
];
export const STAT_COLORS = [
  "#eebb99", "#ff88cc", "#aa88ff", "#55aaff", "#eeee77", "#ff4444", "#99ee99", "#88ddff"
];

// Helper to clean up definitions
const B = (width: number, length: number, props: any = {}) => ({
    offsetX: 0, offsetY: 0, recoil: 0, delay: 0, reloadMultiplier: 1, 
    damageMultiplier: 1, spread: 0, angle: 0, bulletSpeed: 1, ...props, width, length
});

// --- TIER SYSTEM (1-20) ---
// Defined Archetypes:
// 1. Standard (Balanced)
// 2. Sniper (Long range, fast bullets)
// 3. Machine Gun (Fast reload, spread)
// 4. Rocket (High damage, slow bullets, high recoil)
// 5. Rammer (No bullets/Recoil only, High Body stats)
// 6. Flank/Multi (Crowd control)

export const TANK_CLASSES: TankClass[] = [
  // --- TIER 1 (Lv 1) ---
  { index: 0, name: "Tank", tier: 1, bodyRadius: 25, barrels: [B(20, 45)], upgradesTo: [1, 2, 3, 4] },

  // --- TIER 2 (Lv 5) - The Split ---
  { index: 1, name: "Twin", tier: 2, bodyRadius: 25, barrels: [B(18, 45, {offsetX: -12}), B(18, 45, {offsetX: 12, delay: 0.5})], upgradesTo: [5, 6, 20] },
  { index: 2, name: "Sniper", tier: 2, bodyRadius: 25, barrels: [B(22, 65, {reloadMultiplier: 1.5, bulletSpeed: 1.8, damageMultiplier: 1.2})], upgradesTo: [7, 8, 21] },
  { index: 3, name: "Machine Gun", tier: 2, bodyRadius: 25, barrels: [B(22, 35, {spread: 0.4, reloadMultiplier: 0.6, damageMultiplier: 0.7})], upgradesTo: [9, 10, 22] },
  { index: 4, name: "Flank Guard", tier: 2, bodyRadius: 25, barrels: [B(20, 45), B(20, 35, {angle: Math.PI})], upgradesTo: [11, 12, 23] },

  // --- TIER 3 (Lv 10) ---
  { index: 5, name: "Triple Shot", tier: 3, bodyRadius: 25, barrels: [B(18, 45), B(18, 45, {angle: 0.4}), B(18, 45, {angle: -0.4})], upgradesTo: [13] },
  { index: 6, name: "Twin Flank", tier: 3, bodyRadius: 25, barrels: [B(18, 45, {offsetX: -12}), B(18, 45, {offsetX: 12, delay: 0.5}), B(18, 35, {angle: Math.PI, offsetX: -12}), B(18, 35, {angle: Math.PI, offsetX: 12, delay: 0.5})], upgradesTo: [14] },
  { index: 7, name: "Assassin", tier: 3, bodyRadius: 28, barrels: [B(25, 75, {reloadMultiplier: 2, bulletSpeed: 2.0, damageMultiplier: 1.5})], upgradesTo: [15] },
  { index: 8, name: "Hunter", tier: 3, bodyRadius: 26, barrels: [B(25, 55, {reloadMultiplier: 1.5}), B(15, 65, {reloadMultiplier: 1.5, delay: 0.1, damageMultiplier: 0.8})], upgradesTo: [16] },
  
  // Rocket Path Starts Here
  { index: 9, name: "Launcher", tier: 3, bodyRadius: 30, barrels: [B(35, 50, {reloadMultiplier: 2, damageMultiplier: 3, recoil: 4, bulletSpeed: 0.8})], upgradesTo: [17] },
  
  { index: 10, name: "Gunner", tier: 3, bodyRadius: 25, barrels: [B(12, 35, {offsetX: 10}), B(12, 35, {offsetX: -10}), B(12, 45, {offsetX: 18, delay: 0.5}), B(12, 45, {offsetX: -18, delay: 0.5})], upgradesTo: [18] },
  { index: 11, name: "Quad Tank", tier: 3, bodyRadius: 30, barrels: [B(20, 45), B(20, 45, {angle: Math.PI/2}), B(20, 45, {angle: Math.PI}), B(20, 45, {angle: -Math.PI/2})], upgradesTo: [19] },
  
  // Rammer Path Starts Here
  { index: 12, name: "Tri-Angle", tier: 3, bodyRadius: 25, type: 'RAMMER', barrels: [B(20, 45), B(20, 35, {angle: Math.PI + 0.5, recoil: 3}), B(20, 35, {angle: Math.PI - 0.5, recoil: 3})], upgradesTo: [24] },

  // --- TIER 4 (Lv 15) ---
  { index: 13, name: "Penta Shot", tier: 4, bodyRadius: 32, barrels: [B(18, 45), B(18, 42, {angle: 0.3}), B(18, 42, {angle: -0.3}), B(18, 38, {angle: 0.6}), B(18, 38, {angle: -0.6})], upgradesTo: [25] },
  { index: 14, name: "Battleship", tier: 4, bodyRadius: 28, barrels: [B(10, 30, {angle: Math.PI/2 - 0.2}), B(10, 30, {angle: Math.PI/2 + 0.2}), B(10, 30, {angle: -Math.PI/2 - 0.2}), B(10, 30, {angle: -Math.PI/2 + 0.2})], upgradesTo: [26] },
  
  // Advanced Sniper
  { index: 15, name: "Ranger", tier: 4, bodyRadius: 28, barrels: [B(30, 90, {reloadMultiplier: 2.5, bulletSpeed: 2.5, damageMultiplier: 2.5})], upgradesTo: [27] },
  { index: 16, name: "Predator", tier: 4, bodyRadius: 28, barrels: [B(28, 50, {delay: 0}), B(22, 65, {delay: 0.2}), B(16, 80, {delay: 0.4})], upgradesTo: [28] },
  
  // Advanced Rocket/Explosive
  { index: 17, name: "Destroyer", tier: 4, bodyRadius: 40, barrels: [B(50, 60, {reloadMultiplier: 3.0, damageMultiplier: 5, recoil: 6, bulletSpeed: 0.7})], upgradesTo: [29] },
  
  { index: 18, name: "Streamliner", tier: 4, bodyRadius: 28, barrels: [B(14, 70, {damageMultiplier: 0.2}), B(14, 60, {damageMultiplier: 0.2, delay: 0.2}), B(14, 50, {damageMultiplier: 0.2, delay: 0.4}), B(14, 40, {damageMultiplier: 0.2, delay: 0.6}), B(14, 30, {damageMultiplier: 0.2, delay: 0.8})], upgradesTo: [30] },
  { index: 19, name: "Octo Tank", tier: 4, bodyRadius: 32, barrels: [B(18, 45), B(18, 45, {angle: Math.PI/2}), B(18, 45, {angle: Math.PI}), B(18, 45, {angle: -Math.PI/2}), B(18, 45, {angle: Math.PI/4, delay: 0.5}), B(18, 45, {angle: Math.PI*3/4, delay: 0.5}), B(18, 45, {angle: -Math.PI*3/4, delay: 0.5}), B(18, 45, {angle: -Math.PI/4, delay: 0.5})], upgradesTo: [31] },
  
  // --- TIER 5 (Lv 20) ---
  { index: 20, name: "Triplet", tier: 5, bodyRadius: 28, barrels: [B(18, 45), B(18, 40, {offsetX: 14, delay: 0.5}), B(18, 40, {offsetX: -14, delay: 0.5})], upgradesTo: [32] },
  { index: 21, name: "Stalker", tier: 5, bodyRadius: 28, barrels: [B(25, 75, {reloadMultiplier: 2.2, damageMultiplier: 1.8})], upgradesTo: [33] },
  { index: 22, name: "Sprayer", tier: 5, bodyRadius: 28, barrels: [B(25, 45), B(15, 55, {spread: 0.2, reloadMultiplier: 0.5, delay: 0.5})], upgradesTo: [34] },
  { index: 23, name: "Auto 3", tier: 5, bodyRadius: 28, barrels: [B(15, 30, {angle: 0}), B(15, 30, {angle: Math.PI * 2/3}), B(15, 30, {angle: Math.PI * 4/3})], upgradesTo: [35] },
  
  // Advanced Rammer
  { index: 24, name: "Booster", tier: 5, bodyRadius: 28, type: 'RAMMER', barrels: [B(20, 45), B(18, 35, {angle: Math.PI + 0.6, recoil: 3.5}), B(18, 35, {angle: Math.PI - 0.6, recoil: 3.5}), B(18, 45, {angle: Math.PI + 0.3, recoil: 3.5, delay: 0.2}), B(18, 45, {angle: Math.PI - 0.3, recoil: 3.5, delay: 0.2})], upgradesTo: [36] },

  // --- TIER 6 (Lv 25) ---
  { index: 25, name: "Spread Shot", tier: 6, bodyRadius: 35, barrels: [B(20, 50), B(12, 45, {angle: 0.2, delay: 0.1}), B(12, 45, {angle: -0.2, delay: 0.1}), B(12, 40, {angle: 0.4, delay: 0.2}), B(12, 40, {angle: -0.4, delay: 0.2}), B(12, 35, {angle: 0.6, delay: 0.3}), B(12, 35, {angle: -0.6, delay: 0.3})], upgradesTo: [37] },
  { index: 26, name: "Overlord", tier: 6, bodyRadius: 30, barrels: [B(30, 40, {angle: 0}), B(30, 40, {angle: Math.PI/2}), B(30, 40, {angle: Math.PI}), B(30, 40, {angle: -Math.PI/2})], upgradesTo: [38] },

  // --- TIER 7 (Lv 30) - SPECIALIZED ---
  // Sniper: Executioner
  { index: 27, name: "Executioner", tier: 7, bodyRadius: 30, barrels: [B(35, 110, {reloadMultiplier: 3.5, bulletSpeed: 3.0, damageMultiplier: 3.5})], upgradesTo: [39] },
  
  { index: 28, name: "X-Hunter", tier: 7, bodyRadius: 30, barrels: [B(30, 50), B(25, 65), B(20, 80), B(15, 95)], upgradesTo: [40] },
  
  // Rocket: Annihilator
  { index: 29, name: "Annihilator", tier: 7, bodyRadius: 45, barrels: [B(70, 50, {reloadMultiplier: 4.0, damageMultiplier: 6, recoil: 10, bulletSpeed: 0.6})], upgradesTo: [41] },
  
  { index: 30, name: "Gatling", tier: 7, bodyRadius: 30, barrels: [B(12, 60, {offsetX: 6, delay: 0}), B(12, 60, {offsetX: -6, delay: 0.25}), B(12, 60, {offsetX: 12, delay: 0.5}), B(12, 60, {offsetX: -12, delay: 0.75})], upgradesTo: [42] },
  { index: 31, name: "Cyclone", tier: 7, bodyRadius: 35, barrels: Array.from({length: 12}).map((_, i) => B(15, 50, {angle: (Math.PI*2/12)*i})), upgradesTo: [43] },

  // --- TIER 8 (Lv 35) ---
  { index: 32, name: "Quint", tier: 8, bodyRadius: 32, barrels: [B(18, 50), B(18, 45, {offsetX: 15}), B(18, 45, {offsetX: -15}), B(18, 40, {offsetX: 30, angle: 0.1}), B(18, 40, {offsetX: -30, angle: -0.1})], upgradesTo: [44] },
  { index: 33, name: "Ghost", tier: 8, bodyRadius: 28, barrels: [B(30, 80, {reloadMultiplier: 2.5, damageMultiplier: 2, bulletSpeed: 2.5})], upgradesTo: [44] },
  { index: 34, name: "Shotgun", tier: 8, bodyRadius: 30, barrels: [B(30, 50), B(10, 50, {angle: 0.1}), B(10, 50, {angle: -0.1}), B(10, 50, {angle: 0.2}), B(10, 50, {angle: -0.2})], upgradesTo: [44] },
  { index: 35, name: "Auto 5", tier: 8, bodyRadius: 32, barrels: Array.from({length: 5}).map((_,i) => B(15, 35, {angle: (Math.PI*2/5)*i})), upgradesTo: [44] },
  
  // Rammer: Fighter (Fastest)
  { index: 36, name: "Fighter", tier: 8, bodyRadius: 30, type: 'RAMMER', barrels: [B(20, 50), B(18, 40, {angle: Math.PI/2}), B(18, 40, {angle: -Math.PI/2}), B(18, 35, {angle: Math.PI + 0.5, recoil: 4}), B(18, 35, {angle: Math.PI - 0.5, recoil: 4})], upgradesTo: [44] },

  // --- TIER 9 to 14 (Lv 40 - 65) - EXPERIMENTAL ---
  { index: 37, name: "Master", tier: 9, bodyRadius: 38, barrels: [B(20, 50), B(20, 50, {angle: 0.2}), B(20, 50, {angle: -0.2}), B(20, 40, {angle: 0.4}), B(20, 40, {angle: -0.4}), B(20, 30, {angle: 0.6}), B(20, 30, {angle: -0.6})], upgradesTo: [45] },
  { index: 38, name: "Factory", tier: 9, bodyRadius: 35, barrels: [B(25, 45, {angle: 0}), B(25, 45, {angle: Math.PI*2/3}), B(25, 45, {angle: Math.PI*4/3})], upgradesTo: [45] },
  
  // Sniper God: Railgun
  { index: 39, name: "Railgun", tier: 10, bodyRadius: 32, barrels: [B(30, 130, {reloadMultiplier: 4, bulletSpeed: 4, damageMultiplier: 4})], upgradesTo: [45] },
  
  { index: 40, name: "Sniper X", tier: 10, bodyRadius: 32, barrels: [B(35, 60), B(30, 80), B(25, 100), B(20, 120)], upgradesTo: [45] },
  
  // Rocket God: Skimmer (Spinning bullets)
  { index: 41, name: "Skimmer", tier: 11, bodyRadius: 42, barrels: [B(60, 60, {recoil: 8, bulletSpeed: 0.5, damageMultiplier: 3}), B(20, 50, {angle: Math.PI, delay: 0.5}), B(20, 50, {angle: Math.PI/2}), B(20, 50, {angle: -Math.PI/2})], upgradesTo: [45] },
  
  { index: 42, name: "Vulcan", tier: 12, bodyRadius: 35, barrels: Array.from({length: 6}).map((_, i) => B(12, 70, {offsetX: (i-2.5)*8, delay: i*0.1})), upgradesTo: [45] },
  { index: 43, name: "Black Hole", tier: 13, bodyRadius: 40, barrels: Array.from({length: 16}).map((_, i) => B(12, 55, {angle: (Math.PI*2/16)*i})), upgradesTo: [45] },
  
  // Rammer God: Spike
  { index: 44, name: "Spike", tier: 14, bodyRadius: 35, type: 'RAMMER', barrels: Array.from({length: 12}).map((_, i) => B(0, 0, {angle: (Math.PI*2/12)*i})), upgradesTo: [45] }, // No visual barrels, spikes simulated in rendering or just logic

  // --- TIER 15 (Lv 70) - The Gatekeeper ---
  { index: 45, name: "Titan", tier: 15, bodyRadius: 50, barrels: [B(80, 70, {reloadMultiplier: 4, damageMultiplier: 6, recoil: 10}), B(30, 50, {angle: Math.PI/4}), B(30, 50, {angle: -Math.PI/4})], upgradesTo: [46] },

  // --- TIER 16 (Lv 75) ---
  { index: 46, name: "Leviathan", tier: 16, bodyRadius: 55, barrels: [B(40, 80), B(40, 80, {angle: Math.PI}), B(30, 60, {angle: Math.PI/2}), B(30, 60, {angle: -Math.PI/2}), B(20, 50, {angle: Math.PI/4}), B(20, 50, {angle: -Math.PI/4}), B(20, 50, {angle: Math.PI*3/4}), B(20, 50, {angle: -Math.PI*3/4})], upgradesTo: [47] },

  // --- TIER 17 (Lv 80) ---
  { index: 47, name: "Behemoth", tier: 17, bodyRadius: 60, barrels: [B(100, 80, {reloadMultiplier: 5, damageMultiplier: 8}), B(30, 60, {angle: 0.5}), B(30, 60, {angle: -0.5})], upgradesTo: [48] },

  // --- TIER 18 (Lv 85) ---
  { index: 48, name: "Colossus", tier: 18, bodyRadius: 65, barrels: Array.from({length: 8}).map((_,i) => B(30, 70, {angle: (Math.PI*2/8)*i, reloadMultiplier: 1.5})), upgradesTo: [49] },

  // --- TIER 19 (Lv 90) ---
  { index: 49, name: "Alpha", tier: 19, bodyRadius: 70, barrels: [B(60, 100, {delay: 0}), B(50, 110, {delay: 0.1}), B(40, 120, {delay: 0.2}), B(30, 130, {delay: 0.3})], upgradesTo: [50] },

  // --- TIER 20 (Lv 100) - FINAL GOD CLASS ---
  { 
    index: 50, name: "OMEGA", tier: 20, bodyRadius: 80, 
    barrels: [
        B(120, 100, {reloadMultiplier: 2, damageMultiplier: 10}), // Main Cannon
        B(40, 80, {angle: Math.PI/4}), B(40, 80, {angle: -Math.PI/4}), // Side Cannons
        B(40, 80, {angle: Math.PI*3/4}), B(40, 80, {angle: -Math.PI*3/4}), // Rear Side
        B(30, 60, {angle: Math.PI/2}), B(30, 60, {angle: -Math.PI/2}), // Perpendicular
        B(20, 50, {angle: Math.PI, recoil: 5}), // Rear Thrust
        // Spinning Turrets (simulated by fixed angles)
        B(15, 40, {angle: 0.1}), B(15, 40, {angle: -0.1}), 
        B(15, 40, {angle: 0.2}), B(15, 40, {angle: -0.2})
    ]
  }
];
