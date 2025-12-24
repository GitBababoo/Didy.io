import { Entity, EntityType } from '../../types';
import { SpatialHash } from '../SpatialHash';
import { ParticleEngine } from '../ParticleEngine';
import { MAP_SIZE, FRICTION } from '../../constants';
import { clamp } from 'lodash-es';
import { soundEngine } from '../SoundEngine';
import { EntityManager } from './EntityManager';

export class PhysicsSystem {
  private entities: Map<string, Entity>;
  private spatialHash: SpatialHash;
  private particles: ParticleEngine;
  private entityManager: EntityManager;

  constructor(entities: Map<string, Entity>, spatialHash: SpatialHash, particles: ParticleEngine, entityManager: EntityManager) {
    this.entities = entities;
    this.spatialHash = spatialHash;
    this.particles = particles;
    this.entityManager = entityManager;
  }

  public update(dt: number, camera: {x: number, y: number}, isRunning: boolean, playerId: string | null): { died: string[], score: number } {
    this.spatialHash.clear();
    const died: string[] = [];
    let addedScore = 0;

    // 1. Prepare Spatial Hash & Basic Physics
    this.entities.forEach(entity => {
      // Walls don't move
      if (entity.type === EntityType.WALL) {
          this.spatialHash.insert(entity);
          return;
      }

      entity.prevPosition.x = entity.position.x;
      entity.prevPosition.y = entity.position.y;
      entity.prevRotation = entity.rotation;

      if (entity.hitFlash > 0) entity.hitFlash *= 0.8;

      this.spatialHash.insert(entity);
    });

    // 2. Resolve Collisions & Logic
    this.entities.forEach(entity => {
       if (entity.type === EntityType.WALL) return; // Walls are static

       // Movement & Friction
       entity.position.x += entity.velocity.x;
       entity.position.y += entity.velocity.y;

       // Bullet Friction Fix (No Friction for bullets)
       if ((entity.type as EntityType) !== EntityType.BULLET) {
           // Boss has high friction (doesn't drift)
           const friction = entity.type === EntityType.BOSS ? 0.8 : FRICTION;
           entity.velocity.x *= friction;
           entity.velocity.y *= friction;
       }

       entity.position.x = clamp(entity.position.x, 0, MAP_SIZE);
       entity.position.y = clamp(entity.position.y, 0, MAP_SIZE);

       // Wall Bounce
       if ((entity.position.x <= 0 || entity.position.x >= MAP_SIZE) && (entity.type as EntityType) !== EntityType.BULLET) entity.velocity.x *= -1;
       if ((entity.position.y <= 0 || entity.position.y >= MAP_SIZE) && (entity.type as EntityType) !== EntityType.BULLET) entity.velocity.y *= -1;

       // Bullet Life
       if ((entity.type as EntityType) === EntityType.BULLET) {
           if (entity.position.x < -100 || entity.position.x > MAP_SIZE + 100 ||
               entity.position.y < -100 || entity.position.y > MAP_SIZE + 100) {
               entity.health = 0;
           }
           entity.health -= 0.01;
       }

       // Collision Check
       const potentialCollisions = this.spatialHash.query(entity);
       for (const otherId of potentialCollisions) {
           if (entity.id === otherId) continue; // Don't check self
           
           // Optimization: Only check A vs B once, but Wall logic requires checking if entity is active
           // Since walls are static, we iterate entities. If entity meets wall, we resolve.
           
           const other = this.entities.get(otherId);
           if (!other) continue;

           if ((entity.type as EntityType) === EntityType.BULLET && entity.ownerId === other.id) continue;
           if ((other.type as EntityType) === EntityType.BULLET && other.ownerId === entity.id) continue;

           if (entity.isDead || other.isDead) continue;

           // --- WALL COLLISION LOGIC ---
           if (other.type === EntityType.WALL) {
               this.resolveWallCollision(entity, other);
               continue;
           }
           
           // Only resolve Entity-Entity if id < otherId to avoid double check, 
           // BUT if one is bullet, we need to process it. Standard is usually unique pairs.
           if (entity.id >= otherId) continue;
           
           const dx = entity.position.x - other.position.x;
           const dy = entity.position.y - other.position.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           const minDist = entity.radius + other.radius;

           if (dist < minDist) {
               this.resolveCollision(entity, other, dist, dx, dy, camera);
           }
       }

       // Death Handling
       if (entity.health <= 0 && !entity.isDead) {
           entity.isDead = true;
           this.particles.spawn(entity.position.x, entity.position.y, entity.color, Math.floor(entity.radius));
           
           const distToCam = Math.hypot(entity.position.x - camera.x, entity.position.y - camera.y);
           // Louder explosion for boss
           const scale = entity.type === EntityType.BOSS ? 5 : (entity.radius / 25);
           soundEngine.playExplosion(distToCam, scale);

           // XP Attribution
           if ((entity as any).lastHitBy) {
               const killer = this.entities.get((entity as any).lastHitBy);
               if (killer && (killer.type === EntityType.PLAYER || killer.type === EntityType.ENEMY)) {
                   const xpGain = (entity as any).xpValue || (entity.scoreValue * 0.5);
                   const isLocal = killer.id === playerId;
                   const result = this.entityManager.gainXp(killer, xpGain, isLocal);
                   
                   if (isLocal) addedScore += entity.scoreValue;
               }
           }

           // Always add to died list so Engine can clean it up and trigger UI state
           died.push(entity.id);
       }
    });

    return { died, score: addedScore };
  }

