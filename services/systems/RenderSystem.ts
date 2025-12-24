



import { Entity, EntityType } from '../../types';
import { ParticleEngine } from '../ParticleEngine';
import { COLORS, GRID_SIZE, MAP_SIZE, TANK_CLASSES } from '../../constants';
import i18next from 'i18next';
import { useGameStore } from '../../store/gameStore';

export class RenderSystem {
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private camera: { x: number, y: number } = { x: 0, y: 0 };
  private particles: ParticleEngine;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number, particles: ParticleEngine) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.particles = particles;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public updateCamera(target: Entity | null | undefined, shakeIntensity: number) {
    if (target) {
      const targetCamX = target.renderPosition.x;
      const targetCamY = target.renderPosition.y;
      this.camera.x = this.lerp(this.camera.x, targetCamX, 0.1);
      this.camera.y = this.lerp(this.camera.y, targetCamY, 0.1);
    }

    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    return {
        x: this.camera.x - this.width / 2 + shakeX,
        y: this.camera.y - this.height / 2 + shakeY
    };
  }

  public draw(entities: Map<string, Entity>, camX: number, camY: number, alpha: number, playerId: string | null, mode: string, peerMap: Map<string, string>) {
    // Clear
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.drawGrid(camX, camY);

    // Sort Layering: Wall < Food < Bullets < Tanks < Boss
    const renderList = Array.from(entities.values()).sort((a, b) => {
        const getPriority = (type: string) => {
            if (type === EntityType.WALL) return -1;
            if (type.startsWith('FOOD')) return 0;
            if (type === EntityType.BULLET) return 1;
            if (type === EntityType.BOSS) return 3;
            return 2;
        };
        const pA = getPriority(a.type);
        const pB = getPriority(b.type);
        if (pA !== pB) return pA - pB;
        return a.radius - b.radius;
    });

    renderList.forEach(entity => {
      // Don't draw self if dead
      if (entity.isDead && entity.id === playerId) return;

      if (mode !== 'client') {
          entity.renderPosition.x = this.lerp(entity.prevPosition.x, entity.position.x, alpha);
          entity.renderPosition.y = this.lerp(entity.prevPosition.y, entity.position.y, alpha);
      }

      const rDiff = entity.rotation - entity.prevRotation;
      const renderRotation = entity.prevRotation + rDiff * alpha;

      // Culling
      if (entity.renderPosition.x < camX - entity.radius * 2 || entity.renderPosition.x > camX + this.width + entity.radius * 2 ||
          entity.renderPosition.y < camY - entity.radius * 2 || entity.renderPosition.y > camY + this.height + entity.radius * 2) {
          return;
      }
      this.drawEntity(entity, camX, camY, renderRotation, mode, peerMap);
    });

    this.particles.draw(this.ctx, camX, camY);
    this.drawSpectatorOverlay(entities, playerId);
    
    // Draw Minimap on top of everything
    this.drawMinimap(entities, camX, camY, playerId);
  }

  private drawMinimap(entities: Map<string, Entity>, camX: number, camY: number, playerId: string | null) {
      const mapSize = 130;
      const margin = 20;
      const x = this.width - mapSize - margin;
      const y = this.height - mapSize - margin;
      const scale = mapSize / MAP_SIZE;

      this.ctx.save();
      
      // Minimap Background
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      this.ctx.fillRect(x, y, mapSize, mapSize);
      this.ctx.strokeStyle = COLORS.player;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, mapSize, mapSize);

      // Draw Entities
      entities.forEach(entity => {
          if (entity.isDead) return;
          
          const ex = x + entity.renderPosition.x * scale;
          const ey = y + entity.renderPosition.y * scale;

          if (entity.id === playerId) {
              // Local Player (White with ring)
              this.ctx.fillStyle = "#ffffff";
              this.ctx.beginPath();
              this.ctx.arc(ex, ey, 3, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.strokeStyle = "#000";
              this.ctx.lineWidth = 0.5;
              this.ctx.stroke();
          } else if (entity.type === EntityType.BOSS) {
              // Boss (Big Purple Warning)
              this.ctx.fillStyle = COLORS.boss;
              this.ctx.beginPath();
              this.ctx.arc(ex, ey, 6, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.strokeStyle = "#fff";
              this.ctx.lineWidth = 1;
              this.ctx.stroke();
          } else if (entity.type === EntityType.WALL) {
              // Wall (Gray Block)
              this.ctx.fillStyle = "#666";
              const s = Math.max(2, entity.radius * 2 * scale);
              this.ctx.fillRect(ex - s/2, ey - s/2, s, s);
          } else if (entity.type === EntityType.ENEMY) {
              // Enemies (Red Squares)
              this.ctx.fillStyle = COLORS.enemy;
              this.ctx.fillRect(ex - 2, ey - 2, 4, 4);
          } else if (entity.type.startsWith('FOOD_')) {
              // High Tier Food Only
              if (entity.type === EntityType.FOOD_SQUARE || entity.type === EntityType.FOOD_TRIANGLE || entity.type === EntityType.FOOD_PENTAGON) {
                  return; // Skip small food to reduce clutter
              }

              // Calculate size based on entity radius relative to map scale, minimum 2px
              const size = Math.max(2, entity.radius * scale);
              
              this.ctx.fillStyle = entity.color;
              this.ctx.beginPath();
              
              // Draw Rare Food as distinctive shapes or circles
              if (entity.type === EntityType.FOOD_OMEGA || entity.type === EntityType.FOOD_ALPHA_PENTAGON) {
                  this.ctx.arc(ex, ey, size, 0, Math.PI * 2);
              } else {
                  this.ctx.rect(ex - size/2, ey - size/2, size, size);
              }
              
              this.ctx.fill();
          }
      });

      // Viewport Rectangle
      const vx = x + camX * scale;
      const vy = y + camY * scale;
      const vw = this.width * scale;
      const vh = this.height * scale;
      
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.strokeRect(vx, vy, vw, vh);

      this.ctx.restore();
  }

  private drawSpectatorOverlay(entities: Map<string, Entity>, playerId: string | null) {
      const { isDead, spectatingTargetId } = useGameStore.getState();
      if (isDead) {
          const target = spectatingTargetId ? entities.get(spectatingTargetId) : null;
          if (target) {
            this.ctx.save();
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            this.ctx.fillRect(this.width / 2 - 100, this.height - 100, 200, 40);
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 16px Rajdhani";
            this.ctx.textAlign = "center";
            const name = target.type === EntityType.BOSS ? "BOSS" : (target.type === EntityType.ENEMY ? "BOT " + target.id.substring(0,4) : "PLAYER");
            this.ctx.fillText("SPECTATING: " + name, this.width / 2, this.height - 75);
            this.ctx.font = "12px monospace";
            this.ctx.fillStyle = "#aaa";
            this.ctx.fillText("< PREV | NEXT >", this.width / 2, this.height - 60);
            this.ctx.restore();
          }
      }
  }

  private drawGrid(camX: number, camY: number) {
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    const startX = Math.floor(camX / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(camY / GRID_SIZE) * GRID_SIZE;
    
    for (let x = startX; x < camX + this.width; x += GRID_SIZE) {
        this.ctx.moveTo(x - camX, 0);
        this.ctx.lineTo(x - camX, this.height);
    }
    for (let y = startY; y < camY + this.height; y += GRID_SIZE) {
        this.ctx.moveTo(0, y - camY);
        this.ctx.lineTo(this.width, y - camY);
    }
    this.ctx.stroke();

    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 5;
    this.ctx.strokeRect(-camX, -camY, MAP_SIZE, MAP_SIZE);
  }

  private drawEntity(entity: Entity, camX: number, camY: number, rotation: number, mode: string, peerMap: Map<string, string>) {
    const x = entity.renderPosition.x - camX;
    const y = entity.renderPosition.y - camY;

    this.ctx.save();
    this.ctx.translate(x, y);

    if (entity.type === EntityType.WALL) {
        // Draw Wall
        this.ctx.fillStyle = COLORS.wall;
        this.ctx.strokeStyle = COLORS.wallBorder;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = COLORS.wallBorder;
        this.ctx.shadowBlur = 10;
        
        // Walls are squares based on radius (radius is half-width)
        const size = entity.radius * 2;
        this.ctx.fillRect(-entity.radius, -entity.radius, size, size);
        this.ctx.strokeRect(-entity.radius, -entity.radius, size, size);
        
        // Inner detail
        this.ctx.strokeStyle = "rgba(0, 204, 255, 0.2)";
        this.ctx.strokeRect(-entity.radius + 5, -entity.radius + 5, size - 10, size - 10);
        
        this.ctx.restore();
        return;
    }

    if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.BOSS) {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Rajdhani, sans-serif';
        this.ctx.textAlign = 'center';
        
        const tankClass = TANK_CLASSES[entity.classIndex] || TANK_CLASSES[0];
        const tankName = entity.type === EntityType.BOSS ? "GUARDIAN" : (tankClass.name || "Tank");
        const levelText = `Lv ${entity.level} ${tankName}`;
        this.ctx.fillText(levelText, 0, -entity.radius - 15);
        
        if (entity.type === EntityType.ENEMY) this.ctx.fillText(i18next.t('bot_tag'), 0, -entity.radius - 28);
        if (entity.type === EntityType.BOSS) {
             this.ctx.fillStyle = '#ff00ff';
             this.ctx.font = 'bold 14px Orbitron';
             this.ctx.fillText("⚠️ BOSS ⚠️", 0, -entity.radius - 30);
        }
        if (mode === 'host' && peerMap.has(entity.id)) this.ctx.fillText('P2', 0, -entity.radius - 28);
    }

    this.ctx.rotate(rotation);

    // Draw Barrels
    if (entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.BOSS) {
        const tankClass = TANK_CLASSES[entity.classIndex] || TANK_CLASSES[0];
        tankClass.barrels.forEach((barrel, i) => {
             this.ctx.save();
             if (barrel.angle) this.ctx.rotate(barrel.angle);
             const currentRecoil = entity.barrelRecoil[i] || 0;
             const recoilOffset = -currentRecoil;
             this.ctx.fillStyle = '#999999';
             this.ctx.strokeStyle = '#555555';
             this.ctx.lineWidth = 2.5; 
             const bWidth = barrel.width;
             const bLen = barrel.length;
             const bOff = barrel.offsetX; 
             this.ctx.translate(recoilOffset, -bOff); 
             this.ctx.fillRect(0, -bWidth/2, bLen, bWidth);
             this.ctx.strokeRect(0, -bWidth/2, bLen, bWidth);
             this.ctx.restore();
        });
    }

    // Draw Body
    if (entity.hitFlash > 0.1) {
        const f = entity.hitFlash;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${f})`;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${f})`; 
    } else {
        if (entity.type === EntityType.BULLET) {
            this.ctx.fillStyle = entity.color;
        } else {
            const grad = this.ctx.createRadialGradient(-entity.radius * 0.3, -entity.radius * 0.3, entity.radius * 0.1, 0, 0, entity.radius);
            grad.addColorStop(0, entity.color); 
            grad.addColorStop(1, entity.color); 
            this.ctx.fillStyle = grad;
        }
    }

    if (entity.type === EntityType.BULLET) {
        if (entity.hitFlash <= 0.1) this.ctx.fillStyle = entity.color;
        this.ctx.lineWidth = 2.5; 
        this.ctx.strokeStyle = '#222';
        this.ctx.shadowBlur = 0;
    } else {
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#333'; 
        if ((entity.type.startsWith('FOOD') || entity.type === EntityType.BOSS) && entity.hitFlash <= 0.1) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = entity.color;
        } else {
            this.ctx.shadowBlur = 0;
        }
    }

    this.ctx.beginPath();
    this.drawShape(entity.type, entity.radius);
    this.ctx.fill();
    this.ctx.stroke();
    
    if (entity.hitFlash > 0.1) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${entity.hitFlash * 0.5})`;
        this.ctx.fill();
    }
    this.ctx.shadowBlur = 0; 

    // Health Bar
    if (entity.health < entity.maxHealth && entity.type !== EntityType.BULLET) {
         this.ctx.rotate(-rotation); 
         this.ctx.fillStyle = '#333';
         this.ctx.fillRect(-entity.radius, entity.radius + 8, entity.radius * 2, 6);
         this.ctx.fillStyle = COLORS.ui.health;
         this.ctx.fillRect(-entity.radius + 1, entity.radius + 9, (entity.radius * 2 - 2) * (entity.health/entity.maxHealth), 4);
    }

    this.ctx.restore();
  }

  private drawShape(type: EntityType, r: number) {
      switch (type) {
        case EntityType.FOOD_SQUARE: this.ctx.rect(-r, -r, r*2, r*2); break;
        case EntityType.FOOD_TRIANGLE: this.drawPolygon(3, r); break;
        case EntityType.FOOD_PENTAGON: case EntityType.FOOD_ALPHA_PENTAGON: this.drawPolygon(5, r); break;
        case EntityType.FOOD_HEXAGON: this.drawPolygon(6, r); break;
        case EntityType.FOOD_HEPTAGON: this.drawPolygon(7, r); break;
        case EntityType.FOOD_OCTAGON: this.drawPolygon(8, r); break;
        case EntityType.FOOD_NONAGON: this.drawPolygon(9, r); break;
        case EntityType.FOOD_STAR: this.drawStar(5, r, r * 0.5); break;
        case EntityType.FOOD_CROSS: this.drawCross(r); break;
        case EntityType.BOSS: case EntityType.FOOD_OMEGA: this.drawPolygon(20, r); break;
        default: this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      }
  }

  private drawPolygon(sides: number, radius: number) {
      this.ctx.moveTo(radius, 0);
      for (let i = 1; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides;
          this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      this.ctx.closePath();
  }

  private drawStar(points: number, outer: number, inner: number) {
      this.ctx.moveTo(outer, 0);
      for (let i = 0; i < points * 2; i++) {
          const radius = (i % 2 === 0) ? outer : inner;
          const angle = (i * Math.PI) / points;
          this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      this.ctx.closePath();
  }

  private drawCross(r: number) {
      const w = r * 0.4;
      this.ctx.moveTo(-w, -r);
      this.ctx.lineTo(w, -r);
      this.ctx.lineTo(w, -w);
      this.ctx.lineTo(r, -w);
      this.ctx.lineTo(r, w);
      this.ctx.lineTo(w, w);
      this.ctx.lineTo(w, r);
      this.ctx.lineTo(-w, r);
      this.ctx.lineTo(-w, w);
      this.ctx.lineTo(-r, w);
      this.ctx.lineTo(-r, -w);
      this.ctx.lineTo(-w, -w);
      this.ctx.closePath();
  }

  private lerp(start: number, end: number, alpha: number): number {
    return start * (1 - alpha) + end * alpha;
  }
}
