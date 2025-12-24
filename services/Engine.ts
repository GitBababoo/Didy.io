



import { Entity, EntityType, PlayerInput, Vector2 } from '../types';
import { SpatialHash } from './SpatialHash';
import { ParticleEngine } from './ParticleEngine';
import { BotAI } from './BotAI';
import { AutomationSystem } from './AutomationSystem';
import { LEVEL_XP, TANK_CLASSES, MAP_SIZE } from '../constants';
import { network } from './Network';
import { useGameStore } from '../store/gameStore'; 
import { soundEngine } from './SoundEngine'; 

// Sub-systems
import { EntityManager } from './systems/EntityManager';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { RenderSystem } from './systems/RenderSystem';
import { NetworkSyncSystem } from './systems/NetworkSyncSystem';

export class Engine {
  public entities: Map<string, Entity>;
  public input: PlayerInput;
  
  // Systems
  private entityManager: EntityManager;
  private physicsSystem: PhysicsSystem;
  private renderSystem: RenderSystem;
  private networkSystem: NetworkSyncSystem;
  
  // Helpers
  private spatialHash: SpatialHash;
  private particles: ParticleEngine;
  private aiSystem: BotAI;
  private automationSystem: AutomationSystem;
  
  // State
  private playerId: string | null = null;
  private canvas: HTMLCanvasElement;
  private width: number = 0;
  private height: number = 0;
  private camera: { x: number, y: number } = { x: 0, y: 0 };
  private score: number = 0;
  private startTime: number = 0;
  
  private lastFrameTimeMs: number = 0;
  private timeStep: number = 1000 / 60;
  private delta: number = 0;
  private lastHudUpdate: number = 0; 
  private lastNetworkUpdate: number = 0;
  private lastBossSpawnTime: number = 0;

  private isRunning: boolean = false;
  private rafId: number = 0;
  private shakeIntensity: number = 0;

  private mode: 'solo' | 'host' | 'client' = 'solo';
  private remoteInputs: Map<string, PlayerInput> = new Map();
  private peerMap: Map<string, string> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.entities = new Map();
    this.spatialHash = new SpatialHash();
    this.particles = new ParticleEngine();
    
    // Initialize Systems
    this.entityManager = new EntityManager(this.entities);
    this.physicsSystem = new PhysicsSystem(this.entities, this.spatialHash, this.particles, this.entityManager);
    
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.renderSystem = new RenderSystem(ctx, window.innerWidth, window.innerHeight, this.particles);
    
    this.networkSystem = new NetworkSyncSystem();
    
    this.aiSystem = new BotAI(this);
    this.automationSystem = new AutomationSystem();
    
