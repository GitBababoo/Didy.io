


import { v4 as uuidv4 } from 'uuid';
import { Entity, EntityType, PlayerStats } from '../../types';
import { ENTITY_CONFIG, COLORS, MAP_SIZE, TANK_CLASSES, MAX_STAT_LEVEL, RECOIL_FORCE, LEVEL_XP } from '../../constants';
import { soundEngine } from '../SoundEngine';
import { useGameStore } from '../../store/gameStore';

export class EntityManager {
  public entities: Map<string, Entity>;

  constructor(entities: Map<string, Entity>) {
    this.entities = entities;
  }

  public clear() {
    this.entities.clear();
  }

  public createEntity(id: string, type: EntityType, x: number, y: number, color: string): Entity {
    const baseStats: PlayerStats = {
      healthMax: 100, healthRegen: 0.01, bodyDamage: 20,
      bulletSpeed: 12, bulletPenetration: 10, bulletDamage: 10,
      reload: 50, movementSpeed: 0.5
    };

    const entity: Entity = {
      id, type,
      position: { x, y }, velocity: { x: 0, y: 0 }, rotation: Math.random() * Math.PI * 2,
      prevPosition: { x, y }, renderPosition: { x, y }, prevRotation: 0,
      radius: ENTITY_CONFIG.PLAYER.radius, health: 100, maxHealth: 100,
      color, scoreValue: 100, isDead: false, damage: 20,
      xp: 0, level: 1, classIndex: 0,
      hitFlash: 0,
      stats: baseStats, statPoints: 0, upgrades: [0, 0, 0, 0, 0, 0, 0, 0],
      barrelRecoil: [], barrelCooldown: []
    };

    // Init barrel state
    const tankClass = TANK_CLASSES[0];
    entity.barrelRecoil = new Array(tankClass.barrels.length).fill(0);
    entity.barrelCooldown = new Array(tankClass.barrels.length).fill(0);

    entity.prevRotation = entity.rotation;
    this.entities.set(id, entity);
    return entity;
  }

  public spawnWall(x: number, y: number) {
      const id = uuidv4();
      const entity = this.createEntity(id, EntityType.WALL, x, y, COLORS.wall);
      entity.radius = ENTITY_CONFIG.WALL.radius;
      entity.health = ENTITY_CONFIG.WALL.health;
      entity.maxHealth = ENTITY_CONFIG.WALL.health;
      entity.velocity = { x: 0, y: 0 };
  }

  public spawnPlayer(nickname: string, peerId?: string, localPlayerId?: string | null): string {
    const id = uuidv4();
    // Spawn player in the outer ring (safer zone)
    const center = MAP_SIZE / 2;
    const angle = Math.random() * Math.PI * 2;
    // Spawn between radius 6000 and 9000 (assuming map is 20000, radius 10000)
    const dist = 6000 + Math.random() * 3000;
    const x = center + Math.cos(angle) * dist;
    const y = center + Math.sin(angle) * dist;

    this.createEntity(id, EntityType.PLAYER, x, y, COLORS.player);
    
    // Play spawn sound only if it's the local player
    if (!peerId || id === localPlayerId) soundEngine.playSpawn();
    
    return id;
  }

