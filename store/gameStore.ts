
import { create } from 'zustand';
import { GameState } from '../types';

interface GameStore extends Partial<GameState> {
  isPlaying: boolean;
  isDead: boolean;
  nickname: string;
  gameMode: 'solo' | 'host' | 'client';
  roomId: string;
  spectatingTargetId: string | null; // New: Track who we are watching
  toggles: {
    autoFire: boolean;
    autoSpin: boolean;
    autoPilot: boolean;
    autoLevel: boolean;
  };
  
  // Actions
  setPlaying: (playing: boolean) => void;
  setDead: (dead: boolean) => void;
  setNickname: (name: string) => void;
  setSpectatingTarget: (id: string | null) => void; // New Action
  toggleAuto: (key: 'autoFire' | 'autoSpin' | 'autoPilot' | 'autoLevel') => void;
  updateHud: (data: Partial<GameState>) => void;
  setAvailableUpgrades: (upgrades: number[]) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Initial State
  isPlaying: false,
  isDead: false,
  nickname: '',
  gameMode: 'solo',
  roomId: '',
  spectatingTargetId: null,
  score: 0,
  level: 1,
  xp: 0,
  maxXp: 100,
  stats: [0,0,0,0,0,0,0,0],
  statPoints: 0,
  leaderboard: [],
  availableClassUpgrades: [],
  toggles: { autoFire: false, autoSpin: false, autoPilot: false, autoLevel: false },

  // Actions (Simple & Fast)
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDead: (isDead) => set({ isDead }),
  setNickname: (nickname) => set({ nickname }),
  setSpectatingTarget: (id) => set({ spectatingTargetId: id }),
  toggleAuto: (key) => set((state) => ({ 
    toggles: { ...state.toggles, [key]: !state.toggles[key] } 
  })),
  updateHud: (data) => set((state) => ({ ...state, ...data })),
  setAvailableUpgrades: (upgrades) => set({ availableClassUpgrades: upgrades }),
}));