    this.input = { 
        up: false, down: false, left: false, right: false, 
        shoot: false, autoFire: false, autoSpin: false, autoPilot: false, autoLevel: false,
        mouseX: 0, mouseY: 0,
        moveVector: { x: 0, y: 0 },
        aimVector: { x: 0, y: 0 }
    };
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.renderSystem.resize(this.width, this.height);
  }

  public setInput(input: PlayerInput) {
    this.input = input;
  }

  // Used by BotAI to shoot (Facade)
  public attemptShoot(entity: Entity) {
      this.entityManager.attemptShoot(entity, this.playerId, this.camera);
  }

  public start(nickname: string, mode: 'solo' | 'host' | 'client' = 'solo') {
    if (this.isRunning) {
        this.stop();
    }
    
    this.isRunning = true;
    this.mode = mode;
    this.score = 0;
    this.startTime = Date.now();
    this.lastBossSpawnTime = Date.now();
    this.entityManager.clear();
    
    if (mode !== 'client') {
        this.initWorld();
        this.playerId = this.entityManager.spawnPlayer(nickname, undefined, null); // Local player
        // Set local player ID in EntityManager (hacky but needed for sound)
    }

    if (mode === 'host') {
        network.onPeerConnect((peerId) => {
            console.log("Host: Peer connected, spawning player", peerId);
            const entityId = this.entityManager.spawnPlayer("GUEST", peerId, this.playerId); 
            this.peerMap.set(peerId, entityId);
            network.broadcast({ type: 'WELCOME', peerId, entityId });
        });

        network.onData((msg: any) => {
            if (msg.data?.type === 'INPUT' && msg.sender) {
                this.remoteInputs.set(msg.sender, msg.data.input);
            }
            if (msg.data?.type === 'ACTION' && msg.sender) {
                this.handleRemoteAction(msg.sender, msg.data.action);
            }
            if (msg.type === 'DISCONNECT' && msg.sender) {
                const eid = this.peerMap.get(msg.sender);
                if (eid) {
                    this.entities.delete(eid);
                    this.peerMap.delete(msg.sender);
                }
            }
        });
    }

    if (mode === 'client') {
        network.onData((msg: any) => {
            if (msg.type === 'WELCOME' && msg.peerId === network.myPeerId) {
                this.playerId = msg.entityId;
                soundEngine.playSpawn(); 
            }
            if (msg.type === 'STATE') {
                this.networkSystem.handleServerState(msg.state, this.entities);
            }
        });
    }

    this.lastFrameTimeMs = performance.now();
    this.delta = 0;
    
    this.rafId = requestAnimationFrame(this.loop);
  }

  public stop() {
    this.isRunning = false;
    soundEngine.stop(); 
    cancelAnimationFrame(this.rafId);
    network.close();
  }

  public getDuration(): number {
      return Date.now() - this.startTime;
  }

  public cycleSpectatorTarget(direction: 1 | -1) {
      const candidates = Array.from(this.entities.values()).filter(e => 
          (e.type === EntityType.PLAYER || e.type === EntityType.ENEMY || e.type === EntityType.BOSS) && !e.isDead
      );
      
      if (candidates.length === 0) return;

      const currentId = useGameStore.getState().spectatingTargetId;
      let currentIndex = candidates.findIndex(e => e.id === currentId);
      
      if (currentIndex === -1) currentIndex = 0;
      else {
          currentIndex += direction;
          if (currentIndex >= candidates.length) currentIndex = 0;
          if (currentIndex < 0) currentIndex = candidates.length - 1;
      }
      
      const nextTarget = candidates[currentIndex];
      if (nextTarget) {
          useGameStore.getState().setSpectatingTarget(nextTarget.id);
      }
  }

  private handleRemoteAction(peerId: string, action: any) {
      if (action.type === 'UPGRADE') {
          const entityId = this.peerMap.get(peerId);
          if (entityId) {
              const entity = this.entities.get(entityId);
              if (entity) this.entityManager.applyUpgrade(entity, action.statIndex, false);
          }
      }
  }

  public upgradeStat(statIndex: number) {
      if (!this.playerId) return;
      if (this.mode === 'client') {
          network.sendAction({ type: 'UPGRADE', statIndex });
          return;
      }
      const player = this.entities.get(this.playerId);
      if (player) {
          this.entityManager.applyUpgrade(player, statIndex, true);
          this.syncHud(player);
      }
  }

  public upgradeClass(classIndex: number) {
      if (!this.playerId) return;
      const player = this.entities.get(this.playerId);
      if (player) {
          this.entityManager.applyClassChange(player, classIndex);
          if (player.id === this.playerId) {
             useGameStore.getState().setAvailableUpgrades([]);
             this.syncHud(player);
          }
      }
  }

  private initWorld() {
    // Generate Walls (Grid Maze Style)
    const wallSize = 100; // Radius 50
    const spacing = 2000;
    
    // Create a scattered maze pattern
    for (let x = 1000; x < MAP_SIZE; x += spacing) {
        for (let y = 1000; y < MAP_SIZE; y += spacing) {
            // Leave center empty for the Nest
            const dist = Math.hypot(x - MAP_SIZE/2, y - MAP_SIZE/2);
            if (dist < 3000) continue;

            if (Math.random() < 0.3) {
                // Create a block of walls (L shape or Line)
                this.entityManager.spawnWall(x, y);
                if (Math.random() > 0.5) this.entityManager.spawnWall(x + wallSize * 2, y);
                if (Math.random() > 0.5) this.entityManager.spawnWall(x, y + wallSize * 2);
            }
        }
    }

    // Reduced initial spawn to prevent "Full everywhere" feeling
    for (let i = 0; i < 1200; i++) this.entityManager.spawnFood(); 
    for (let i = 0; i < 60; i++) this.entityManager.spawnBot(this.aiSystem);
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    this.delta += timestamp - this.lastFrameTimeMs;
    this.lastFrameTimeMs = timestamp;
    if (this.delta >= 240) this.delta = 240; 

    const { toggles, isDead, spectatingTargetId } = useGameStore.getState();
    this.input.autoFire = toggles.autoFire;
    this.input.autoSpin = toggles.autoSpin;
    this.input.autoPilot = toggles.autoPilot;
    this.input.autoLevel = toggles.autoLevel;

    // Local Player Logic (Input/Automation)
    if (this.playerId && this.entities.has(this.playerId)) {
        const player = this.entities.get(this.playerId)!;
        if (!player.isDead) {
            if (this.input.autoPilot) {
                const autoInput = this.automationSystem.compute(player, this.entities);
                this.input.moveVector = autoInput.moveVector;
                this.input.aimVector = autoInput.aimVector;
                this.input.shoot = autoInput.shoot || this.input.autoFire;
            }
            if (this.input.autoLevel) {
                const nextUpgrade = this.automationSystem.getNextUpgrade(player.upgrades, player.statPoints);
                if (nextUpgrade !== -1) this.upgradeStat(nextUpgrade);
            }
        }
    }

    if (this.mode === 'client') {
        this.networkSystem.clientInterpolate(this.entities);
        this.particles.update();
    } else {
        // Boss Spawner Logic
        const now = Date.now();
        // Spawn boss every 60 seconds if none exists
        if (now - this.lastBossSpawnTime > 60000) {
            const hasBoss = Array.from(this.entities.values()).some(e => e.type === EntityType.BOSS);
            if (!hasBoss) {
                this.entityManager.spawnBoss(this.aiSystem);
                this.lastBossSpawnTime = now;
            }
        }

        // Fixed Time Step
        while (this.delta >= this.timeStep) {
            this.updateGameLogic();
            this.delta -= this.timeStep;
        }
    }

    // Networking Updates
    if (this.mode === 'host' && timestamp - this.lastNetworkUpdate > 50) {
        this.networkSystem.broadcastState(this.entities);
        this.lastNetworkUpdate = timestamp;
    }
    if (this.mode === 'client' && timestamp - this.lastNetworkUpdate > 33) {
        network.sendInput(this.input);
        this.lastNetworkUpdate = timestamp;
    }

    // Rendering
    const targetEntity = isDead && spectatingTargetId ? this.entities.get(spectatingTargetId) : (this.playerId ? this.entities.get(this.playerId) : null);
    
    // Smooth Camera
    const camPos = this.renderSystem.updateCamera(targetEntity, this.shakeIntensity);
    this.camera.x = camPos.x + this.width/2; // Sync back for sound logic
    this.camera.y = camPos.y + this.height/2;

    const alpha = this.mode === 'client' ? 0.5 : this.delta / this.timeStep;
    this.renderSystem.draw(this.entities, camPos.x, camPos.y, alpha, this.playerId, this.mode, this.peerMap);

    // Sync HUD
    if (timestamp - this.lastHudUpdate > 100 && this.playerId) {
        const p = this.entities.get(this.playerId);
        if (p) this.syncHud(p);
        this.lastHudUpdate = timestamp;
    }
    
    if (isDead && !spectatingTargetId && (timestamp % 100 < 20)) {
        this.cycleSpectatorTarget(1);
    }
    
    // Decay Shake
    if (this.shakeIntensity > 0) {
        this.shakeIntensity *= 0.9;
        if(this.shakeIntensity < 0.1) this.shakeIntensity = 0;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateGameLogic() {
      // 1. Process Inputs and move entities slightly before physics
      this.processInputs();

      // 2. Physics & Collision (The heavy lifting)
      const { died, score } = this.physicsSystem.update(this.timeStep / 1000, this.camera, this.isRunning, this.playerId);
      
      // 3. Handle Deaths
      this.score += score;
      if (died.length > 0) {
          died.forEach(id => {
             const entity = this.entities.get(id);
             if (entity) {
                 if (entity.type.startsWith('FOOD')) {
                     setTimeout(() => { if(this.isRunning) this.entityManager.spawnFood(); }, 2000);
                 }
                 if (entity.type === EntityType.ENEMY) {
                     setTimeout(() => { if(this.isRunning) this.entityManager.spawnBot(this.aiSystem); }, 5000);
                 }
                 if (entity.type === EntityType.BOSS) {
                     // Boss died, big shake
                     this.shakeIntensity = 20;
                     soundEngine.playExplosion(0, 5);
                 } else {
                     this.shakeIntensity = 5;
                 }
                 this.entities.delete(id);
             }
          });
      }

      // 4. Update Particles
      this.particles.update();

      // 5. Cleanup
      const playerEntity = this.playerId ? this.entities.get(this.playerId) : null;
      // FIX: Check if player exists OR is dead to trigger game over
      if (this.playerId && (!playerEntity || playerEntity.isDead) && !useGameStore.getState().isDead) {
          useGameStore.getState().setDead(true);
          soundEngine.stop();
          // Ensure removal if it exists but is marked dead
          if (playerEntity) this.entities.delete(this.playerId!);
      }
  }

  private processInputs() {
      this.entities.forEach(entity => {
          if (entity.type === EntityType.WALL) return; // Walls are static

          let currentInput = this.input;
          let isRemote = false;

          // Determine Input Source
          if (this.mode === 'host') {
              for (const [peerId, entityId] of this.peerMap) {
                  if (entity.id === entityId) {
                      const remoteInput = this.remoteInputs.get(peerId);
                      if (remoteInput) currentInput = remoteInput;
                      isRemote = true;
                      break;
                  }
              }
          }

          if (entity.id === this.playerId || isRemote || entity.type === EntityType.ENEMY || entity.type === EntityType.BOSS) {
              if (entity.id === this.playerId && !entity.isDead) {
                  const velocityMag = Math.sqrt(entity.velocity.x**2 + entity.velocity.y**2);
                  soundEngine.updateEngine(velocityMag);
              }

              if (entity.type === EntityType.ENEMY || entity.type === EntityType.BOSS) {
                  this.aiSystem.update(entity);
              } else {
                  // Apply Input to Velocity/Rotation
                  let ax = 0, ay = 0;
                  if (currentInput.moveVector && (Math.abs(currentInput.moveVector.x) > 0.1 || Math.abs(currentInput.moveVector.y) > 0.1)) {
                      ax = currentInput.moveVector.x;
                      ay = currentInput.moveVector.y;
                  } else {
                      ax = (currentInput.right ? 1 : 0) - (currentInput.left ? 1 : 0);
                      ay = (currentInput.down ? 1 : 0) - (currentInput.up ? 1 : 0);
                  }
                  
                  if (!entity.isDead) {
                      entity.velocity.x += ax * entity.stats.movementSpeed;
                      entity.velocity.y += ay * entity.stats.movementSpeed;
                  }

                  if (currentInput.autoSpin) {
                      entity.rotation += 0.05;
                  } else if (currentInput.aimVector && (Math.abs(currentInput.aimVector.x) > 0.1 || Math.abs(currentInput.aimVector.y) > 0.1)) {
                      entity.rotation = Math.atan2(currentInput.aimVector.y, currentInput.aimVector.x);
                  } else if (entity.id === this.playerId && !currentInput.autoPilot) {
                      const relX = currentInput.mouseX - this.width / 2;
                      const relY = currentInput.mouseY - this.height / 2;
                      entity.rotation = Math.atan2(relY, relX);
                  }

                  if ((currentInput.shoot || currentInput.autoFire) && !entity.isDead) {
                      this.entityManager.attemptShoot(entity, this.playerId, this.camera);
                  }
              }

              // Cooldowns
              for(let i=0; i<entity.barrelCooldown.length; i++) {
                  if (entity.barrelCooldown[i] > 0) entity.barrelCooldown[i]--;
                  if (entity.barrelRecoil[i] > 0) entity.barrelRecoil[i] *= 0.8;
              }
          } else if (entity.type.startsWith('FOOD')) {
              entity.rotation += 0.01;
          }
          
          // Regen
          if ((entity.type === EntityType.PLAYER || entity.type === EntityType.ENEMY || entity.type === EntityType.BOSS) && entity.health < entity.maxHealth && !entity.isDead) {
              entity.health += entity.stats.healthRegen;
          }
      });
  }

  private syncHud(p: Entity) {
      useGameStore.getState().updateHud({
          score: this.score,
          level: p.level,
          xp: p.xp,
          maxXp: LEVEL_XP[p.level] || 999999,
          statPoints: p.statPoints,
          stats: p.upgrades
      });
  }
}
