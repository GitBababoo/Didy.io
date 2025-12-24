
import * as Tone from 'tone';

class SoundEngine {
  private initialized: boolean = false;
  private lastExplosionTime: number = 0; // Track time to prevent overlap errors
  
  // Synths
  // PolySynth handles multiple overlapping shots/hits without cutting off or erroring
  private shootSynth: Tone.PolySynth; 
  private explosionSynth: Tone.NoiseSynth;
  private explosionFilter: Tone.Filter;
  private hitSynth: Tone.PolySynth; 
  private uiSynth: Tone.PolySynth; 
  
  // Master Effects
  private limiter: Tone.Limiter;

  constructor() {
    this.limiter = new Tone.Limiter(-2).toDestination();

    // 1. Weapon: PolySynth of MembraneSynth for "Thump"
    this.shootSynth = new Tone.PolySynth(Tone.MembraneSynth, {
      pitchDecay: 0.02,
      octaves: 2.5,
      oscillator: { type: 'sine' },
      envelope: { 
        attack: 0.001, 
        decay: 0.2, 
        sustain: 0, 
        release: 0.1 
      },
      volume: -6
    }).connect(this.limiter);

    // 2. Explosion: NoiseSynth (Mono)
    this.explosionFilter = new Tone.Filter(400, "lowpass").connect(this.limiter);
    this.explosionSynth = new Tone.NoiseSynth({
      noise: { type: 'pink' }, 
      envelope: { 
        attack: 0.01, 
        decay: 0.8, 
        sustain: 0, 
        release: 0.8 
      },
      volume: -2
    }).connect(this.explosionFilter);

    // 3. Impact/Hit: PolySynth
    this.hitSynth = new Tone.PolySynth(Tone.MembraneSynth, {
      pitchDecay: 0.01,
      octaves: 1,
      oscillator: { type: 'sine' },
      envelope: { 
        attack: 0.001, 
        decay: 0.1, 
        sustain: 0, 
        release: 0.01 
      },
      volume: -5
    }).connect(this.limiter);

    // 4. UI Sounds
    this.uiSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' }, 
      envelope: { 
        attack: 0.02, 
        decay: 0.3, 
        sustain: 0.1, 
        release: 1 
      },
      volume: -8
    }).connect(this.limiter);
  }

  public async init() {
    if (this.initialized) return;
    
    try {
      await Tone.start();
      this.initialized = true;
    } catch (e) {
      console.error("Audio Context Init Failed", e);
    }
  }

  private getVolumeAtDistance(dist: number): number {
    if (!Number.isFinite(dist)) return -Infinity;
    const maxDist = 1500;
    if (dist > maxDist) return -Infinity;
    return Tone.gainToDb(Math.max(0, 1 - (dist / maxDist))); 
  }

  private getVelocityAtDistance(dist: number): number {
    if (!Number.isFinite(dist)) return 0;
    const maxDist = 1500;
    if (dist > maxDist) return 0;
    const raw = 1 - (dist / maxDist);
    return Math.max(0, Math.min(1, raw * raw)); // Squared falloff for better feel
  }

  public playShoot(distToCamera: number = 0) {
    if (!this.initialized) return;
    
    // Validate Input
    const d = Number.isFinite(distToCamera) ? distToCamera : 0;
    
    const velocity = this.getVelocityAtDistance(d);
    if (velocity < 0.01) return;

    const pitch = Math.random() > 0.5 ? "C1" : "C#1"; 
    
    // Safety buffer to ensure valid scheduling
    const time = Tone.now() + 0.05;
    this.shootSynth.triggerAttackRelease(pitch, 0.1, time, velocity);
  }

  public playExplosion(distToCamera: number = 0, sizeScale: number = 1) {
    if (!this.initialized) return;
    
    const d = Number.isFinite(distToCamera) ? distToCamera : 0;
    const s = Number.isFinite(sizeScale) ? sizeScale : 1;

    const vol = this.getVolumeAtDistance(d);
    if (vol === -Infinity) return;
    
    const filterFreq = 400 - (s * 50); 
    this.explosionFilter.frequency.value = Math.max(100, filterFreq);
    this.explosionSynth.volume.value = 0 + vol; 
    
    // Fix: Ensure strict monotonicity for Monophonic synth events
    // If multiple explosions happen in one frame, we must stagger them slightly
    const now = Tone.now();
    let time = now + 0.05;
    if (time <= this.lastExplosionTime) {
        time = this.lastExplosionTime + 0.01; // Offset by 10ms to avoid collision
    }
    this.lastExplosionTime = time;

    this.explosionSynth.triggerAttackRelease(0.5 + s * 0.2, time);
  }

  public playHit(distToCamera: number = 0) {
    if (!this.initialized) return;
    
    const d = Number.isFinite(distToCamera) ? distToCamera : 0;
    if (d > 1000) return;
    
    const velocity = this.getVelocityAtDistance(d);
    if (velocity < 0.01) return;

    // Safety buffer
    const time = Tone.now() + 0.05;
    this.hitSynth.triggerAttackRelease("G2", 0.05, time, velocity);
  }

  public playLevelUp() {
    if (!this.initialized) return;
    const now = Tone.now() + 0.05;
    this.uiSynth.triggerAttackRelease("C4", "8n", now);
    this.uiSynth.triggerAttackRelease("E4", "8n", now + 0.1);
    this.uiSynth.triggerAttackRelease("G4", "8n", now + 0.2);
    this.uiSynth.triggerAttackRelease("C5", "4n", now + 0.3);
  }

  public playSpawn() {
    if (!this.initialized) return;
    const now = Tone.now() + 0.05;
    this.uiSynth.triggerAttackRelease("G3", "8n", now);
    this.uiSynth.triggerAttackRelease("C4", "2n", now + 0.15);
  }

  public updateEngine(velocityMagnitude: number) {
     // No-op
  }

  public stop() {
      if (this.initialized) {
          // Can stop transport if needed
      }
  }
}

export const soundEngine = new SoundEngine();