  public spawnBoss(aiSystem: any) {
      const id = uuidv4();
      const config = ENTITY_CONFIG.BOSS;
      // Boss spawns near center or mid-zone to challenge strong players
      // Or sometimes wanders in from edges
      const edge = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      
      // 50% Chance Center Spawn, 50% Edge Spawn
      if (Math.random() > 0.5) {
          x = MAP_SIZE/2 + (Math.random() - 0.5) * 4000;
          y = MAP_SIZE/2 + (Math.random() - 0.5) * 4000;
      } else {
          if (edge === 0) { x = Math.random() * MAP_SIZE; y = 200; }
          else if (edge === 1) { x = MAP_SIZE - 200; y = Math.random() * MAP_SIZE; }
          else if (edge === 2) { x = Math.random() * MAP_SIZE; y = MAP_SIZE - 200; }
          else { x = 200; y = Math.random() * MAP_SIZE; }
      }

      const boss = this.createEntity(id, EntityType.BOSS, x, y, COLORS.boss);
      
      boss.radius = config.radius;
      boss.maxHealth = config.health;
      boss.health = config.health;
      boss.damage = config.damage;
      boss.scoreValue = 50000;
      boss.level = 100;

      // Assign OMEGA class (Index 50)
      this.applyClassChange(boss, 50);

      // Max Stats
      boss.stats.healthRegen = 2.0;
      boss.stats.bodyDamage = 50;
      boss.stats.bulletSpeed = 15;
      boss.stats.bulletPenetration = 100;
      boss.stats.bulletDamage = 40;
      boss.stats.reload = 10; // Very fast
      boss.stats.movementSpeed = 0.8; // Slow but unstoppable

      aiSystem.initBot(boss);
      
      // Global Notification
      useGameStore.getState().updateHud({ bossActive: true });
      setTimeout(() => useGameStore.getState().updateHud({ bossActive: false }), 5000);
      soundEngine.playSpawn();
  }

  public spawnBot(aiSystem: any) {
    const id = uuidv4();
    const bot = this.createEntity(id, EntityType.ENEMY, Math.random() * MAP_SIZE, Math.random() * MAP_SIZE, COLORS.enemy);
    
    // Random upgrades
    for (let i = 0; i < 30; i++) {
      const stat = Math.floor(Math.random() * 8);
      if (bot.upgrades[stat] < MAX_STAT_LEVEL) bot.upgrades[stat]++;
    }
    
    // Bot Evolution
    bot.level = Math.floor(Math.random() * 80) + 1;
    this.recalculateStats(bot);

    let currentClass = TANK_CLASSES[0];
    while (true) {
      if (currentClass.upgradesTo && currentClass.upgradesTo.length > 0) {
        const nextTier = TANK_CLASSES[currentClass.upgradesTo[0]]?.tier || 999;
        const requiredLevel = (nextTier - 1) * 5;

        if (bot.level >= requiredLevel) {
          const randIndex = Math.floor(Math.random() * currentClass.upgradesTo.length);
          const nextClassIndex = currentClass.upgradesTo[randIndex];
          if (!TANK_CLASSES[nextClassIndex]) break;

          this.applyClassChange(bot, nextClassIndex);
          currentClass = TANK_CLASSES[nextClassIndex];
        } else {
          break;
        }
      } else {
        break;
      }
    }

    aiSystem.initBot(bot);
  }

