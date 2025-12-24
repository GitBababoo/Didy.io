import { GameRecord } from '../types';

const DB_NAME = 'TankWarfareDB';
const DB_VERSION = 1;
const STORE_NAME = 'game_history';

export class Persistence {
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('score', 'score', { unique: false });
        objectStore.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
    };
  }

  public saveRecord(record: Omit<GameRecord, 'id'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        // Fallback to localstorage if DB not ready
        const current = localStorage.getItem('tank_highscore') || '0';
        if (record.score > parseInt(current)) {
            localStorage.setItem('tank_highscore', record.score.toString());
        }
        resolve();
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public getHighScores(limit: number = 5): Promise<GameRecord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
          const score = parseInt(localStorage.getItem('tank_highscore') || '0');
          resolve(score > 0 ? [{date: Date.now(), score, nickname: 'Local', duration: 0}] : []);
          return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('score');
      const request = index.openCursor(null, 'prev');
      const results: GameRecord[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
}

export const persistence = new Persistence();