import { Particle } from '../types';

export class ParticleEngine {
  private pool: Particle[];
  private poolSize: number;
  private activeCount: number;

  constructor(size: number = 500) {
    this.poolSize = size;
    this.activeCount = 0;
    this.pool = [];

    // Pre-allocate memory
    for (let i = 0; i < size; i++) {
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, size: 0,
        color: '#fff', active: false
      });
    }
  }

  spawn(x: number, y: number, color: string, count: number = 5) {
    let spawned = 0;
    for (let i = 0; i < this.poolSize; i++) {
      if (spawned >= count) break;
      
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.maxLife = Math.random() * 20 + 20;
        p.life = p.maxLife;
        p.size = Math.random() * 3 + 2;
        p.color = color;
        spawned++;
      }
    }
  }

  update() {
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (p.active) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9; // Friction
        p.vy *= 0.9;
        p.life--;
        p.size *= 0.95; // Shrink

        if (p.life <= 0 || p.size < 0.5) {
          p.active = false;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    ctx.save();
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.pool[i];
      if (p.active) {
        const screenX = p.x - cameraX;
        const screenY = p.y - cameraY;
        
        // Simple optimization: don't draw if off screen
        if (screenX < -10 || screenX > ctx.canvas.width + 10 || 
            screenY < -10 || screenY > ctx.canvas.height + 10) continue;

        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}