import { Entity, EntityType, PlayerInput, Vector2 } from '../types';
import { MAP_SIZE, MAX_STAT_LEVEL } from '../constants';

export class AutomationSystem {
  // Priority: Bullet Pen -> Bullet Dmg -> Reload -> Bullet Spd -> Health -> Regen -> Body -> Move
  // This is a "Glass Cannon" build optimization
  private upgradePriority = [4, 5, 6, 3, 1, 0, 2, 7]; 
  private lastStatUpdate = 0;

  public compute(player: Entity, entities: Map<string, Entity>): PlayerInput {
    const input: PlayerInput = {
      up: false, down: false, left: false, right: false,
      shoot: false, autoFire: true, autoSpin: false, autoPilot: true, autoLevel: false,
      mouseX: 0, mouseY: 0,
      moveVector: { x: 0, y: 0 },
      aimVector: { x: 0, y: 0 }
    };

    // 1. Scan Environment
    let threats: Entity[] = [];
    let targets: Entity[] = [];
    let food: Entity[] = [];

    entities.forEach(e => {
      if (e.id === player.id || e.isDead) return;
      const dist = Math.hypot(e.position.x - player.position.x, e.position.y - player.position.y);
      if (dist > 1500) return; // Ignore far entities

      if (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY) {
          threats.push(e);
          targets.push(e);
      } else if (e.type === EntityType.BULLET && e.ownerId !== player.id) {
          // Bullet dodging could be added here
          if (dist < 300) threats.push(e);
      } else if (e.type.startsWith('FOOD')) {
          food.push(e);
      }
    });

    // 2. Determine State
    const isLowHealth = player.health / player.maxHealth < 0.4;
    const nearbyThreat = threats.some(t => Math.hypot(t.position.x - player.position.x, t.position.y - player.position.y) < 600);

    // 3. Movement Logic
    let moveVec: Vector2 = { x: 0, y: 0 };

    if (isLowHealth && nearbyThreat) {
        // Flee: Sum vectors away from threats
        threats.forEach(t => {
            const dx = player.position.x - t.position.x;
            const dy = player.position.y - t.position.y;
            const dist = Math.hypot(dx, dy);
            moveVec.x += (dx / dist) * 2;
            moveVec.y += (dy / dist) * 2;
        });
        input.shoot = true; // Return fire
    } else {
        // Attack / Farm
        let primaryTarget: Entity | null = null;
        
        // Prioritize Enemies if healthy
        if (targets.length > 0) {
             primaryTarget = targets.reduce((prev, curr) => {
                 const dPrev = Math.hypot(prev.position.x - player.position.x, prev.position.y - player.position.y);
                 const dCurr = Math.hypot(curr.position.x - player.position.x, curr.position.y - player.position.y);
                 return dCurr < dPrev ? curr : prev;
             });
        } 
        // Else Farm highest value food
        else if (food.length > 0) {
             primaryTarget = food.reduce((prev, curr) => {
                 const dPrev = Math.hypot(prev.position.x - player.position.x, prev.position.y - player.position.y);
                 const dCurr = Math.hypot(curr.position.x - player.position.x, curr.position.y - player.position.y);
                 
                 // Weight score value
                 const vPrev = (prev.scoreValue || 10) / (dPrev + 1);
                 const vCurr = (curr.scoreValue || 10) / (dCurr + 1);
                 
                 return vCurr > vPrev ? curr : prev;
             });
        }

        if (primaryTarget) {
            const dx = primaryTarget.position.x - player.position.x;
            const dy = primaryTarget.position.y - player.position.y;
            const dist = Math.hypot(dx, dy);

            // Aim
            input.aimVector = { x: dx/dist, y: dy/dist };
            input.shoot = true;

            // Move
            if (primaryTarget.type === EntityType.PLAYER || primaryTarget.type === EntityType.ENEMY) {
                // Strafe / Kite at optimal distance (~400)
                if (dist < 300) {
                    // Back up
                    moveVec.x = -(dx/dist);
                    moveVec.y = -(dy/dist);
                } else if (dist > 500) {
                    // Close in
                    moveVec.x = (dx/dist);
                    moveVec.y = (dy/dist);
                } else {
                    // Orbit (perpendicular)
                    moveVec.x = -(dy/dist);
                    moveVec.y = (dx/dist);
                }
            } else {
                // Go to food
                if (dist > 100) {
                    moveVec.x = dx/dist;
                    moveVec.y = dy/dist;
                }
            }
        }
    }

    // Boundary Avoidance
    if (player.position.x < 100) moveVec.x += 1;
    if (player.position.x > MAP_SIZE - 100) moveVec.x -= 1;
    if (player.position.y < 100) moveVec.y += 1;
    if (player.position.y > MAP_SIZE - 100) moveVec.y -= 1;

    // Normalize Move Vector
    const mLen = Math.hypot(moveVec.x, moveVec.y);
    if (mLen > 0) {
        input.moveVector = { x: moveVec.x / mLen, y: moveVec.y / mLen };
    }

    return input;
  }

  public getNextUpgrade(currentUpgrades: number[], availablePoints: number): number | -1 {
      if (availablePoints <= 0) return -1;
      
      const now = Date.now();
      if (now - this.lastStatUpdate < 200) return -1; // Throttle upgrades

      for (const statIndex of this.upgradePriority) {
          if (currentUpgrades[statIndex] < MAX_STAT_LEVEL) {
              this.lastStatUpdate = now;
              return statIndex;
          }
      }
      return -1;
  }
}