  public spawnFood() {
    // 1. Pick a random position first
    const x = Math.random() * MAP_SIZE;
    const y = Math.random() * MAP_SIZE;

    // 2. Determine Zone based on distance from center
    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;
    const dist = Math.hypot(x - centerX, y - centerY);
    
    let type = EntityType.FOOD_SQUARE;
    let config = ENTITY_CONFIG.FOOD_SQUARE;
    let color = COLORS.food.square;
    const r = Math.random();

    // --- ZONE LOGIC ---
    
    // ZONE 1: THE NEST (Center 0 - 2500)
    // High Risk, High Reward. Mostly Pentagons and Rare Shapes.
    if (dist < 2500) {
        if (r > 0.98) { type = EntityType.FOOD_OMEGA; config = ENTITY_CONFIG.FOOD_OMEGA; color = COLORS.food.omega; }
        else if (r > 0.95) { type = EntityType.FOOD_ALPHA_PENTAGON; config = ENTITY_CONFIG.FOOD_ALPHA_PENTAGON; color = COLORS.food.alpha; }
        else if (r > 0.90) { type = EntityType.FOOD_STAR; config = ENTITY_CONFIG.FOOD_STAR; color = COLORS.food.star; }
        else if (r > 0.85) { type = EntityType.FOOD_NONAGON; config = ENTITY_CONFIG.FOOD_NONAGON; color = COLORS.food.nonagon; }
        else if (r > 0.50) { type = EntityType.FOOD_PENTAGON; config = ENTITY_CONFIG.FOOD_PENTAGON; color = COLORS.food.pentagon; }
        else { type = EntityType.FOOD_TRIANGLE; config = ENTITY_CONFIG.FOOD_TRIANGLE; color = COLORS.food.triangle; }
    } 
    // ZONE 2: MIDDLE GROUNDS (2500 - 7000)
    // Mixed bag. Hexagons, Octagons, Triangles.
    else if (dist < 7000) {
        if (r > 0.99) { type = EntityType.FOOD_ALPHA_PENTAGON; config = ENTITY_CONFIG.FOOD_ALPHA_PENTAGON; color = COLORS.food.alpha; }
        else if (r > 0.96) { type = EntityType.FOOD_OCTAGON; config = ENTITY_CONFIG.FOOD_OCTAGON; color = COLORS.food.octagon; }
        else if (r > 0.92) { type = EntityType.FOOD_HEPTAGON; config = ENTITY_CONFIG.FOOD_HEPTAGON; color = COLORS.food.heptagon; }
        else if (r > 0.85) { type = EntityType.FOOD_HEXAGON; config = ENTITY_CONFIG.FOOD_HEXAGON; color = COLORS.food.hexagon; }
        else if (r > 0.75) { type = EntityType.FOOD_PENTAGON; config = ENTITY_CONFIG.FOOD_PENTAGON; color = COLORS.food.pentagon; }
        else if (r > 0.40) { type = EntityType.FOOD_TRIANGLE; config = ENTITY_CONFIG.FOOD_TRIANGLE; color = COLORS.food.triangle; }
        else { type = EntityType.FOOD_SQUARE; config = ENTITY_CONFIG.FOOD_SQUARE; color = COLORS.food.square; }
    }
    // ZONE 3: OUTER RIM (7000+)
    // Safe for newbies. Mostly Squares and some Triangles.
    else {
        if (r > 0.99) { type = EntityType.FOOD_CROSS; config = ENTITY_CONFIG.FOOD_CROSS; color = COLORS.food.cross; } // Rare loot in outer rim
        else if (r > 0.85) { type = EntityType.FOOD_TRIANGLE; config = ENTITY_CONFIG.FOOD_TRIANGLE; color = COLORS.food.triangle; }
        else { type = EntityType.FOOD_SQUARE; config = ENTITY_CONFIG.FOOD_SQUARE; color = COLORS.food.square; }
    }

    const id = uuidv4();
    const entity = this.createEntity(id, type, x, y, color);

    entity.radius = config.radius;
    entity.health = config.health;
    entity.maxHealth = config.health;
    entity.scoreValue = config.score;
    entity.damage = config.damage;
    entity.stats.bodyDamage = config.damage;
    (entity as any).xpValue = (config as any).xp;
  }

  public attemptShoot(entity: Entity, playerId: string | null, camera: {x: number, y: number}) {
    const tankClass = TANK_CLASSES[entity.classIndex];
    if (!tankClass) return;

    tankClass.barrels.forEach((barrel, i) => {
      if (entity.barrelCooldown[i] > 0) return;

      // Fire
      entity.barrelCooldown[i] = entity.stats.reload * barrel.reloadMultiplier;
      entity.barrelRecoil[i] = barrel.recoil;

      // Physical Recoil
      const recoilForce = RECOIL_FORCE * barrel.recoil * 0.1;
      const barrelAngle = entity.rotation + barrel.angle;
      entity.velocity.x -= Math.cos(barrelAngle) * recoilForce;
      entity.velocity.y -= Math.sin(barrelAngle) * recoilForce;

      // Spawn Bullet
      const totalAngle = entity.rotation + barrel.angle;
      const spread = (Math.random() - 0.5) * barrel.spread;
      const finalAngle = totalAngle + spread;

      const muzzleDist = barrel.length;
      const muzzleX = entity.position.x + Math.cos(totalAngle) * muzzleDist + Math.cos(totalAngle + Math.PI / 2) * barrel.offsetX;
      const muzzleY = entity.position.y + Math.sin(totalAngle) * muzzleDist + Math.sin(totalAngle + Math.PI / 2) * barrel.offsetX;

      const bulletId = uuidv4();
      const bullet = this.createEntity(bulletId, EntityType.BULLET, muzzleX, muzzleY, COLORS.bullet);

      bullet.ownerId = entity.id;
      bullet.velocity.x = Math.cos(finalAngle) * (entity.stats.bulletSpeed * (barrel.bulletSpeed || 1));
      bullet.velocity.y = Math.sin(finalAngle) * (entity.stats.bulletSpeed * (barrel.bulletSpeed || 1));
      bullet.rotation = finalAngle;
      bullet.radius = barrel.width / 2;
      bullet.damage = entity.stats.bulletDamage * barrel.damageMultiplier;

      // Diep.io Logic: Health = Penetration
      bullet.health = entity.stats.bulletPenetration;
      bullet.maxHealth = bullet.health;

      // Colors
      if (entity.id === playerId) bullet.color = COLORS.player;
      else if (entity.type === EntityType.BOSS) bullet.color = COLORS.bossBullet;
      else if (entity.type === EntityType.ENEMY) bullet.color = COLORS.enemy;
      else bullet.color = COLORS.bullet;

      if (entity.id === playerId) {
        soundEngine.playShoot(0);
      } else {
        const dist = Math.hypot(entity.position.x - camera.x, entity.position.y - camera.y);
        if (dist < 1000) soundEngine.playShoot(dist);
      }
    });
  }

