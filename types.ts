
export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  BOSS = 'BOSS', // New Boss Type
  BULLET = 'BULLET',
  WALL = 'WALL', // New Wall Type
  
  // Basic Food
  FOOD_SQUARE = 'FOOD_SQUARE',
  FOOD_TRIANGLE = 'FOOD_TRIANGLE',
  FOOD_PENTAGON = 'FOOD_PENTAGON',
  
  // Advanced Food
  FOOD_ALPHA_PENTAGON = 'FOOD_ALPHA_PENTAGON', // Big Blue
  FOOD_HEXAGON = 'FOOD_HEXAGON',               // Purple
  FOOD_HEPTAGON = 'FOOD_HEPTAGON',             // Cyan (7 sides)
  FOOD_OCTAGON = 'FOOD_OCTAGON',               // Orange (8 sides)
  FOOD_NONAGON = 'FOOD_NONAGON',               // Red-Pink (9 sides)
  
  // Rare/God Food
  FOOD_STAR = 'FOOD_STAR',                     // Gold (Spiky)
  FOOD_CROSS = 'FOOD_CROSS',                   // Green (Plus shape)
  FOOD_OMEGA = 'FOOD_OMEGA',                   // Black/Rainbow (Boss Food)
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerStats {
  healthMax: number;
  healthRegen: number;
  bodyDamage: number;
  bulletSpeed: number;
  bulletPenetration: number;
  bulletDamage: number;
  reload: number;
  movementSpeed: number;
}

export interface BarrelDefinition {
  offsetX: number; // Left/Right from center
  offsetY: number; // Forward/Back from center
  width: number;
  length: number;
  recoil: number; // Visual recoil amount
  delay: number; // Shot delay ratio (0 to 1)
  reloadMultiplier: number;
  damageMultiplier: number;
  spread: number; // Angle variance
  angle: number; // Fixed angle offset (e.g. for Flank Guard)
  bulletSpeed?: number; // Multiplier for bullet speed
}

export interface TankClass {
  index: number; // Unique ID for the class array
  name: string;
  tier: number;
  barrels: BarrelDefinition[];
  bodyRadius: number;
  upgradesTo?: number[]; // Array of indices this class can evolve into
  type?: 'BULLET' | 'RAMMER' | 'DRONE'; // Hint for AI/UI
}

export interface Entity {
  id: string;
  type: EntityType;
  
  // Physics State
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  
  // Render State
  prevPosition: Vector2; 
  renderPosition: Vector2;
  prevRotation: number;

  radius: number;
  health: number;
  maxHealth: number;
  color: string;
  scoreValue: number;
  isDead: boolean;
  damage: number;
  ownerId?: string;
  
  // Visuals
  hitFlash: number; // 0.0 to 1.0, indicates recent damage for white flash effect
  
  // Leveling & Class
  xp: number;
  level: number;
  classIndex: number; // Index in TANK_CLASSES array
  
  // Stats
  stats: PlayerStats;
  statPoints: number;
  upgrades: number[];

  // Combat State
  barrelRecoil: number[]; // Array tracking current visual recoil for each barrel
  barrelCooldown: number[]; // Array tracking reload time for each barrel

  // AI
  aiBlackboard?: any;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

export interface GameState {
  entities: Map<string, Entity>;
  camera: Vector2;
  score: number;
  level: number;
  xp: number;
  maxXp: number;
  stats: number[];
  statPoints: number;
  leaderboard: { name: string; score: number }[];
  availableClassUpgrades: number[]; // List of class indices player can choose
  bossActive: boolean; // UI Trigger
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  autoFire: boolean;
  autoSpin: boolean;
  autoPilot: boolean;
  autoLevel: boolean;
  mouseX: number;
  mouseY: number;
  moveVector?: Vector2;
  aimVector?: Vector2;
}

export interface GameConfig {
  nickname: string;
  viewportWidth: number;
  viewportHeight: number;
}

export interface GameRecord {
  id?: number;
  date: number;
  score: number;
  nickname: string;
  duration: number;
}
