

import b3 from 'behavior3js';
import { Entity, EntityType } from '../types';
import { MAP_SIZE } from '../constants';
import { clamp } from 'lodash-es'; // Shorter code

// --- Custom Conditions ---

class IsLowHealth extends b3.Condition {
  constructor() { super({ name: 'IsLowHealth' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    // Boss only flees at extremely low health or never
    const threshold = entity.type === EntityType.BOSS ? 0.05 : 0.3;
    return (entity.health / entity.maxHealth < threshold) ? b3.SUCCESS : b3.FAILURE;
  }
}

class HasTarget extends b3.Condition {
  constructor() { super({ name: 'HasTarget' }); }
  tick(tick: any) {
    const targetId = tick.blackboard.get('targetId', tick.tree.id, tick.target.id);
    const engine = tick.blackboard.get('engine');
    const target = engine.entities.get(targetId);
    
    if (target && !target.isDead) {
      const entity = tick.target as Entity;
      const dist = Math.hypot(target.position.x - entity.position.x, target.position.y - entity.position.y);
      
      // Boss has infinite aggro range once locked, normal bots loose interest
      const maxRange = entity.type === EntityType.BOSS ? 3000 : 1200;

      if (dist > maxRange) {
        tick.blackboard.set('targetId', null, tick.tree.id, tick.target.id);
        return b3.FAILURE;
      }
      return b3.SUCCESS;
    }
    
    tick.blackboard.set('targetId', null, tick.tree.id, tick.target.id);
    return b3.FAILURE;
  }
}

// --- Custom Actions ---

class FindTarget extends b3.Action {
  constructor() { super({ name: 'FindTarget' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    const engine = tick.blackboard.get('engine');
    
    let closestTarget = null;
    let minDist = Infinity;
    const scanRange = entity.type === EntityType.BOSS ? 3000 : 1000;

    // Scan entities optimized
    for (const [id, other] of engine.entities) {
      if (id === entity.id || other.isDead || other.type === EntityType.BULLET) continue;
      // Bosses don't attack other bosses or bots, only players or food if desperate
      if (entity.type === EntityType.BOSS && other.type !== EntityType.PLAYER) continue;

      const dist = Math.hypot(other.position.x - entity.position.x, other.position.y - entity.position.y);
      if (dist > scanRange) continue;

      let score = dist;
      if (other.type === EntityType.PLAYER || other.type === EntityType.ENEMY) score -= 400; 
      else if (other.type === EntityType.FOOD_PENTAGON) score -= 200;

      if (score < minDist) {
        minDist = score;
        closestTarget = other;
      }
    }

    if (closestTarget) {
      tick.blackboard.set('targetId', closestTarget.id, tick.tree.id, tick.target.id);
      return b3.SUCCESS;
    }
    return b3.FAILURE;
  }
}

class MoveToTarget extends b3.Action {
  constructor() { super({ name: 'MoveToTarget' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    const targetId = tick.blackboard.get('targetId', tick.tree.id, tick.target.id);
    const engine = tick.blackboard.get('engine');
    const target = engine.entities.get(targetId);

    if (!target) return b3.FAILURE;

    const dx = target.position.x - entity.position.x;
    const dy = target.position.y - entity.position.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);

    entity.rotation = angle;
    const moveSpeed = entity.stats.movementSpeed;
    
    // Boss moves directly, others strafe
    if (entity.type !== EntityType.BOSS && (target.type === EntityType.PLAYER || target.type === EntityType.ENEMY) && dist < 300) {
        const strafeAngle = angle + Math.PI / 2;
        entity.velocity.x += Math.cos(strafeAngle) * moveSpeed * 0.8;
        entity.velocity.y += Math.sin(strafeAngle) * moveSpeed * 0.8;
    } else {
        entity.velocity.x += Math.cos(angle) * moveSpeed;
        entity.velocity.y += Math.sin(angle) * moveSpeed;
    }

    return b3.SUCCESS;
  }
}

class Shoot extends b3.Action {
  constructor() { super({ name: 'Shoot' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    const engine = tick.blackboard.get('engine');
    engine.attemptShoot(entity);
    return b3.SUCCESS;
  }
}

class Flee extends b3.Action {
  constructor() { super({ name: 'Flee' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    const engine = tick.blackboard.get('engine');
    
    let threat = null;
    let minDistSq = Infinity;

    for (const [id, other] of engine.entities) {
        if (id === entity.id) continue;
        if (other.type === EntityType.PLAYER || other.type === EntityType.ENEMY) {
            const dSq = Math.pow(other.position.x - entity.position.x, 2) + Math.pow(other.position.y - entity.position.y, 2);
            if (dSq < minDistSq) {
                minDistSq = dSq;
                threat = other;
            }
        }
    }

    if (threat && minDistSq < 360000) { // 600^2
        const angle = Math.atan2(threat.position.y - entity.position.y, threat.position.x - entity.position.x);
        const fleeAngle = angle + Math.PI; 
        
        entity.rotation = angle; 
        entity.velocity.x += Math.cos(fleeAngle) * entity.stats.movementSpeed;
        entity.velocity.y += Math.sin(fleeAngle) * entity.stats.movementSpeed;
        
        engine.attemptShoot(entity);
        return b3.RUNNING;
    }

    return b3.FAILURE;
  }
}

class Wander extends b3.Action {
  constructor() { super({ name: 'Wander' }); }
  tick(tick: any) {
    const entity = tick.target as Entity;
    if (Math.random() < 0.05) {
       tick.blackboard.set('wanderAngle', Math.random() * Math.PI * 2, tick.tree.id, tick.target.id);
    }
    
    const angle = tick.blackboard.get('wanderAngle', tick.tree.id, tick.target.id) || 0;
    entity.velocity.x += Math.cos(angle) * entity.stats.movementSpeed * 0.5;
    entity.velocity.y += Math.sin(angle) * entity.stats.movementSpeed * 0.5;
    entity.rotation = angle;
    
    // Boundary check automated with clamp
    if (entity.position.x < 100 || entity.position.x > MAP_SIZE - 100 || entity.position.y < 100 || entity.position.y > MAP_SIZE - 100) {
         const centerAngle = Math.atan2(MAP_SIZE/2 - entity.position.y, MAP_SIZE/2 - entity.position.x);
         tick.blackboard.set('wanderAngle', centerAngle, tick.tree.id, tick.target.id);
    }

    return b3.RUNNING;
  }
}

export class BotAI {
  private tree: b3.BehaviorTree;
  private blackboard: b3.Blackboard;

  constructor(engine: any) {
    this.blackboard = new b3.Blackboard();
    this.blackboard.set('engine', engine);

    this.tree = new b3.BehaviorTree();
    this.tree.root = new b3.Priority({
        children: [
            new b3.Sequence({ children: [ new IsLowHealth(), new Flee() ] }),
            new b3.Sequence({ children: [ new b3.Priority({ children: [ new HasTarget(), new FindTarget() ] }), new MoveToTarget(), new Shoot() ] }),
            new Wander()
        ]
    });
  }

  public initBot(entity: Entity) {}

  public update(entity: Entity) {
      this.tree.tick(entity, this.blackboard);
  }
}