  public gainXp(entity: Entity, amount: number, isLocalPlayer: boolean): { leveledUp: boolean } {
    if (entity.level >= LEVEL_XP.length) return { leveledUp: false };
    entity.xp += amount;

    let leveledUp = false;
    while (entity.level < LEVEL_XP.length && entity.xp >= LEVEL_XP[entity.level]) {
      entity.xp -= LEVEL_XP[entity.level];
      entity.level++;
      entity.statPoints++;
      leveledUp = true;
    }

    if (leveledUp) {
      entity.health = entity.maxHealth;
      entity.radius += 0.5;

      if (isLocalPlayer) {
        soundEngine.playLevelUp();
        
        const tankClass = TANK_CLASSES[entity.classIndex];
        if (tankClass && tankClass.upgradesTo) {
             const potentialUpgrades = tankClass.upgradesTo.filter(uIndex => {
                 const uClass = TANK_CLASSES[uIndex];
                 const reqLevel = (uClass.tier - 1) * 5;
                 return entity.level >= reqLevel;
             });
             
             if (potentialUpgrades.length > 0) {
                 useGameStore.getState().setAvailableUpgrades(potentialUpgrades);
             }
        }
      }
    }

    return { leveledUp };
  }

  public applyUpgrade(entity: Entity, statIndex: number, isLocalPlayer: boolean) {
    if (entity.statPoints <= 0 || entity.upgrades[statIndex] >= MAX_STAT_LEVEL) return;
    entity.statPoints--;
    entity.upgrades[statIndex]++;
    this.recalculateStats(entity);
  }

  public applyClassChange(entity: Entity, classIndex: number) {
    if (!TANK_CLASSES[classIndex]) return;

    const currentClass = TANK_CLASSES[entity.classIndex];
    if (entity.classIndex !== 0 && currentClass.upgradesTo && !currentClass.upgradesTo.includes(classIndex)) {
      // Logic constraint
    }

    entity.classIndex = classIndex;
    const newClass = TANK_CLASSES[classIndex];

    entity.barrelRecoil = new Array(newClass.barrels.length).fill(0);
    entity.barrelCooldown = new Array(newClass.barrels.length).fill(0);

    if (newClass.bodyRadius) entity.radius = newClass.bodyRadius;
  }

  public recalculateStats(entity: Entity) {
    const u = entity.upgrades;
    entity.stats.healthRegen = 0.05 + u[0] * 0.1;
    entity.maxHealth = 100 + u[1] * 50;
    entity.stats.bodyDamage = 20 + u[2] * 5;
    entity.stats.bulletSpeed = 12 + u[3] * 3;
    entity.stats.bulletPenetration = 10 + u[4] * 10;
    entity.stats.bulletDamage = 10 + u[5] * 5;
    entity.stats.reload = Math.max(2, 50 - u[6] * 5);
    entity.stats.movementSpeed = 0.5 + u[7] * 0.1;
    entity.health = Math.min(entity.health, entity.maxHealth);
  }
}
