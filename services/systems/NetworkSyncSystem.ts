
import { Entity, PlayerStats, EntityType } from '../../types';
import { network } from '../Network';
import { TANK_CLASSES } from '../../constants';

export class NetworkSyncSystem {
  
  public broadcastState(entities: Map<string, Entity>) {
      const entitiesData: any[] = [];
      entities.forEach(e => {
          entitiesData.push({
              id: e.id, type: e.type,
              x: Math.round(e.position.x), y: Math.round(e.position.y),
              r: parseFloat(e.rotation.toFixed(2)),
              h: Math.round(e.health), hm: Math.round(e.maxHealth),
              c: e.color, rad: e.radius, l: e.level,
              ci: e.classIndex,
              hf: e.hitFlash > 0.1 ? 1 : 0
          });
      });
      network.broadcast({ type: 'STATE', state: { entities: entitiesData } });
  }

  public handleServerState(state: any, entities: Map<string, Entity>) {
      const serverIds = new Set<string>();
      state.entities.forEach((data: any) => {
          serverIds.add(data.id);
          let entity = entities.get(data.id);
          if (!entity) {
              const baseStats: PlayerStats = { healthMax: 100, healthRegen: 0, bodyDamage: 0, bulletSpeed: 0, bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0 };
              entity = {
                  id: data.id, type: data.type,
                  position: { x: data.x, y: data.y }, velocity: { x: 0, y: 0 }, rotation: data.r,
                  prevPosition: { x: data.x, y: data.y }, renderPosition: { x: data.x, y: data.y }, prevRotation: data.r,
                  radius: data.rad, health: data.h, maxHealth: data.hm,
                  color: data.c, scoreValue: 0, isDead: false, damage: 0,
                  xp: 0, level: data.l || 1, classIndex: data.ci || 0,
                  hitFlash: data.hf || 0,
                  stats: baseStats, statPoints: 0, upgrades: [], barrelRecoil: [], barrelCooldown: []
              };
              // Init visual barrels
              const tankClass = TANK_CLASSES[entity.classIndex];
              if (tankClass) {
                  entity.barrelRecoil = new Array(tankClass.barrels.length).fill(0);
                  entity.barrelCooldown = new Array(tankClass.barrels.length).fill(0);
              }
              entities.set(data.id, entity);
          } else {
              entity.position.x = data.x;
              entity.position.y = data.y;
              entity.rotation = data.r;
              entity.health = data.h;
              entity.maxHealth = data.hm;
              entity.level = data.l || entity.level;
              entity.hitFlash = data.hf || 0;
              
              if (entity.classIndex !== data.ci) {
                  entity.classIndex = data.ci || 0;
                  const tankClass = TANK_CLASSES[entity.classIndex];
                  if (tankClass) {
                    entity.barrelRecoil = new Array(tankClass.barrels.length).fill(0);
                    entity.barrelCooldown = new Array(tankClass.barrels.length).fill(0);
                  }
              }
          }
      });
      for (const [id] of entities) {
          if (!serverIds.has(id)) entities.delete(id);
      }
  }

  public clientInterpolate(entities: Map<string, Entity>) {
      entities.forEach(e => {
          e.renderPosition.x += (e.position.x - e.renderPosition.x) * 0.2;
          e.renderPosition.y += (e.position.y - e.renderPosition.y) * 0.2;
          let diff = e.rotation - e.prevRotation;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          e.prevRotation += diff * 0.2;

          for(let i=0; i<e.barrelRecoil.length; i++) {
              if (e.barrelRecoil[i] > 0) e.barrelRecoil[i] *= 0.8;
          }
          if (e.hitFlash > 0) e.hitFlash *= 0.8;
      });
  }
}