  // Circle vs Rectangle (Square) Collision
  private resolveWallCollision(entity: Entity, wall: Entity) {
      // Find the closest point on the square wall to the circle center
      // Walls are centered at wall.position with width = wall.radius * 2
      const halfSize = wall.radius;
      const wallMinX = wall.position.x - halfSize;
      const wallMaxX = wall.position.x + halfSize;
      const wallMinY = wall.position.y - halfSize;
      const wallMaxY = wall.position.y + halfSize;

      // Closest Point on AABB to Circle Center
      const closestX = clamp(entity.position.x, wallMinX, wallMaxX);
      const closestY = clamp(entity.position.y, wallMinY, wallMaxY);

      // Distance from closest point to center
      const dx = entity.position.x - closestX;
      const dy = entity.position.y - closestY;
      const distSq = dx * dx + dy * dy;

      // Collision detected
      if (distSq < (entity.radius * entity.radius)) {
          // If Bullet -> Destroy instantly
          if (entity.type === EntityType.BULLET) {
              entity.health = 0;
              return;
          }

          const dist = Math.sqrt(distSq);
          
          // Penetration depth
          const overlap = entity.radius - dist;

          // Normal direction
          let nx = dx / dist;
          let ny = dy / dist;

          // Fallback if center is exactly inside (dist is 0)
          if (dist === 0) {
              const dx1 = entity.position.x - wallMinX;
              const dx2 = wallMaxX - entity.position.x;
              const dy1 = entity.position.y - wallMinY;
              const dy2 = wallMaxY - entity.position.y;
              const minOverlap = Math.min(dx1, dx2, dy1, dy2);
              
              if (minOverlap === dx1) nx = 1;
              else if (minOverlap === dx2) nx = -1;
              else if (minOverlap === dy1) ny = 1;
              else ny = -1;
          }

          // Push entity out
          entity.position.x += nx * overlap;
          entity.position.y += ny * overlap;
          
          // Reflect velocity slightly (bounce) or kill it
          // Simple slide
          /*
          const dot = entity.velocity.x * nx + entity.velocity.y * ny;
          entity.velocity.x -= 1.2 * dot * nx; // Bounce
          entity.velocity.y -= 1.2 * dot * ny;
          */
      }
  }

  private resolveCollision(entity: Entity, other: Entity, dist: number, dx: number, dy: number, camera: {x: number, y: number}) {
      const overlap = (entity.radius + other.radius - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;

      // Soft Push (except bullets)
      if (entity.type !== EntityType.BULLET && other.type !== EntityType.BULLET) {
          const force = 0.5;
          
          // Boss Physics (Infinite Mass vs normal)
          if (entity.type === EntityType.BOSS && other.type !== EntityType.BOSS) {
               // Boss pushes other, boss doesn't move
               other.position.x -= nx * overlap * 2;
               other.position.y -= ny * overlap * 2;
          } else if (other.type === EntityType.BOSS && entity.type !== EntityType.BOSS) {
               // Other pushes entity, boss doesn't move
               entity.position.x += nx * overlap * 2;
               entity.position.y += ny * overlap * 2;
          } else {
               // Normal collision
               entity.position.x += nx * overlap * force;
               entity.position.y += ny * overlap * force;
               other.position.x -= nx * overlap * force;
               other.position.y -= ny * overlap * force;
          }
      }

      // Damage & Effects
      if (entity.type === EntityType.BULLET) {
          this.handleHit(entity, other, camera);
          if (other.type !== EntityType.BULLET) {
              // Boss barely moves from bullets
              const pushFactor = other.type === EntityType.BOSS ? 0.01 : 0.5;
              other.velocity.x -= nx * pushFactor;
              other.velocity.y -= ny * pushFactor;
          }
      } else if (other.type === EntityType.BULLET) {
          this.handleHit(other, entity, camera);
          const pushFactor = entity.type === EntityType.BOSS ? 0.01 : 0.5;
          entity.velocity.x += nx * pushFactor;
          entity.velocity.y += ny * pushFactor;
      } else {
          // Body vs Body
          entity.health -= other.stats.bodyDamage * 0.1;
          other.health -= entity.stats.bodyDamage * 0.1;
          entity.hitFlash = 1.0;
          other.hitFlash = 1.0;
          (entity as any).lastHitBy = other.id;
          (other as any).lastHitBy = entity.id;
      }
  }

  private handleHit(bullet: Entity, victim: Entity, camera: {x: number, y: number}) {
      victim.health -= bullet.damage;
      bullet.health -= victim.damage;

      victim.hitFlash = 1.0;
      bullet.hitFlash = 1.0;
      (victim as any).lastHitBy = bullet.ownerId;

      const hitDist = Math.hypot(bullet.position.x - camera.x, bullet.position.y - camera.y);
      soundEngine.playHit(hitDist);
      this.particles.spawn(bullet.position.x, bullet.position.y, bullet.color, 3);
  }
}
